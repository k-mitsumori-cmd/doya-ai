-- Match the currently published company invitation API: admin, member, guest.
ALTER TABLE public."account_company_members"
  DROP CONSTRAINT "account_company_members_role_check",
  ADD CONSTRAINT "account_company_members_role_check" CHECK ("role" IN ('admin','member','guest'));
