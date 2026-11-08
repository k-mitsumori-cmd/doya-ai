// Actual invitation/context/role modules against a private Unix PostgreSQL.
// All sessions, rollouts, prices, recipients and mail delivery are synthetic.
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const privateEnv = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), state = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const u = new URL(privateEnv.DATABASE_URL);
assert.equal(u.hostname, 'localhost');
assert.equal(u.username, 'doya_seat_test');
assert(u.pathname.startsWith('/doya_seat_models_'));
assert(u.searchParams.get('host') === state.socket && state.socket.startsWith('/tmp/doya-seat-models-'));
assert.equal(privateEnv.DATABASE_URL, privateEnv.DIRECT_URL);
process.env.DATABASE_URL = privateEnv.DATABASE_URL;
process.env.DIRECT_URL = privateEnv.DIRECT_URL;
const { PrismaClient } = require(path.join(root, 'node_modules/@prisma/client'));
let captureRoleQueries = false;
const capturedRoleQueryTables = new Set();
const db = new PrismaClient({ datasources: { db: { url: privateEnv.DATABASE_URL } }, log: [{ emit: 'event', level: 'query' }] });
db.$on('query', event => { if (!captureRoleQueries)
    return; const q = event.query.replaceAll(String.fromCharCode(34), '').replace(/\s+/g, ' ').toLowerCase(); for (const match of q.matchAll(/\b(?:from|join)\s+(?:public\.)?(user|account_companies|account_company_tool_orgs|account_company_members)\b/g))
    capturedRoleQueryTables.add(match[1]); });
const ts = require(path.join(root, 'node_modules/typescript'));
let actorId = '', actorEmail = '', afterCeiling = null, afterTxCeiling = null, mailCalls = 0, rolesMode = 'enforce', pricingRollout = 'all';
const mutators = [];
const cache = new Map(), bindings = {};
const accessFile = 'src/lib/mensetsu/access.ts', roleFile = 'src/lib/company-roles/access.server.ts';
// This legacy suite isolates current company authority, including hidden authority tables.
// Shared paid reservation/identity admission is separately exercised against real SQL65.
class LegacyInvitationDomainError extends Error { constructor(kind){super(kind);this.kind=kind} }
const legacySeatBoundary={ToolSeatInvitationDomainError:LegacyInvitationDomainError,toolSeatInvitationFailure:error=>error instanceof LegacyInvitationDomainError?{status:error.kind==='missing'?404:403,body:{error:error.kind}}:null,withToolSeatInvitation:async(input,authorize,work)=>db.$transaction(async tx=>{const role=await load(roleFile).ceilToolRole({tool:input.tool,organizationId:input.organizationId,userId:input.actorUserId,toolRole:'owner'},tx);if(afterTxCeiling&&role!==null){const hook=afterTxCeiling;afterTxCeiling=null;await hook()}const domain=await authorize(tx,role);return work(tx,domain.value)})};

function resolve(file, n) { let candidate = n.startsWith('@/') ? 'src/' + n.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file), n)); if (!candidate.endsWith('.ts'))
    candidate += '.ts'; return candidate; }
function load(file) {
    if (cache.has(file))
        return cache.get(file);
    assert(file === 'src/app/api/mensetsu/members/route.ts' || file === 'src/lib/html-escape.ts' || file === 'src/lib/private-api-response.ts' || file.startsWith('src/lib/mensetsu/') || file.startsWith('src/lib/company-roles/'), 'Unapproved source ' + file);
    const candidate = process.env.DOYA_TEST_BASELINE && path.join(process.env.DOYA_TEST_BASELINE, file);
    const source = fs.readFileSync(candidate && fs.existsSync(candidate) ? candidate : path.join(root, file), 'utf8');
    bindings[file] = crypto.createHash('sha256').update(source).digest('hex');
    const module = { exports: {} };
    cache.set(file, module.exports);
    function req(n) { if (n === '@/lib/pricing-v2/tool-seat-invitation.server') return legacySeatBoundary; if (n === 'next/server')
        return { NextResponse: Response, NextRequest: Request }; if (n === 'next-auth')
        return { getServerSession: async () => ({ user: { id: actorId, email: actorEmail, name: 'Synthetic actor' } }) }; if (n === '@/lib/auth')
        return { authOptions: {} }; if (n === '@/lib/prisma')
        return { prisma: db }; if (n === '@/lib/email')
        return { sendEmail: async () => { mailCalls++; return { success: true }; } }; if (n === 'crypto' || n === 'node:crypto')
        return crypto; if (n === '@/lib/pricing-v2/rollout')
        return { newPricingRollout: () => pricingRollout }; if (n === '@/lib/pricing-v2/prices')
        return { teamPriceConfig: () => ({ ok: true }) }; if (n.startsWith('@/') || n.startsWith('.')) {
        const f = resolve(file, n);
        if (f === 'src/lib/company-roles/rollout.ts')
            return { companyRolesRollout: () => rolesMode, companyRolesModeFor: () => rolesMode };
        const value = load(f);
        if (f === roleFile)
            return { ...value, ceilToolRole: async (input, tx) => { const role = await value.ceilToolRole(input, tx); if (!tx && afterCeiling && role !== null) {
                    const hook = afterCeiling;
                    afterCeiling = null;
                    await hook();
                } if (tx && afterTxCeiling && role !== null) {
                    const hook = afterTxCeiling;
                    afterTxCeiling = null;
                    await hook();
                } return role; } };
        return value;
    } throw Error('Unapproved import ' + n); }
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(output, { module, exports: module.exports, require: req, URL, Request, Response, Headers, Buffer, TextDecoder, Date, Set, Map, Error, Object, Array, Promise, console: { log() { }, warn() { }, error() { } }, process: { env: {} }, setTimeout, clearTimeout }, { filename: file });
    cache.set(file, module.exports);
    return module.exports;
}
const results = [];
const outputDir = process.env.DOYA_CEILING_EVIDENCE_DIR;
assert(outputDir);
const specs = [
    { name: 'admin-control', initial: 'admin', expected: 200, invites: 1, mail: 1 },
    { name: 'guest-before-context', initial: 'guest', expected: 401, invites: 0, mail: 0 },
    { name: 'tool-role-demotion-after-context', initial: 'admin', toolDemotion: true, expected: 403, invites: 0, mail: 0 },
    { name: 'company-admin-to-member-after-context', initial: 'admin', centralDemotion: 'member', expected: 403, invites: 0, mail: 0, revocation: true },
    { name: 'company-admin-to-guest-after-context', initial: 'admin', centralDemotion: 'guest', expected: 403, invites: 0, mail: 0, revocation: true },
    { name: 'company-membership-removed-after-context', initial: 'admin', removeCentral: true, expected: 403, invites: 0, mail: 0, revocation: true },
    { name: 'unknown-company-role-after-context', initial: 'admin', unknownRole: true, expected: 403, invites: 0, mail: 0, revocation: true },
    { name: 'conflicting-active-company-roles-after-context', initial: 'admin', conflictingRole: true, expected: 403, invites: 0, mail: 0, revocation: true },
    { name: 'demotion-after-fresh-check-waits-for-invite-commit', initial: 'admin', lateDemotion: true, expected: 200, invites: 1, mail: 1 },
    { name: 'roles-off-hidden-company-and-user-tables', initial: 'admin', rolesOff: true, hideTables: true, expected: 200, invites: 1, mail: 1 },
    { name: 'pricing-off-hidden-company-and-user-tables', initial: 'admin', pricingOff: true, hideTables: true, expected: 200, invites: 1, mail: 1 },
    { name: 'shadow-preserves-legacy-authority', initial: 'admin', shadow: true, centralDemotion: 'guest', expected: 200, invites: 1, mail: 1 },
    { name: 'inferred-attribution-never-persists-link', initial: 'admin', unlinkAfterContext: true, expected: 200, invites: 1, mail: 1 },
    { name: 'other-owned-company-never-overrides-org-ceiling', initial: 'admin', otherOwnedCompany: true, centralDemotion: 'guest', expected: 403, invites: 0, mail: 0, revocation: true },
];
(async () => {
    const route = load('src/app/api/mensetsu/members/route.ts');
    let i = 0;
    for (const spec of specs) {
        i++;
        mailCalls = 0;
        rolesMode = spec.rolesOff ? 'off' : spec.shadow ? 'shadow' : 'enforce';
        pricingRollout = spec.pricingOff ? 'off' : 'all';
        afterCeiling = null;
        afterTxCeiling = null;
        const owner = 'ceiling14_owner_' + i;
        actorId = 'ceiling14_actor_' + i;
        actorEmail = 'ceiling14-actor-' + i + '@example.invalid';
        await db.user.createMany({ data: [{ id: owner, email: 'ceiling14-owner-' + i + '@example.invalid', name: 'Synthetic owner' }, { id: actorId, email: actorEmail, name: 'Synthetic actor' }] });
        const company = await db.accountCompany.create({ data: { userId: owner, name: 'Synthetic company' } });
        const membership = await db.accountCompanyMember.create({ data: { companyId: company.id, userId: actorId, email: actorEmail, role: spec.initial, status: 'active' } });
        const org = await db.mensetsuOrganization.create({ data: { name: 'Synthetic interview org', slug: 'ceiling14-org-' + i } });
        await db.mensetsuMember.create({ data: { organizationId: org.id, userId: owner, role: 'owner', status: 'ACTIVE', createdAt: new Date(Date.now() - 10000) } });
        const actor = await db.mensetsuMember.create({ data: { organizationId: org.id, userId: actorId, role: 'admin', status: 'ACTIVE' } });
        await db.accountCompanyToolOrg.create({ data: { tool: 'mensetsu', organizationId: org.id, companyId: company.id, linkedBy: owner } });
        const profilesBefore = await db.accountCompany.count(), centralBefore = await db.accountCompanyMember.count();
        afterCeiling = async () => { if (spec.centralDemotion)
            await db.accountCompanyMember.update({ where: { id: membership.id }, data: { role: spec.centralDemotion } }); if (spec.removeCentral)
            await db.accountCompanyMember.update({ where: { id: membership.id }, data: { status: 'removed' } }); if (spec.unknownRole)
            await db.accountCompanyMember.update({ where: { id: membership.id }, data: { role: 'unknown' } }); if (spec.conflictingRole)
            await db.accountCompanyMember.create({ data: { companyId: company.id, userId: actorId, email: 'ceiling14-alias-' + i + '@example.invalid', role: 'guest', status: 'active' } }); if (spec.toolDemotion)
            await db.mensetsuMember.update({ where: { id: actor.id }, data: { role: 'member' } }); if (spec.unlinkAfterContext)
            await db.accountCompanyToolOrg.deleteMany({ where: { tool: 'mensetsu', organizationId: org.id } }); if (spec.otherOwnedCompany)
            await db.accountCompany.create({ data: { userId: actorId, name: 'Unrelated synthetic company' } }); };
        let lateUpdate = null, lateCompleted = false, lateBlocked = false, lateError = null;
        if (spec.lateDemotion) {
            const mu = new URL(privateEnv.DATABASE_URL);
            mu.searchParams.set('connection_limit', '1');
            const mutator = new PrismaClient({ datasources: { db: { url: mu.toString() } } });
            mutators.push(mutator);
            await mutator.$executeRawUnsafe("SET application_name='ceiling_mutator'");
            afterTxCeiling = async () => { lateUpdate = mutator.accountCompanyMember.update({ where: { id: membership.id }, data: { role: 'guest' } }).then(() => { lateCompleted = true; }, e => { lateError = e; }); for (let n = 0; n < 100; n++) {
                const waiting = await db.$queryRaw `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND application_name='ceiling_mutator' AND wait_event_type='Lock'`;
                if (waiting[0].n > 0) {
                    lateBlocked = true;
                    break;
                }
                if (lateCompleted || lateError)
                    break;
                await new Promise(resolve => setTimeout(resolve, 10));
            } fs.writeFileSync(path.join(outputDir, 'late-lock-observation.json'), JSON.stringify({ checkedAt: new Date().toISOString(), lateCompletedBeforeInviteCommit: lateCompleted, lateBlocked, lateErrorName: lateError?.name || null }, null, 2) + '\n'); assert.equal(lateCompleted, false, 'Late demotion must wait for the shared authority lock'); assert.equal(lateBlocked, true, 'Late demotion must be observed waiting on a real PostgreSQL lock'); };
        }
        const hidden = [['account_company_members', 'ceiling_hidden_members'], ['account_company_tool_orgs', 'ceiling_hidden_links'], ['account_companies', 'ceiling_hidden_companies'], ['User', 'ceiling_hidden_users']];
        const renamed = [];
        const request = () => new Request('http://127.0.0.1/api/mensetsu/members?org=' + org.slug, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'ceiling14-recipient-' + i + '@example.invalid', role: 'member' }) });
        let response;
        try {
            if (spec.hideTables)
                for (const [from, to] of hidden) {
                    await db.$executeRawUnsafe('ALTER TABLE "' + from + '" RENAME TO "' + to + '"');
                    renamed.push([from, to]);
                }
            capturedRoleQueryTables.clear();
            captureRoleQueries = true;
            response = await route.POST(request());
        }
        finally {
            captureRoleQueries = false;
            for (const [from, to] of renamed.reverse())
                await db.$executeRawUnsafe('ALTER TABLE "' + to + '" RENAME TO "' + from + '"');
        }
        if (spec.hideTables)
            assert.equal(capturedRoleQueryTables.size, 0, 'Disabled policy must not query User or company authority tables');
        if (spec.name === 'admin-control') {
            assert(capturedRoleQueryTables.has('user'));
            assert(capturedRoleQueryTables.has('account_company_members'));
        }
        const body = await response.json();
        if (lateUpdate) {
            await lateUpdate;
            assert.equal(lateError, null);
            assert.equal(lateCompleted, true);
        }
        const invites = await db.mensetsuMember.count({ where: { organizationId: org.id, status: 'PENDING' } });
        const current = await db.accountCompanyMember.findUnique({ where: { id: membership.id } });
        assert.equal(response.status, spec.expected, spec.name);
        assert.equal(invites, spec.invites, spec.name);
        assert.equal(mailCalls, spec.mail, spec.name);
        assert.equal(await db.accountCompany.count(), profilesBefore + (spec.otherOwnedCompany ? 1 : 0), 'No automatic company profile');
        assert.equal(await db.accountCompanyMember.count(), centralBefore + (spec.conflictingRole ? 1 : 0), 'No automatic central enrollment');
        const links = await db.accountCompanyToolOrg.count({ where: { tool: 'mensetsu', organizationId: org.id } });
        assert.equal(links, spec.unlinkAfterContext ? 0 : 1, 'No inferred link persistence');
        let afterCompletedDemotionStatus = null;
        if (spec.lateDemotion) {
            assert.equal(current.role, 'guest');
            const followup = await route.POST(request());
            afterCompletedDemotionStatus = followup.status;
            assert.equal(followup.status, 401);
            assert.equal(await db.mensetsuMember.count({ where: { organizationId: org.id, status: 'PENDING' } }), 1);
            assert.equal(mailCalls, 1);
        }
        results.push({ name: spec.name, status: response.status, currentCompanyRole: current.role, currentMembershipStatus: current.status, createdSyntheticInvites: invites, syntheticMailCalls: mailCalls, realMailSends: 0, revocationDenied: !!spec.revocation, lateDemotionObservedBlocked: lateBlocked, afterCompletedDemotionStatus, hiddenTables: spec.hideTables ? hidden.length : 0, capturedAuthorityQueryTables: [...capturedRoleQueryTables].sort(), companyProfileAutoCreation: false, centralAutoEnrollment: false, inferredLinkPersisted: false, returnedInvitation: !!body.member });
    }
    const proof = { checkedAt: new Date().toISOString(), completed: true, count: results.length, baselineGapFixed: true, revocationCases: results.filter(x => x.revocationDenied).length, lateConcurrentDemotionVerified: true, legacyOffTablesUnavailableVerified: true, legacyOffSqlQueryEventsVerified: true, readOnlyAttributionVerified: true, actualRoute: true, actualContext: true, actualCompanyCeilingServerAndPureModules: true, actualPrismaAndPrivatePostgres: true, paidSeatAdmissionExercised: false, recipientIdentityAdapterExercised: false, paidSeatBoundary: 'Explicit legacy financial boundary; actual company ceiling runs in the real transaction. Shared paid admission is covered separately by SQL65.', sourceBindings: bindings, results, syntheticPorts: ['NextAuth session', 'pricing config/rollout', 'company role mode', 'sendEmail stub', 'timing hooks around actual role resolution', 'legacy paid invitation boundary (actual current company ceiling retained)'], realMailSends: 0, realProviderRequests: 0, productionRequests: 0, fixedLocally: true, productionVerified: false, all11IntegrationVerified: false, wholeAuditVerified: false };
    fs.writeFileSync(path.join(outputDir, 'company-ceiling-native-results.json'), JSON.stringify(proof, null, 2) + '\n');
    console.log(JSON.stringify({ count: proof.count, revocationDenied: proof.revocationCases, lateLock: proof.lateConcurrentDemotionVerified, fixedLocally: true }));
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await Promise.allSettled(mutators.map(x => x.$disconnect())); await db.$disconnect(); });
