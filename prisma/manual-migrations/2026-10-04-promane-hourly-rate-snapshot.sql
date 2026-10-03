-- Run before deploying code that reads hourlyRateSnapshot, and repeat after deployment
-- to capture rows created by older app instances during the rollout.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "promane_time_entries"
  ADD COLUMN IF NOT EXISTS "hourlyRateSnapshot" INTEGER;

-- Historical rates are unavailable. Freeze each existing row at the member's
-- current rate; do not alter snapshots already written by the new application.
UPDATE "promane_time_entries" AS entry
SET "hourlyRateSnapshot" = GREATEST(0, member."hourlyRate")
FROM "promane_members" AS member
WHERE entry."memberId" = member.id
  AND entry."hourlyRateSnapshot" IS NULL;
