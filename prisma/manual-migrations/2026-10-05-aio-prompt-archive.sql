-- Apply before deploying code that reads AioPrompt.archivedAt.
-- Additive and repeatable; existing prompts remain active.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "aio_prompts"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
