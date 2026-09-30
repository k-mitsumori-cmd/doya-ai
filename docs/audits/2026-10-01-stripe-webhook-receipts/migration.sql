-- Apply before deploying code that reads StripeWebhookEvent.
-- The table contains Stripe event identifiers and processing state only, never payloads or secrets.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS "StripeWebhookEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "firstReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "claimToken" TEXT,
  CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StripeWebhookEvent_status_lastReceivedAt_idx"
  ON "StripeWebhookEvent"("status", "lastReceivedAt");
CREATE INDEX IF NOT EXISTS "StripeWebhookEvent_lastReceivedAt_idx"
  ON "StripeWebhookEvent"("lastReceivedAt");

COMMIT;
