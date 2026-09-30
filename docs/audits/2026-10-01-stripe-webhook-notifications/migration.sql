-- Apply and verify before deploying code that writes StripeWebhookNotification.
-- Additive table only; existing billing and receipt rows are unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS "StripeWebhookNotification" (
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseExpiresAt" TIMESTAMP(3),
  "claimToken" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "StripeWebhookNotification_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX IF NOT EXISTS "StripeWebhookNotification_status_nextAttemptAt_createdAt_idx"
  ON "StripeWebhookNotification"("status", "nextAttemptAt", "createdAt");

COMMIT;
