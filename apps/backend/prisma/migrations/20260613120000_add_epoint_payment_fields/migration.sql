-- AlterTable: encrypted ePoint private_key on tenants (AES-256-GCM "v1.iv.tag.ct").
-- The public_key already lives in ePointMerchantId.
ALTER TABLE "tenants" ADD COLUMN "ePointPrivateKeyEnc" TEXT;

-- Saved cards are now scoped PER-MERCHANT (ePoint card tokens are issued by a
-- specific merchant). Existing rows are pre-payment mock/dev tokens that can
-- never be charged, so we clear them before adding the required tenantId rather
-- than backfilling a meaningless tenant.
DELETE FROM "saved_cards";

-- AlterTable
ALTER TABLE "saved_cards" ADD COLUMN "tenantId" TEXT NOT NULL;

-- DropIndex
DROP INDEX "saved_cards_customerId_idx";

-- CreateIndex
CREATE INDEX "saved_cards_customerId_tenantId_idx" ON "saved_cards"("customerId", "tenantId");

-- CreateIndex
CREATE INDEX "saved_cards_tenantId_idx" ON "saved_cards"("tenantId");

-- AddForeignKey
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
