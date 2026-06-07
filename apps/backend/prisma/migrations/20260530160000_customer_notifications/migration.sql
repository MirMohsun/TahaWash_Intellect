-- Per-customer in-app notification inbox (populated when a super-admin
-- broadcast is delivered; future transactional types reuse this table).
CREATE TABLE "customer_notifications" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pushNotificationId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'broadcast',
    "titleAz" TEXT NOT NULL,
    "titleRu" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "bodyAz" TEXT NOT NULL,
    "bodyRu" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_notifications_customerId_createdAt_idx" ON "customer_notifications"("customerId", "createdAt" DESC);
CREATE INDEX "customer_notifications_customerId_readAt_idx" ON "customer_notifications"("customerId", "readAt");

ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
