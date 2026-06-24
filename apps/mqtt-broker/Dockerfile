FROM eclipse-mosquitto:2.0

# Копируем конфиг — пароли и сертификаты монтируются как volumes
COPY mosquitto.conf /mosquitto/config/mosquitto.conf
COPY acl/acl.conf /mosquitto/config/acl/acl.conf

# Директории для данных и логов создаются автоматически Mosquitto
# Убеждаемся что у пользователя mosquitto есть права
RUN chown -R mosquitto:mosquitto /mosquitto/data /mosquitto/log

EXPOSE 1883
# EXPOSE 8883
# EXPOSE 9001
