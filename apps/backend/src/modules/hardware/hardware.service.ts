import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import type { Env } from '../../config/env.schema';
import type { MqttControlCommand, MqttStatusEvent } from './dto/mqtt-events.dto';

type StatusHandler = (hardwareId: string, event: MqttStatusEvent) => void;

/**
 * Управляет MQTT-соединением бэкэнда с Mosquitto-брокером.
 *
 * Жизненный цикл:
 *   onModuleInit  → connect + subscribe на wildcard-топик статуса
 *   onModuleDestroy → корректный disconnect
 *
 * Публичный API:
 *   publish(hardwareId, command)  — отправить команду на конкретный Pico
 *   onStatus(handler)             — зарегистрировать обработчик входящих событий
 */
@Injectable()
export class HardwareService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HardwareService.name);
  private client!: mqtt.MqttClient;
  private readonly handlers: StatusHandler[] = [];

  constructor(private readonly config: ConfigService<Env, true>) {}

  async onModuleInit() {
    const url = this.config.get('MQTT_URL', { infer: true });
    const username = this.config.get('MQTT_USERNAME', { infer: true });
    const password = this.config.get('MQTT_PASSWORD', { infer: true });

    this.client = mqtt.connect(url, {
      username,
      password,
      clientId: `tahawash-backend-${process.pid}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10_000,
    });

    this.client.on('connect', () => {
      this.logger.log(`MQTT connected: ${url}`);
      // Подписываемся на статус со ВСЕХ устройств
      this.client.subscribe('tahawash/hardware/+/status', { qos: 1 }, (err) => {
        if (err) this.logger.error('MQTT subscribe error', err);
        else this.logger.log('MQTT subscribed: tahawash/hardware/+/status');
      });
    });

    this.client.on('message', (topic, payload) => {
      this.handleIncoming(topic, payload);
    });

    this.client.on('error', (err) => {
      this.logger.error('MQTT error', err);
    });

    this.client.on('reconnect', () => {
      this.logger.warn('MQTT reconnecting...');
    });

    this.client.on('offline', () => {
      this.logger.warn('MQTT offline');
    });
  }

  async onModuleDestroy() {
    await new Promise<void>((resolve, reject) => {
      this.client.end(false, {}, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    this.logger.log('MQTT disconnected');
  }

  /**
   * Опубликовать команду на конкретный Pico.
   * hardwareId = Bay.hardwareIdentifier = HARDWARE_ID в прошивке.
   */
  async publish(hardwareId: string, command: MqttControlCommand): Promise<void> {
    const topic = `tahawash/hardware/${hardwareId}/control`;
    const payload = JSON.stringify(command);
    await new Promise<void>((resolve, reject) => {
      this.client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
          this.logger.error(`MQTT publish error → ${topic}`, err);
          reject(err);
        } else {
          this.logger.debug(`MQTT → ${topic}: ${payload}`);
          resolve();
        }
      });
    });
  }

  /**
   * Зарегистрировать обработчик входящих событий от Pico.
   * HardwareListenerService вызывает это в своём onModuleInit.
   */
  onStatus(handler: StatusHandler): void {
    this.handlers.push(handler);
  }

  private handleIncoming(topic: string, payload: Buffer): void {
    // Формат топика: tahawash/hardware/{hardwareId}/status
    const parts = topic.split('/');
    if (parts.length !== 4 || parts[3] !== 'status') return;
    const hardwareId = parts[2];

    let event: MqttStatusEvent;
    try {
      event = JSON.parse(payload.toString()) as MqttStatusEvent;
    } catch {
      this.logger.warn(`MQTT invalid JSON from ${hardwareId}: ${payload.toString().slice(0, 100)}`);
      return;
    }

    this.logger.debug(`MQTT ← ${hardwareId}: ${event.type}`);
    for (const handler of this.handlers) {
      try {
        handler(hardwareId, event);
      } catch (err) {
        this.logger.error(`Status handler error for ${event.type}`, err as Error);
      }
    }
  }
}
