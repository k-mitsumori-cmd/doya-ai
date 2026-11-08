# Company guest role CHECK recovery — 2026-11-09

The current pricing member API accepts admin/member/guest even while COMPANY_ROLES_ROLLOUT is off. The old production CHECK accepted only admin/member and rejected readonly guest invitations. Do not activate manager/billing or change the rollout flag for this repair.

Reviewed SQL SHA256: `2534eb40a638bdb4254301dc7c9f97e1f29477409da5ce6aaa335d19ba948ef0`. SQL changes only the named role CHECK to admin/member/guest. The portable runner requires this exact SHA for apply, accepts only the old two-role shape or the exact current three-role shape, and refuses future five-role schemas. It compares row counts grouped by role, other constraints, indexes and RLS before/after. It uses an atomic transaction, advisory lock, a 3-second lock timeout and 15-second statement timeout. No data update or automatic compensation is performed. If locking/drift fails, inspect and retry only after review.

Production repair applied at 2026-11-08T19:17:02.480Z under the existing user authorization to repair production. Readonly preflight and postflight verified three allowed roles, zero member rows, unchanged other constraints/indexes/RLS. No real invitation, email, seat purchase, subscription quantity or payment was created. The wider company-role migration remains gated and separate.

Run from the project root with existing environment injection, without saving credentials:

```sh
node scripts/migrations/company-guest-role.cjs preflight unused /tmp/company-guest-role-preflight.json
node scripts/migrations/company-guest-role.cjs apply 2534eb40a638bdb4254301dc7c9f97e1f29477409da5ce6aaa335d19ba948ef0 /tmp/company-guest-role-applied.json
```

Preflight is readonly. Apply is an explicit production operation; CI never runs it against an application environment. Prefer readonly postflight once already applied; the reviewed apply is idempotent on the exact three-role schema. Do not broadly push the Prisma schema, narrow a later five-role CHECK, or disable RLS.

Private CI invokes `python3 scripts/security-regression/verify-company-guest-role-postgres.py`. Its temporary Unix-socket PostgreSQL inherits no application credentials. The actual pricing POST/GET and seat helpers run against synthetic rows: old guest denial, repaired guest creation with full legacy seats and no paid-seat consumption, member/admin shortage denial, invalid roles denied by API and DB, unchanged provider state, idempotency and future-schema refusal. Twelve conditions pass and the owned database is stopped. Real production guest writes and real financial flows remain unaccepted.
