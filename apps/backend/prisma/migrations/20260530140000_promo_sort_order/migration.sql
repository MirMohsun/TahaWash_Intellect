-- Super-admin-controlled promo carousel order. Existing rows default to 0
-- (they then fall back to createdAt-desc ordering until reordered).
ALTER TABLE "promos" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
