# ============================================================================
#  config.py — провижининг кредов для TAHAWASH (MicroPython, Pico 2 W)
#
#  Идея: НИКАКИХ секретов в main.py. main импортирует этот модуль и берёт
#  настройки из config.json. Если файла нет / он неполный / зажата кнопка
#  при включении — поднимается Wi-Fi точка и веб-форма для ввода на месте.
#
#  --- КАК ТЕСТИРОВАТЬ ОТДЕЛЬНО ---
#  Можно просто запустить ЭТОТ файл в Thonny (Run). Тогда сразу поднимется
#  точка доступа Tahawash-Setup независимо от наличия config.json (см. блок
#  __main__ внизу). Подключись к ней телефоном и зайди на http://192.168.4.1
#
#  --- ИСПОЛЬЗОВАНИЕ В main.py (в самом верху, до подключения к Wi-Fi) ---
#       import config
#       cfg = config.get_config()        # вернёт dict, либо уйдёт в провижининг
#       WIFI_SSID    = cfg["wifi_ssid"]
#       WIFI_PASS    = cfg["wifi_pass"]
#       MQTT_BROKER  = cfg["mqtt_broker"]
#       MQTT_PORT    = cfg["mqtt_port"]
#       MQTT_USER    = cfg["mqtt_user"]
#       MQTT_PASSWORD= cfg["mqtt_pass"]
#       HARDWARE_ID  = cfg["hardware_id"]
#
#  ВАЖНО про секретность: config.json — обычный файл на флешке. Физический
#  доступ = чтение. Это НЕ защита, а провижининг. Реальная защита строится
#  на сервере: TLS, уникальные креды на устройство, валидация credit-команд.
# ============================================================================

import json
import time
import network
import socket
import machine

CONFIG_FILE = "config.json"

# Точка доступа провижининга. Пароль AP >= 8 символов (требование WPA2).
# В продакшне делай уникальным на устройство.
AP_SSID = "Tahawash-Setup"
AP_PASS = "setup12345"

# Кнопка форс-провижининга: зажать на массу (GND) при включении, чтобы
# перенастроить уже прошитое устройство. Выбери СВОБОДНЫЙ GPIO — в main
# заняты 2-15. Здесь GP22 как пример свободного пина.
PROV_PIN_NUM = 22

DEFAULTS = {
    "wifi_ssid":   "",
    "wifi_pass":   "",
    "mqtt_broker": "",
    "mqtt_port":   1883,
    "mqtt_user":   "",
    "mqtt_pass":   "",
    "hardware_id": "",
}


def load_config():
    try:
        with open(CONFIG_FILE) as f:
            data = json.load(f)
        merged = dict(DEFAULTS)
        merged.update(data)
        return merged
    except (OSError, ValueError):
        return None


def save_config(cfg):
    with open(CONFIG_FILE, "w") as f:
        json.dump(cfg, f)


def config_valid(cfg):
    if not cfg:
        return False
    # Минимально необходимое для запуска
    return bool(cfg.get("wifi_ssid")) and bool(cfg.get("mqtt_broker")) \
        and bool(cfg.get("hardware_id"))


def _forced():
    try:
        btn = machine.Pin(PROV_PIN_NUM, machine.Pin.IN, machine.Pin.PULL_UP)
        return btn.value() == 0   # зажата на массу
    except Exception:
        return False


# ----------------------------------------------------------------------------
#  Веб-форма (отдаётся в режиме AP)
# ----------------------------------------------------------------------------

_PAGE = """HTTP/1.0 200 OK\r
Content-Type: text/html; charset=utf-8\r
\r
<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tahawash Setup</title>
<style>body{{font-family:sans-serif;max-width:420px;margin:24px auto;padding:0 16px}}
input{{width:100%;padding:8px;margin:4px 0 12px;box-sizing:border-box}}
button{{width:100%;padding:12px;font-size:16px}}</style></head>
<body><h2>Tahawash — настройка</h2>
<form action="/save" method="get">
<label>Wi-Fi SSID</label><input name="wifi_ssid" value="{wifi_ssid}">
<label>Wi-Fi пароль</label><input name="wifi_pass" value="{wifi_pass}">
<label>MQTT broker</label><input name="mqtt_broker" value="{mqtt_broker}">
<label>MQTT порт</label><input name="mqtt_port" value="{mqtt_port}">
<label>MQTT user</label><input name="mqtt_user" value="{mqtt_user}">
<label>MQTT пароль</label><input name="mqtt_pass" value="{mqtt_pass}">
<label>Hardware ID</label><input name="hardware_id" value="{hardware_id}">
<button type="submit">Сохранить и перезагрузить</button>
</form></body></html>"""

_OK = """HTTP/1.0 200 OK\r
Content-Type: text/html; charset=utf-8\r
\r
<!DOCTYPE html><html><body style="font-family:sans-serif">
<h2>Сохранено</h2><p>Устройство перезагружается...</p></body></html>"""


def _url_decode(s):
    s = s.replace("+", " ")
    out = ""
    i = 0
    while i < len(s):
        c = s[i]
        if c == "%" and i + 2 < len(s):
            try:
                out += chr(int(s[i + 1:i + 3], 16))
                i += 3
                continue
            except ValueError:
                pass
        out += c
        i += 1
    return out


def _parse_qs(qs):
    out = {}
    for pair in qs.split("&"):
        if "=" in pair:
            k, v = pair.split("=", 1)
            out[_url_decode(k)] = _url_decode(v)
    return out


def start_provisioning(current=None):
    cfg = dict(DEFAULTS)
    if current:
        cfg.update(current)
    # mqtt_port в форму отдаём строкой, но в JSON хотим число — нормализуем ниже

    # ВАЖНО: CYW43 (Pico W / 2 W) НЕ умеет STA и AP одновременно.
    # Если STA уже активен (main подключался к Wi-Fi) — точка не поднимется.
    # Поэтому принудительно гасим STA перед запуском AP.
    try:
        sta = network.WLAN(network.STA_IF)
        sta.active(False)
        time.sleep(0.5)
    except Exception as e:
        print("STA off warn:", e)

    ap = network.WLAN(network.AP_IF)
    ap.active(False)
    time.sleep(0.3)
    ap.config(essid=AP_SSID, password=AP_PASS)
    ap.active(True)
    for _ in range(20):
        if ap.active():
            break
        time.sleep(0.3)
    print("PROVISIONING AP:", AP_SSID, "| active:", ap.active(),
          "| ifconfig:", ap.ifconfig())   # шлюз обычно 192.168.4.1
    print("Подключись телефоном к сети", AP_SSID,
          "и открой http://192.168.4.1")

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", 80))
    s.listen(1)

    while True:
        cl, addr = s.accept()
        try:
            req = cl.recv(1024)
            if not req:
                cl.close()
                continue
            first = req.decode().split("\r\n", 1)[0]   # "GET /save?... HTTP/1.1"
            path = first.split(" ")[1] if " " in first else "/"

            if path.startswith("/save?"):
                cfg.update(_parse_qs(path.split("?", 1)[1]))
                # mqtt_port из формы приходит строкой — приводим к int
                try:
                    cfg["mqtt_port"] = int(cfg.get("mqtt_port", 1883))
                except (ValueError, TypeError):
                    cfg["mqtt_port"] = 1883
                save_config(cfg)
                print("Конфиг сохранён:", {k: cfg[k] for k in cfg
                                           if k != "wifi_pass" and k != "mqtt_pass"})
                cl.send(_OK)
                cl.close()
                time.sleep(1)
                machine.reset()
            else:
                cl.send(_PAGE.format(**cfg))
                cl.close()
        except Exception as e:
            print("prov error:", e)
            try:
                cl.close()
            except Exception:
                pass


def get_config():
    """Главная точка входа для main.py. Вернёт валидный config либо уйдёт
    в провижининг (он блокирует и заканчивается перезагрузкой)."""
    cfg = load_config()
    if _forced() or not config_valid(cfg):
        print("Нет валидного конфига или зажата кнопка — режим настройки")
        start_provisioning(current=cfg)
        # сюда не возвращаемся: start_provisioning делает machine.reset()
    return cfg


# ----------------------------------------------------------------------------
#  Прямой запуск файла (Run в Thonny) = принудительный тест точки доступа.
#  При импорте из main.py этот блок НЕ выполняется.
# ----------------------------------------------------------------------------
if __name__ == "__main__":
    print("=== ТЕСТ ПРОВИЖИНИНГА: принудительно поднимаю точку доступа ===")
    start_provisioning(current=load_config())