-- ============================================================================
--  Hardware Bridge migration
--
--  1. Bay: lastSeenAt + lastRelayState  (heartbeat от Pico)
--  2. HardwareEvent                     (ежедневный отчёт от Pico)
--  3. PaymentMethod enum: добавить cash (для купюроприёмника)
-- ============================================================================

-- 1. Bay — поля heartbeat
ALTER TABLE "bays"
  ADD COLUMN "last_seen_at"     TIMESTAMP(3),
  ADD COLUMN "last_relay_state" JSONB;

-- 2. HardwareEvent — лог-строки из ежедневного отчёта Pico
CREATE TABLE "hardware_events" (
  "id"               TEXT         NOT NULL,
  "bay_id"           TEXT         NOT NULL,
  "tenant_id"        TEXT         NOT NULL,
  "event_type"       TEXT         NOT NULL,   -- cash | online | usage | anomaly
  "amount_azn"       DECIMAL(10,2),
  "pulses"           INTEGER,
  "tx_id"            TEXT,                    -- ссылка на Transaction.id (online)
  "program_name"     TEXT,
  "duration_seconds" INTEGER,
  "relay_combo"      TEXT[]       NOT NULL DEFAULT '{}',
  "report_date"      TEXT         NOT NULL,   -- YYYY-MM-DD
  "raw_ts"           TEXT         NOT NULL,   -- ISO-таймстамп от Pico
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "hardware_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hardware_events_bay_id_fkey"
    FOREIGN KEY ("bay_id") REFERENCES "bays"("id") ON DELETE RESTRICT,
  CONSTRAINT "hardware_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
);

CREATE INDEX "hardware_events_bay_id_report_date_idx"
  ON "hardware_events"("bay_id", "report_date");

CREATE INDEX "hardware_events_tenant_id_report_date_idx"
  ON "hardware_events"("tenant_id", "report_date");

-- 3. PaymentMethod enum: добавить 'cash'
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'cash';
