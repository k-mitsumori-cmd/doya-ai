-- Apply before deploying the SFA record-scope implementation.
-- Additive and repeatable. No business-row ownership/sharing backfill.
-- Existing unassigned records stay unassigned; only administrators can resolve them.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "sfa_accounts" ADD COLUMN IF NOT EXISTS "isShared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sfa_contacts" ADD COLUMN IF NOT EXISTS "ownerMemberId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "sfa_members_organizationId_id_key" ON "sfa_members" ("organizationId", "id");

CREATE TABLE IF NOT EXISTS "sfa_teams" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sfa_teams_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sfa_teams_name_check" CHECK (length(btrim("name")) > 0 AND "name" = btrim("name")),
  CONSTRAINT "sfa_teams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "sfa_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "sfa_teams_organizationId_id_key" ON "sfa_teams" ("organizationId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "sfa_teams_organizationId_name_key" ON "sfa_teams" ("organizationId", "name");

CREATE TABLE IF NOT EXISTS "sfa_team_members" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sfa_team_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sfa_team_members_organizationId_teamId_fkey" FOREIGN KEY ("organizationId", "teamId") REFERENCES "sfa_teams"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sfa_team_members_organizationId_memberId_fkey" FOREIGN KEY ("organizationId", "memberId") REFERENCES "sfa_members"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "sfa_team_members_organizationId_teamId_memberId_key" ON "sfa_team_members" ("organizationId", "teamId", "memberId");
CREATE INDEX IF NOT EXISTS "sfa_team_members_organizationId_memberId_idx" ON "sfa_team_members" ("organizationId", "memberId");
CREATE INDEX IF NOT EXISTS "sfa_accounts_organizationId_ownerMemberId_idx" ON "sfa_accounts" ("organizationId", "ownerMemberId");
CREATE INDEX IF NOT EXISTS "sfa_accounts_organizationId_isShared_idx" ON "sfa_accounts" ("organizationId", "isShared");
CREATE INDEX IF NOT EXISTS "sfa_contacts_organizationId_ownerMemberId_idx" ON "sfa_contacts" ("organizationId", "ownerMemberId");
CREATE INDEX IF NOT EXISTS "sfa_leads_organizationId_assigneeMemberId_idx" ON "sfa_leads" ("organizationId", "assigneeMemberId");
CREATE INDEX IF NOT EXISTS "sfa_deals_organizationId_assigneeMemberId_idx" ON "sfa_deals" ("organizationId", "assigneeMemberId");
CREATE INDEX IF NOT EXISTS "sfa_activities_organizationId_memberId_idx" ON "sfa_activities" ("organizationId", "memberId");
COMMIT;
