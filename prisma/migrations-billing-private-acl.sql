-- Prepared only; not applied to production. Server-owned billing tables only.
BEGIN;
REVOKE ALL ON TABLE "StripeWebhookEvent" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "StripeWebhookNotification" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "account_companies" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "account_company_members" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "account_company_billing" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "doya_power_accounts" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "doya_power_grants" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "doya_power_transactions" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE "doya_power_starter_claims" FROM PUBLIC, anon, authenticated;
COMMIT;
