-- ============================================================================
--  Whole-AZN charge step
--
--  Железо (Raspberry Pi Pico) зачисляет только ЦЕЛЫЕ AZN: 1 пачка импульсов =
--  1 AZN, дробные суммы прошивка отклоняет. Дробный chargeStep (например 0.50)
--  порождал суммы вида 1.50 / 2.50, которые аппарат не может зачислить.
--
--  1. Меняем дефолт chargeStep на целый 1.00.
--  2. Нормализуем существующих арендаторов: округляем дробные min/step ВВЕРХ
--     до ближайшего целого AZN, чтобы они перестали предлагать дробные суммы.
-- ============================================================================

-- 1. Новый дефолт шага
ALTER TABLE "tenants" ALTER COLUMN "chargeStep" SET DEFAULT 1.00;

-- 2. Нормализация существующих значений до целого AZN (округление вверх)
UPDATE "tenants"
   SET "chargeStep" = CEIL("chargeStep")
 WHERE "chargeStep" <> CEIL("chargeStep");

UPDATE "tenants"
   SET "minChargeAmount" = CEIL("minChargeAmount")
 WHERE "minChargeAmount" <> CEIL("minChargeAmount");
