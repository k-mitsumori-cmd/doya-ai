# SFA team table direct-access protection — 2026-11-09

A readonly production catalog audit compared 266 Prisma models, their supported scalar nullability, primary keys and unique keys. The 260 existing model tables had no missing columns or compared key/nullability differences. Six absent models belong to currently disabled features. This does not validate every type, default, foreign key, CHECK or RLS policy.

The audit found sfa_teams and sfa_team_members with RLS disabled and all table privileges granted to anon/authenticated. Both tables contained zero rows at preflight. No external customer-data access or anonymous production write was attempted. Source consumers use trusted server-side Prisma.

Reviewed SQL SHA256: `ff67ce82a6892cea81e7dc6b13fe1571a1e53e6bdf1b95f65d3bb221645474ea`. The new manual migration enables RLS only on these two existing tables and revokes their privileges from PUBLIC, anon and authenticated. It creates no policies, alters no rows or schema fields, and preserves forced-RLS state, owner, constraints, indexes and other-table postures. Apply it after `prisma/manual-migrations/2026-10-30-sfa-record-scope.sql`; do not edit the historical applied migration or use a blanket schema push.

The runner requires the reviewed SHA, confirms a trusted server role can bypass RLS and retains CRUD privileges, refuses privileged public roles, locks only the two targets, and applies all three statements in one transaction. Lock timeout is 3 seconds; statement timeout 15 seconds. Existing protected state is a no-op. If error/timeout leaves commit status uncertain, reconcile with readonly preflight before any retry. Do not disable RLS as an automatic rollback.

```sh
node scripts/migrations/sfa-team-table-rls.cjs preflight unused /tmp/sfa-team-rls-preflight.json
node scripts/migrations/sfa-team-table-rls.cjs apply ff67ce82a6892cea81e7dc6b13fe1571a1e53e6bdf1b95f65d3bb221645474ea /tmp/sfa-team-rls-applied.json
```

Use existing secure environment injection, without saving or printing credentials. CI invokes only the fresh private Unix-socket PostgreSQL regression; it never applies production DDL. Fourteen conditions cover broad old grants, reviewed-SHA enforcement, denial of both public roles, all seven privilege kinds, trusted Prisma CRUD/cascade, unchanged existing synthetic data, idempotence, unsafe role posture, missing tables and partial privilege drift. The owned database is stopped.

Production repair was applied at 2026-11-08T20:24:46.033Z under existing user authorization to repair production. Both tables remained empty. Readonly postflight confirmed RLS on and all 28 public-role privilege checks false, unchanged constraints/indexes/policies/other-table postures, and a trusted server role retaining access. A repeat full catalog check found no existing model table with a direct anon/authenticated grant while RLS is disabled. This last check does not certify the semantics of every enabled RLS policy or all external exposure paths. Actual authorized production team CRUD, wider role flows and financial acceptance remain separate.
