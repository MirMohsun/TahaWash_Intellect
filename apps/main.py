# ============================================================================
#  TAHAWASH — прошивка Raspberry Pi Pico 2W (MicroPython)
#  Версия: 1.0 (план зафиксирован 11.06.2026)
#
#  Функции:
#   1. Онлайн-оплата  — команда credit с бэкэнда -> эмуляция импульсов
#                       купюроприёмника на плату Tahwash (GPIO 15 -> BC547)
#   2. Наличные       — пассивное слушание импульсов купюроприёмника (GPIO 7)
#   3. Лог + отчёт    — каждое событие во флеш (JSON lines), в 00:00 по Баку
#                       полный лог уходит на бэкэнд, очистка ТОЛЬКО после ACK
#   4. Реле           — прямое управление FN-2..FN-5, PAUSE (GPIO 2-6)
#   5. Heartbeat      — раз в минуту, для статуса онлайн/офлайн в админке
#
#  ВАЖНО ПО ЖЕЛЕЗУ (подтверждено осциллографом на стенде):
#   - ЭМИССИЯ КРЕДИТА: GPIO 15 -> резистор 270 Ом -> база BC547 (NPN).
#     Коллектор через диод 1N4007 (полоса к коллектору) на сигнальную линию
#     V1 платы THW-6F, эмиттер на массу автомата. Диод формирует «полку»
#     ~0.7В — линия в нуле садится не в 0В, а в ~0.5-0.7В, как у самого NV9.
#     Логика активного низкого: value(1)=транзистор открыт=линия LOW.
#   - ПАТТЕРН: 1 AZN = ДВОЙНОЙ импульс (50мс LOW / 100мс HIGH / 50мс LOW).
#     Сумма N AZN = N таких пачек с зазором 600мс между пачками.
#   - Сигнальная линия купюроприёмника (вход GPIO 7) — 12V! НИКОГДА не
#     подключать напрямую к GPIO, только через оптопару (PC817) / делитель.
#   - Реле модули оптоизолированные, активный уровень LOW (value=1 = выкл).
# ============================================================================

import network
import machine
import time
import json
import os
import sys
import select
import ntptime
from umqtt.simple import MQTTClient

# ============================================================================
#  КОНФИГУРАЦИЯ
# ============================================================================

TEST_MODE = True          # True = подробные принты в Thonny + simulate_bill()
                          # False = боевой режим (тихий)

WIFI_SSID = "Sol"
WIFI_PASS = "01081328s189"

# --- MQTT ---
# Локальная разработка: LAN IP машины с docker compose (ipconfig → Wi-Fi IPv4).
# НЕ localhost — Pico не видит localhost хоста!
# Продакшн: публичный адрес Mosquitto.
MQTT_BROKER    = "192.168.0.102"
MQTT_PORT      = 1883
MQTT_USER      = "tahawash-device"   # passwd/devices.txt (apps/mqtt-broker/)
MQTT_PASSWORD  = "changeme"          # dev default; sync with devices.txt + backend .env
MQTT_KEEPALIVE = 60

# Должен СОВПАДАТЬ 1-в-1 с Bay.hardwareIdentifier в админке (YuBox Bay 1 в seed).
HARDWARE_ID = "tahawash-wash-01"

TOPIC_CONTROL = ("tahawash/hardware/%s/control" % HARDWARE_ID).encode()
TOPIC_STATUS  = ("tahawash/hardware/%s/status" % HARDWARE_ID).encode()

# --- Время ---
TZ_OFFSET_S = 4 * 3600        # Asia/Baku = UTC+4, без перехода на летнее
NTP_HOST    = "pool.ntp.org"

# --- Эмуляция импульсов (ПОДТВЕРЖДЕНО осциллографом против реальной купюры) ---
# 1 AZN = одна пачка = ДВА импульса: LOW(PULSE_ON) / HIGH(PULSE_GAP) / LOW(PULSE_ON).
# Сумма N AZN = N пачек, между пачками пауза INTER_AZN_GAP_MS.
PULSE_ON_MS     = 50          # длительность одного импульса (линия LOW)
PULSE_GAP_MS    = 100         # пауза ВНУТРИ пачки (между двумя импульсами, линия HIGH)
INTER_AZN_GAP_MS = 600        # пауза МЕЖДУ пачками (между единицами AZN)
EMU_GUARD_MS    = 500         # запас после эмуляции, пока вход подавлен

# --- Купюроприёмник (вход) ---
BILL_DEBOUNCE_MS  = 30        # антидребезг между импульсами
BILL_GROUP_MS     = 800       # пауза, после которой купюра считается принятой
AZN_PER_PULSE     = 1         # номинал одного импульса от купюроприёмника
BILL_MAX_PULSES   = 100       # больше = помеха/сбой, пишем как anomaly, не деньги

# --- Названия программ для отчёта (УТОЧНИТЬ реальное соответствие на аппарате!)
# Названия ниже — заглушки. Известные функции аппарата: вода, пена,
# ЦВЕТНАЯ ПЕНА, и т.д. — какая на каком FN-пине, выясняем на месте.
PROGRAM_NAMES = {
    "fn2": "Su",
    "fn3": "Lopuk",
    "fn4": "Rengli kopuk",
    "fn5": "MUM",
    "pause": "Пауза",
    "fn6": "Osmos",   # если окажется отдельной линией FN-6
}

# --- Мониторинг функций аппарата (комбинации реле -> что запущено) ---
# Линии реле аппарата заводятся на GPIO через ОПТОПАРЫ (на линиях 12V!).
# Работает для ЛЮБОГО типа оплаты: смотрим что реально включилось.
USAGE_TRACKING   = True       # False = блок выключен (железо ещё не подключено)
USAGE_GPIO       = {          # имя линии -> номер GPIO (количество уточним)
    # ВНИМАНИЕ: r6 перенесён с GP15 на GP8, т.к. GP15 теперь занят эмиссией
    # кредита (EMU_OUT_PIN). GP8 освободился после переезда эмиссии на GP15.
    "r1": 10, "r2": 11, "r3": 12, "r4": 13, "r5": 14, "r6": 8,
}
USAGE_ACTIVE_LOW = True       # через оптопару LOW = линия активна (проверить!)
USAGE_STABLE_MS  = 200        # комбинация должна держаться столько, чтобы засчитаться
# Комбинация (отсортированный кортеж линий) -> название функции.
# ЗАПОЛНИТЬ после наблюдения за реальным аппаратом: включаем функцию руками,
# смотрим в логе какая комбинация пришла, вписываем сюда.
COMBO_MAP = {
    # ("r1",):       "Вода",
    # ("r1", "r3"):  "Пена",
}

# --- Прочее ---
HEARTBEAT_S        = 60       # период heartbeat
REPORT_RETRY_S     = 300      # повтор отправки отчёта, если нет ACK
REPORT_CHUNK       = 50       # событий в одном MQTT-сообщении отчёта
LOG_FILE           = "events.jsonl"        # лог текущего дня
PENDING_FILE       = "events_pending.jsonl"  # отправленный, но не подтверждённый

# --- GPIO ---
RELAY_PINS = {
    "fn2":   machine.Pin(2, machine.Pin.OUT, value=1),
    "fn3":   machine.Pin(3, machine.Pin.OUT, value=1),
    "fn4":   machine.Pin(4, machine.Pin.OUT, value=1),
    "fn5":   machine.Pin(5, machine.Pin.OUT, value=1),
    "pause": machine.Pin(6, machine.Pin.OUT, value=1),
    # Если цветная пена окажется отдельной линией на плате (FN-6) —
    # подключаем 6-е реле на GPIO 9 и раскомментируем:
     "fn6":   machine.Pin(9, machine.Pin.OUT, value=1),
}
BILL_IN_PIN = machine.Pin(7, machine.Pin.IN, machine.Pin.PULL_UP)
EMU_OUT_PIN = machine.Pin(15, machine.Pin.OUT, value=0)   # -> 270Ом -> база BC547
LED         = machine.Pin("LED", machine.Pin.OUT, value=0)

# ============================================================================
#  ГЛОБАЛЬНОЕ СОСТОЯНИЕ
# ============================================================================

mqtt = None
start_ticks = time.ticks_ms()

emulating = False             # подавление входа во время эмуляции
emu_guard_until = 0           # ticks_ms, до которого вход ещё подавлен

# Дедупликация онлайн-кредитов: последние обработанные txId (ограниченный размер)
processed_tx = []             # список txId в порядке обработки
PROCESSED_TX_MAX = 50         # сколько последних txId помним

# Счётчик импульсов купюроприёмника (пишется из IRQ — только простые операции)
bill_pulse_count = 0
bill_last_pulse_ms = 0

auto_off = {}                 # {"fn2": ticks_deadline_ms, ...}

current_day = None            # "YYYY-MM-DD" текущего лога
awaiting_ack_for = None       # дата отчёта, по которому ждём ACK
last_report_attempt = 0       # ticks_ms последней попытки отправки
last_heartbeat = 0
time_synced = False


def log(*args):
    if TEST_MODE:
        print(*args)


# ============================================================================
#  ВРЕМЯ
# ============================================================================

def sync_time():
    """NTP-синхронизация. Без неё не работают 00:00 и таймстампы."""
    global time_synced
    ntptime.host = NTP_HOST
    for attempt in range(5):
        try:
            ntptime.settime()          # ставит RTC в UTC
            time_synced = True
            log("NTP OK, локальное время:", now_iso())
            return True
        except Exception as e:
            log("NTP попытка", attempt + 1, "ошибка:", e)
            time.sleep(2)
    log("NTP не удалось — таймстампы будут от uptime!")
    return False


def local_time():
    return time.localtime(time.time() + TZ_OFFSET_S)


def now_iso():
    t = local_time()
    return "%04d-%02d-%02dT%02d:%02d:%02d+04:00" % (t[0], t[1], t[2], t[3], t[4], t[5])


def today_str():
    t = local_time()
    return "%04d-%02d-%02d" % (t[0], t[1], t[2])


# ============================================================================
#  ЛОГ ВО ФЛЕШ (JSON lines — одна строка = одно событие)
# ============================================================================

def file_exists(name):
    try:
        os.stat(name)
        return True
    except OSError:
        return False


def log_event(ev):
    """Записать событие. Запись на флеш — сразу, чтобы пережить отключение питания."""
    ev["ts"] = now_iso()
    ev["device"] = HARDWARE_ID
    try:
        with open(LOG_FILE, "a") as f:
            f.write(json.dumps(ev) + "\n")
        log("EVENT:", ev)
    except Exception as e:
        log("ОШИБКА записи лога:", e)


def read_events(name):
    events = []
    if not file_exists(name):
        return events
    try:
        with open(name) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        events.append(json.loads(line))
                    except ValueError:
                        pass   # битая строка (обрыв питания на середине записи)
    except Exception as e:
        log("ОШИБКА чтения лога:", e)
    return events


def count_events(name):
    n = 0
    if not file_exists(name):
        return 0
    try:
        with open(name) as f:
            for line in f:
                if line.strip():
                    n += 1
    except Exception:
        pass
    return n


def clear_file(name):
    try:
        if file_exists(name):
            os.remove(name)
    except Exception as e:
        log("ОШИБКА удаления", name, ":", e)


# ============================================================================
#  ЭМУЛЯЦИЯ ИМПУЛЬСОВ КУПЮРОПРИЁМНИКА (онлайн-кредит)
# ============================================================================

def _emit_one_azn():
    """Одна пачка = 1 AZN. Проверенный паттерн: два импульса 50/100/50.
    value(1) = транзистор открыт = линия LOW; value(0) = линия идёт к HIGH."""
    EMU_OUT_PIN.value(1)
    time.sleep_ms(PULSE_ON_MS)
    EMU_OUT_PIN.value(0)
    time.sleep_ms(PULSE_GAP_MS)        # пауза ВНУТРИ пачки
    EMU_OUT_PIN.value(1)
    time.sleep_ms(PULSE_ON_MS)
    EMU_OUT_PIN.value(0)


def emulate_credit(azn):
    """Зачислить целое число AZN: послать `azn` пачек на плату Tahwash через
    GPIO 15 (BC547). Между пачками пауза INTER_AZN_GAP_MS.
    На время эмуляции + защитный интервал вход GPIO 7 подавлен, чтобы Pico
    не посчитал собственные импульсы как наличные."""
    global emulating, emu_guard_until, bill_pulse_count
    if azn <= 0:
        return False
    emulating = True
    try:
        for i in range(azn):
            _emit_one_azn()
            if i < azn - 1:
                time.sleep_ms(INTER_AZN_GAP_MS)
        return True
    except Exception as e:
        log("ОШИБКА эмуляции:", e)
        EMU_OUT_PIN.value(0)
        return False
    finally:
        emu_guard_until = time.ticks_add(time.ticks_ms(), EMU_GUARD_MS)
        bill_pulse_count = 0        # сброс всего, что могло насчитаться
        emulating = False


# ============================================================================
#  КУПЮРОПРИЁМНИК — ПАССИВНОЕ СЛУШАНИЕ (GPIO 7, IRQ)
# ============================================================================

def bill_irq(pin):
    """Обработчик прерывания. Минимум работы: дебаунс + счётчик."""
    global bill_pulse_count, bill_last_pulse_ms
    now = time.ticks_ms()
    if emulating or time.ticks_diff(emu_guard_until, now) > 0:
        return
    if time.ticks_diff(now, bill_last_pulse_ms) < BILL_DEBOUNCE_MS:
        return
    bill_last_pulse_ms = now
    bill_pulse_count += 1


BILL_IN_PIN.irq(trigger=machine.Pin.IRQ_FALLING, handler=bill_irq)


def check_bill_complete():
    """Вызывается из главного цикла: если после последнего импульса прошла
    пауза BILL_GROUP_MS — купюра принята целиком, фиксируем событие."""
    global bill_pulse_count
    if bill_pulse_count == 0:
        return
    if time.ticks_diff(time.ticks_ms(), bill_last_pulse_ms) < BILL_GROUP_MS:
        return
    pulses = bill_pulse_count
    bill_pulse_count = 0
    if pulses > BILL_MAX_PULSES:
        # Помеха или сбой линии — фиксируем, но НЕ считаем выручкой
        log_event({"type": "anomaly", "pulses": pulses,
                   "note": "pulse count over BILL_MAX_PULSES"})
        return
    amount = pulses * AZN_PER_PULSE
    ev = {"type": "cash", "amount": amount, "pulses": pulses}
    log_event(ev)
    publish_json(TOPIC_STATUS, {
        "type": "payment_event", "source": "cash",
        "device": HARDWARE_ID, "amount": amount, "ts": now_iso(),
    })


def simulate_bill(pulses=5):
    """Только для TEST_MODE: имитирует купюру на N импульсов."""
    global bill_pulse_count, bill_last_pulse_ms
    bill_pulse_count = pulses
    bill_last_pulse_ms = time.ticks_add(time.ticks_ms(), -BILL_GROUP_MS - 1)
    log("SIM: имитация купюры,", pulses, "импульсов")


# Неблокирующее чтение из Shell Thonny: пока main() работает,
# набери число + Enter — это имитация купюры на столько импульсов.
_stdin_poll = select.poll()
_stdin_poll.register(sys.stdin, select.POLLIN)


def check_test_input():
    """TEST_MODE, ввод в Shell Thonny:
         5            -> имитация купюры на 5 импульсов
         o 3 fn3      -> имитация онлайн-оплаты 3 AZN, программа fn3
         u r1 r3      -> имитация: линии r1+r3 активны (функция запущена)
         u            -> имитация: все линии выключены (функция остановлена)"""
    if not TEST_MODE:
        return
    if _stdin_poll.poll(0):
        line = sys.stdin.readline().strip()
        if not line:
            return
        if line.isdigit() and int(line) > 0:
            simulate_bill(int(line))
        elif line.lower().startswith("u"):
            parts = line.split()[1:]
            usage_sim.clear()
            usage_sim.update(parts)
            log("SIM: активные линии =", sorted(usage_sim) if usage_sim else "нет")
        elif line.lower().startswith("o"):
            parts = line.split()
            try:
                amount = float(parts[1])
            except (IndexError, ValueError):
                log("SIM: формат: o <сумма> [программа], например: o 3 fn3")
                return
            program = parts[2] if len(parts) > 2 else None
            tx_id = "sim-%d" % time.ticks_ms()
            log("SIM: имитация онлайн-оплаты", amount, "AZN",
                ("программа " + program) if program else "")
            msg = {"type": "credit", "txId": tx_id, "amount": amount}
            if program:
                msg["programPin"] = program
            handle_credit(msg)
        else:
            log("SIM: число + Enter = купюра | o <сумма> [программа] = онлайн")


# ============================================================================
#  МОНИТОРИНГ ФУНКЦИЙ АППАРАТА (комбинации реле -> программа)
# ============================================================================

usage_pins = {}
if USAGE_TRACKING:
    for _name, _gpio in USAGE_GPIO.items():
        usage_pins[_name] = machine.Pin(_gpio, machine.Pin.IN, machine.Pin.PULL_UP)

usage_sim = set()             # TEST_MODE: имитация активных линий
usage_last_read = ()          # последняя считанная комбинация
usage_last_change_ms = 0      # когда она появилась
usage_active = ()             # подтверждённая активная комбинация
usage_started_ms = 0
usage_started_ts = ""


def read_usage_combo():
    if TEST_MODE:
        return tuple(sorted(usage_sim))
    active = []
    for name, pin in usage_pins.items():
        is_on = (pin.value() == 0) if USAGE_ACTIVE_LOW else (pin.value() == 1)
        if is_on:
            active.append(name)
    return tuple(sorted(active))


def usage_name(combo):
    return COMBO_MAP.get(combo, "+".join(combo))


def check_usage():
    """Следит за стабильной сменой комбинации. При завершении работы функции
    пишет событие usage с названием и длительностью."""
    global usage_last_read, usage_last_change_ms
    global usage_active, usage_started_ms, usage_started_ts
    if not USAGE_TRACKING:
        return
    now = time.ticks_ms()
    combo = read_usage_combo()
    if combo != usage_last_read:
        usage_last_read = combo
        usage_last_change_ms = now
        return
    if time.ticks_diff(now, usage_last_change_ms) < USAGE_STABLE_MS:
        return
    if combo == usage_active:
        return
    # Стабильная смена комбинации
    if usage_active:
        dur = time.ticks_diff(now, usage_started_ms) // 1000
        log_event({"type": "usage", "combo": list(usage_active),
                   "name": usage_name(usage_active),
                   "durationS": dur, "startTs": usage_started_ts})
    if combo:
        usage_started_ms = now
        usage_started_ts = now_iso()
        log("USAGE: запущено", usage_name(combo), combo)
    usage_active = combo


# ============================================================================
#  РЕЛЕ (FN-2..FN-5, PAUSE) — активный LOW
# ============================================================================

def relay_set(name, on, duration=0):
    pin = RELAY_PINS.get(name)
    if pin is None:
        return False
    pin.value(0 if on else 1)
    if on and duration > 0:
        auto_off[name] = time.ticks_add(time.ticks_ms(), int(duration * 1000))
    elif name in auto_off:
        del auto_off[name]
    log("RELAY:", name, "->", "ON" if on else "OFF",
        ("(авто-офф %ss)" % duration) if on and duration else "")
    return True


def check_auto_off():
    now = time.ticks_ms()
    for name in list(auto_off.keys()):
        if time.ticks_diff(now, auto_off[name]) >= 0:
            relay_set(name, False)


def relay_states():
    # value()==0 значит реле включено (активный LOW)
    return {name: (1 - pin.value()) for name, pin in RELAY_PINS.items()}


# ============================================================================
#  MQTT
# ============================================================================

def publish_json(topic, obj):
    try:
        mqtt.publish(topic, json.dumps(obj))
        return True
    except Exception as e:
        log("ОШИБКА publish:", e)
        return False


def remember_tx(tx_id):
    """Запомнить обработанный txId (с ограничением размера), для дедупликации."""
    if tx_id is None:
        return
    processed_tx.append(tx_id)
    if len(processed_tx) > PROCESSED_TX_MAX:
        del processed_tx[0]


def handle_credit(msg):
    """Онлайн-оплата: {"type":"credit","txId":"...","amount":3,"programPin":"fn3"?}
    Сумма принимается ТОЛЬКО целым числом AZN (1 пачка = 1 AZN). Дробные суммы
    отклоняются, чтобы не было тихого недозачисления."""
    tx_id = msg.get("txId")
    amount = msg.get("amount", 0)
    program = msg.get("programPin")

    # Дедупликация: ту же транзакцию повторно НЕ зачисляем (реконнект / QoS-ретрай),
    # но ACK всё равно шлём, чтобы бэкэнд понял, что кредит уже выполнен.
    if tx_id is not None and tx_id in processed_tx:
        log("CREDIT: повтор txId=%s — эмиссию пропускаем, шлём повторный ACK" % tx_id)
        publish_json(TOPIC_STATUS, {
            "type": "ack", "device": HARDWARE_ID, "txId": tx_id,
            "credited": True, "duplicate": True, "ts": now_iso(),
        })
        return

    # Валидация ДО эмиссии: только целое положительное число AZN.
    valid = isinstance(amount, (int, float)) and amount > 0 \
        and float(amount) == int(amount)
    azn = int(amount) if valid else 0
    log("CREDIT: txId=%s amount=%s -> %s" % (
        tx_id, amount,
        ("%d пачек" % azn) if valid else "ОТКЛОНЕНО (сумма не целое AZN)"))

    ok = valid and emulate_credit(azn)

    ack = {"type": "ack", "device": HARDWARE_ID, "txId": tx_id,
           "credited": ok, "ts": now_iso()}
    if not ok:
        ack["error"] = ("amount must be a positive integer AZN"
                        if not valid else "pulse emulation failed")
    publish_json(TOPIC_STATUS, ack)

    if ok:
        remember_tx(tx_id)
        ev = {"type": "online", "amount": amount, "txId": tx_id,
              "azn": azn, "pulses": azn * 2}
        if program:
            ev["program"] = program
            ev["programName"] = PROGRAM_NAMES.get(program, program)
        log_event(ev)


def handle_relay(msg):
    """{"type":"relay","pin":"fn2","action":"on","duration":5}"""
    relay_set(msg.get("pin", ""), msg.get("action") == "on",
              msg.get("duration", 0))


def send_snapshot():
    """Текущий срез дня по запросу бэкэнда."""
    events = read_events(LOG_FILE)
    publish_json(TOPIC_STATUS, {
        "type": "report_snapshot", "device": HARDWARE_ID,
        "date": today_str(), "count": len(events),
        "events": events[-REPORT_CHUNK:],   # последние N, чтобы влезть в сообщение
        "ts": now_iso(),
    })


def send_daily_report():
    """Отправка полного лога за день (чанками). Файл НЕ удаляется —
    переименовывается в pending и удаляется только после report_ack."""
    global awaiting_ack_for, last_report_attempt
    last_report_attempt = time.ticks_ms()

    # Переносим лог в pending (если pending уже есть — дописываем в него)
    if file_exists(LOG_FILE):
        if file_exists(PENDING_FILE):
            with open(PENDING_FILE, "a") as dst, open(LOG_FILE) as src:
                for line in src:
                    dst.write(line)
            clear_file(LOG_FILE)
        else:
            os.rename(LOG_FILE, PENDING_FILE)

    events = read_events(PENDING_FILE)
    report_date = awaiting_ack_for or yesterday_str()
    awaiting_ack_for = report_date

    total = len(events)
    parts = (total + REPORT_CHUNK - 1) // REPORT_CHUNK
    if parts == 0:
        parts = 1
    log("REPORT: дата=%s событий=%d частей=%d" % (report_date, total, parts))

    for p in range(parts):
        chunk = events[p * REPORT_CHUNK:(p + 1) * REPORT_CHUNK]
        publish_json(TOPIC_STATUS, {
            "type": "daily_report", "device": HARDWARE_ID,
            "date": report_date, "part": p + 1, "totalParts": parts,
            "count": total, "events": chunk, "ts": now_iso(),
        })
        time.sleep_ms(100)


def yesterday_str():
    t = time.localtime(time.time() + TZ_OFFSET_S - 86400)
    return "%04d-%02d-%02d" % (t[0], t[1], t[2])


def handle_report_ack(msg):
    """Бэкэнд подтвердил получение отчёта — только теперь чистим флеш."""
    global awaiting_ack_for
    if msg.get("date") == awaiting_ack_for:
        clear_file(PENDING_FILE)
        awaiting_ack_for = None
        log("REPORT ACK получен, лог за", msg.get("date"), "очищен")


def on_message(topic, payload):
    try:
        msg = json.loads(payload)
    except ValueError:
        log("MQTT: не-JSON сообщение, игнор:", payload)
        return
    mtype = msg.get("type")
    log("MQTT <-", mtype)
    if mtype == "credit":
        handle_credit(msg)
    elif mtype == "relay":
        handle_relay(msg)
    elif mtype == "get_report":
        send_snapshot()
    elif mtype == "report_ack":
        handle_report_ack(msg)
    else:
        log("MQTT: неизвестный type:", mtype)


def send_heartbeat():
    publish_json(TOPIC_STATUS, {
        "type": "heartbeat", "device": HARDWARE_ID,
        "uptime": time.ticks_diff(time.ticks_ms(), start_ticks) // 1000,
        "relays": relay_states(),
        "eventsToday": count_events(LOG_FILE),
        "pendingReport": awaiting_ack_for,
        "activeFunction": usage_name(usage_active) if usage_active else None,
        "ts": now_iso(),
    })


# ============================================================================
#  ПОДКЛЮЧЕНИЯ
# ============================================================================

def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if wlan.isconnected():
        return wlan
    log("Wi-Fi: подключение к", WIFI_SSID, "...")
    wlan.connect(WIFI_SSID, WIFI_PASS)
    for _ in range(30):
        if wlan.isconnected():
            log("Wi-Fi OK:", wlan.ifconfig()[0])
            return wlan
        time.sleep(1)
    log("Wi-Fi: не удалось — перезагрузка")
    machine.reset()


def connect_mqtt():
    global mqtt
    mqtt = MQTTClient(
        client_id=HARDWARE_ID,
        server=MQTT_BROKER,
        port=MQTT_PORT,
        user=MQTT_USER,
        password=MQTT_PASSWORD,
        keepalive=MQTT_KEEPALIVE,
    )
    mqtt.set_callback(on_message)
    mqtt.connect()
    mqtt.subscribe(TOPIC_CONTROL)
    log("MQTT OK:", MQTT_BROKER, "| подписка:", TOPIC_CONTROL)


# ============================================================================
#  ГЛАВНЫЙ ЦИКЛ
# ============================================================================

def main():
    global current_day, last_heartbeat

    wlan = connect_wifi()
    sync_time()
    connect_mqtt()
    current_day = today_str()
    LED.value(1)

    # Если после ребута остался неподтверждённый отчёт — дошлём его
    if file_exists(PENDING_FILE):
        log("Найден неподтверждённый отчёт — повторная отправка")
        send_daily_report()

    log("=" * 50)
    log("TAHAWASH Pico готов. Устройство:", HARDWARE_ID)
    if TEST_MODE:
        log("TEST_MODE команды: 5 = купюра | o 3 fn3 = онлайн | u r1 r3 = функция вкл | u = выкл")
    log("=" * 50)

    while True:
        try:
            # 1. Входящие MQTT команды (неблокирующе)
            mqtt.check_msg()

            # 2. Авто-выключение реле по таймерам
            check_auto_off()

            # 3. Группировка импульсов купюроприёмника в купюру
            check_bill_complete()

            # 3b. Мониторинг функций аппарата (комбинации реле)
            check_usage()

            # 3c. TEST_MODE: ввод числа + Enter в Shell = имитация купюры
            check_test_input()

            # 4. Heartbeat раз в HEARTBEAT_S
            now = time.ticks_ms()
            if time.ticks_diff(now, last_heartbeat) >= HEARTBEAT_S * 1000:
                last_heartbeat = now
                send_heartbeat()

            # 5. Полночь по Баку — день сменился, отправляем отчёт
            if time_synced and today_str() != current_day:
                log("Полночь — отправка ежедневного отчёта")
                send_daily_report()
                current_day = today_str()

            # 6. Повтор неподтверждённого отчёта каждые REPORT_RETRY_S
            if awaiting_ack_for and \
               time.ticks_diff(now, last_report_attempt) >= REPORT_RETRY_S * 1000:
                log("ACK по отчёту не получен — повтор")
                send_daily_report()

            # 7. Контроль Wi-Fi
            if not wlan.isconnected():
                raise OSError("Wi-Fi потерян")

            time.sleep_ms(50)

        except OSError as e:
            # Любой обрыв связи: гасим реле, переподключаемся
            log("СБОЙ СВЯЗИ:", e, "— переподключение...")
            LED.value(0)
            for name in RELAY_PINS:
                relay_set(name, False)
            EMU_OUT_PIN.value(0)
            try:
                wlan = connect_wifi()
                if not time_synced:
                    sync_time()
                connect_mqtt()
                LED.value(1)
            except Exception as e2:
                log("Переподключение не удалось:", e2, "— ребут через 10с")
                time.sleep(10)
                machine.reset()


main()