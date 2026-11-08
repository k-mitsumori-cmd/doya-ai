-- Add only the missing company/tool-organization attribution table.
-- Run atomically with the reviewed migration client. Existing rows/tables are not changed.
CREATE TABLE IF NOT EXISTS public."account_company_tool_orgs" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "tool" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "linkedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_company_tool_orgs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_company_tool_orgs_tool_check" CHECK ("tool" IN ('kintai','hr','quote','income','expense','promane','sfa','shodan','aio','mensetsu','aishodan'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "account_company_tool_orgs_tool_organizationId_key" ON public."account_company_tool_orgs" ("tool","organizationId");
CREATE INDEX IF NOT EXISTS "account_company_tool_orgs_companyId_idx" ON public."account_company_tool_orgs" ("companyId");
ALTER TABLE public."account_company_tool_orgs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public."account_company_tool_orgs" FROM PUBLIC, anon, authenticated;
