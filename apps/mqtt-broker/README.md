# Tahawash — MQTT Broker (Mosquitto)

Mosquitto 2.0 брокер для связи NestJS-бэкэнда с Raspberry Pi Pico 2W.

## Топики

```
tahawash/hardware/{hardwareId}/control   бэкэнд → Pico (команды)
tahawash/hardware/{hardwareId}/status    Pico → бэкэнд (события)
```

`hardwareId` = `Bay.hardwareIdentifier` в базе данных = `HARDWARE_ID` в прошивке Pico.

## Первый запуск (локально)

### 1. Создать файл паролей

```bash
# Войти в контейнер (брокер должен быть запущен)
docker compose up -d mosquitto

# Создать пользователей (вводить пароли интерактивно)
docker compose exec mosquitto mosquitto_passwd -c /mosquitto/config/passwd/devices.txt tahawash-backend
docker compose exec mosquitto mosquitto_passwd    /mosquitto/config/passwd/devices.txt tahawash-device
docker compose exec mosquitto mosquitto_passwd    /mosquitto/config/passwd/devices.txt healthcheck

# Перезапустить чтобы брокер подхватил файл паролей
docker compose restart mosquitto
```

Пароли записать в `.env`:
```
MQTT_URL=mqtt://localhost:1883
MQTT_USERNAME=tahawash-backend
MQTT_PASSWORD=<пароль, который ввели для tahawash-backend>
MQTT_DEVICE_USERNAME=tahawash-device
MQTT_DEVICE_PASSWORD=<пароль для tahawash-device — вписать в main.py на Pico>
```

### 2. Проверить подключение

```bash
# Подписаться на все топики (в одном терминале)
mosquitto_sub -h localhost -p 1883 -u tahawash-backend -P <пароль> -t 'tahawash/hardware/#' -v

# Отправить тестовую команду (в другом терминале)
mosquitto_pub -h localhost -p 1883 -u tahawash-backend -P <пароль> \
  -t 'tahawash/hardware/tahawash-wash-01/control' \
  -m '{"type":"get_report"}'
```

## Добавление нового Pico

1. В базе данных: создать Bay, задать `hardwareIdentifier` = уникальный ID (например `tahawash-wash-02`)
2. В прошивке Pico: `HARDWARE_ID = "tahawash-wash-02"`, `MQTT_USER = "tahawash-device"`, `MQTT_PASSWORD = <пароль>`
3. ACL обновлять **не нужно** — все Pico используют один логин `tahawash-device` с доступом к `tahawash/hardware/#`

## Структура файлов

```
apps/mqtt-broker/
├── mosquitto.conf       конфиг брокера
├── acl/acl.conf         правила доступа
├── passwd/
│   ├── .gitignore       devices.txt не коммитится
│   └── devices.txt.example  пример структуры
├── certs/
│   └── .gitignore       сертификаты не коммитятся
└── Dockerfile
```
