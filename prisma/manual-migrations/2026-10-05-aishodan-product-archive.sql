-- Apply before deploying code that reads AishodanProduct.archivedAt.
-- Additive and repeatable; existing products remain active.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "aishodan_products"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
