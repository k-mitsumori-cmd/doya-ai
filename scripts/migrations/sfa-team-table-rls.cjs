const fs = require('node:fs');
const crypto = require('node:crypto');
const sqlPath = require('node:path').resolve(__dirname, '../../prisma/manual-migrations/2026-11-09-sfa-team-rls.sql');
const sqlSha = "ff67ce82a6892cea81e7dc6b13fe1571a1e53e6bdf1b95f65d3bb221645474ea";
const requireState = (ok, code) => { if (!ok) throw Object.assign(Error(code), { code }); };
async function state(tx) {
  const actor = (await tx.$queryRawUnsafe("SELECT rolsuper AS superuser,rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user"))[0];
  const tables = await tx.$queryRawUnsafe("SELECT c.relname AS name,c.relrowsecurity AS rls,c.relforcerowsecurity AS forced,c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) AS actorOwns,has_table_privilege(current_user,c.oid,'SELECT') AS actorSelect,has_table_privilege(current_user,c.oid,'INSERT') AS actorInsert,has_table_privilege(current_user,c.oid,'UPDATE') AS actorUpdate,has_table_privilege(current_user,c.oid,'DELETE') AS actorDelete FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('sfa_teams','sfa_team_members') ORDER BY c.relname");
  requireState(tables.length === 2, 'TARGET_TABLES_MISSING');
  const roles = await tx.$queryRawUnsafe("SELECT r.rolname AS name,r.rolsuper AS superuser,r.rolbypassrls AS bypass,EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('sfa_teams','sfa_team_members') AND c.relowner=r.oid) AS ownsTarget FROM pg_roles r WHERE r.rolname IN ('anon','authenticated') ORDER BY r.rolname");
  const grants = await tx.$queryRawUnsafe("SELECT c.relname AS table,r.rolname AS role,p.privilege,has_table_privilege(r.oid,c.oid,p.privilege) AS granted FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege) WHERE n.nspname='public' AND c.relname IN ('sfa_teams','sfa_team_members') AND r.rolname IN ('anon','authenticated') ORDER BY c.relname,r.rolname,p.privilege");
  const columns = await tx.$queryRawUnsafe("SELECT table_name,column_name,ordinal_position,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('sfa_teams','sfa_team_members') ORDER BY table_name,ordinal_position");
  const constraints = await tx.$queryRawUnsafe("SELECT conrelid::regclass::text AS table,conname AS name,contype::text AS type,convalidated AS validated,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('public.sfa_teams'::regclass,'public.sfa_team_members'::regclass) ORDER BY conrelid::regclass::text,conname");
  const indexes = await tx.$queryRawUnsafe("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('sfa_teams','sfa_team_members') ORDER BY tablename,indexname");
  const policies = await tx.$queryRawUnsafe("SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('sfa_teams','sfa_team_members') ORDER BY tablename,policyname");
  const counts = [];
  for (const table of ['sfa_teams', 'sfa_team_members']) {
    const n = (await tx.$queryRawUnsafe('SELECT count(*)::int AS n FROM public."' + table + '"'))[0].n;
    counts.push({ table, count: n });
  }
  const other = await tx.$queryRawUnsafe("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname NOT IN ('sfa_teams','sfa_team_members') ORDER BY c.relname");
  return { actor, tables, roles, grants, columns, constraints, indexes, policies, counts, otherTablePosturesSha: crypto.createHash('sha256').update(JSON.stringify(other)).digest('hex') };
}
function safeServer(s) {
  requireState(s.roles.length === 2 && s.roles.every(r => !r.superuser && !r.bypass && !r.ownstarget), 'PUBLIC_ROLE_POSTURE_UNSAFE');
  requireState(s.tables.every(t => t.actorselect && t.actorinsert && t.actorupdate && t.actordelete && (s.actor.superuser || s.actor.bypass || (t.actorowns && !t.forced))), 'SERVER_ROLE_COULD_BE_BLOCKED');
}
function protectedState(s) { return s.tables.every(t => t.rls) && s.grants.every(g => !g.granted); }
async function preflight(db) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const readOnly = (await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS v"))[0].v === 'on';
    requireState(readOnly, 'READONLY_REQUIRED');
    const before = await state(tx);
    safeServer(before);
    return { mode: 'preflight', readOnly, sqlSha, before, alreadyProtected: protectedState(before), mutationPerformed: false };
  }, { isolationLevel: 'RepeatableRead', timeout: 30000 });
}
async function apply(db, reviewedSha) {
  requireState(reviewedSha === sqlSha, 'REVIEWED_SQL_SHA_REQUIRED');
  const text = fs.readFileSync(sqlPath, 'utf8');
  requireState(crypto.createHash('sha256').update(text).digest('hex') === sqlSha, 'SQL_CHANGED');
  const statements = text.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').split(';').map(s => s.trim()).filter(Boolean);
  requireState(statements.length === 3, 'UNEXPECTED_SQL');
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout='3s'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout='15s'");
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(611090115)');
    await tx.$executeRawUnsafe('LOCK TABLE public.sfa_teams, public.sfa_team_members IN ACCESS EXCLUSIVE MODE');
    const before = await state(tx);
    safeServer(before);
    if (protectedState(before)) return { mode: 'apply', sqlSha, before, after: before, idempotentNoop: true, mutationPerformed: false };
    for (const sql of statements) await tx.$executeRawUnsafe(sql);
    const after = await state(tx);
    safeServer(after);
    requireState(protectedState(after), 'PUBLIC_ACCESS_NOT_BLOCKED');
    for (const key of ['actor', 'roles', 'columns', 'constraints', 'indexes', 'policies', 'counts', 'otherTablePosturesSha']) {
      requireState(JSON.stringify(before[key]) === JSON.stringify(after[key]), 'UNRELATED_STATE_CHANGED');
    }
    requireState(before.tables.every((t, i) => t.forced === after.tables[i].forced && t.actorowns === after.tables[i].actorowns), 'TABLE_OWNER_OR_FORCED_RLS_CHANGED');
    return { mode: 'apply', sqlSha, before, after, mutationPerformed: true, protectedTwoTablesOnly: true, dataDmlStatements: 0, otherTablePosturesUnchanged: true };
  }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 });
}
module.exports = { preflight, apply, state, sqlSha };
if (require.main === module) {
  const root = require('node:path').resolve(__dirname, '../..');
  const { PrismaClient } = require(root + '/node_modules/@prisma/client');
  const u = new URL(process.env.DATABASE_URL);
  for (const [k, v] of Object.entries({ pgbouncer: 'true', connection_limit: '3', sslmode: 'require', connect_timeout: '30', pool_timeout: '30' })) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
  const db = new PrismaClient({ datasources: { db: { url: u.toString() } } });
  const mode = process.argv[2], reviewed = process.argv[3], out = process.argv[4];
  requireState(['preflight', 'apply'].includes(mode) && out, 'MODE_AND_OUTPUT_REQUIRED');
  (async () => {
    let report;
    try {
      report = mode === 'preflight' ? await preflight(db) : await apply(db, reviewed);
      report = { checkedAt: new Date().toISOString(), ...report, financialActions: 0, messagesSent: 0 };
    } catch (e) {
      report = { checkedAt: new Date().toISOString(), mode, failed: true, code: e.code || e.constructor.name, sqlState: /^[A-Z0-9]{5}$/.test(e.meta?.code || '') ? e.meta.code : null, commitStateOnError: 'reconcile-readonly-before-retrying' };
      process.exitCode = 1;
    } finally { await db.$disconnect(); }
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ mode, failed: report.failed, mutationPerformed: report.mutationPerformed, alreadyProtected: report.alreadyProtected, code: report.code }));
  })();
}
