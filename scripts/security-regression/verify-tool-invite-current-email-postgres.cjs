// Current-email authorization stays serialized through invitation activation.
// SQL is private; sessions, pricing scope/license, flag configuration and SFA quota are synthetic.
// Company role lookup/policy and all six POST handlers are actual source modules.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto'), vm = require('node:vm');
const { root, seatSourcePath, evidenceDir } = require('./seat-regression-support.cjs'), ts = require(root + '/node_modules/typescript'), privateEnv = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), privateState = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), url = new URL(privateEnv.DATABASE_URL);
assert(/^\/doya_seat_models_[0-9]+$/.test(url.pathname));
assert(url.hostname === 'localhost' && url.searchParams.get('host') === privateState.socket && privateState.socket.startsWith('/tmp/doya-'));
const { PrismaClient, Prisma } = require(privateState.prismaClientPath || root + '/node_modules/@prisma/client'), raw = new PrismaClient({ datasources: { db: { url: privateEnv.DATABASE_URL } } });
let state;
const hashes = {}, rows = [];
let completed = false;
function load(file, mocks) { const selected = seatSourcePath(file); const source = fs.readFileSync(selected, 'utf8'), mod = { exports: {} }; hashes[file] = crypto.createHash('sha256').update(source).digest('hex'); vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { module: mod, exports: mod.exports, require: n => { assert(Object.hasOwn(mocks, n), 'Unexpected dependency ' + n + ' in ' + file); return mocks[n]; }, Date, Map, Set, Promise, Error, Response, Request, URL, Headers, process: { env: {} }, console: { log() { }, warn() { }, error() { } } }, { filename: file }); return mod.exports; }
function wrap(client) {
    return new Proxy(client, { get(target, key) {
            if (key === '$transaction')
                return (fn, options) => target.$transaction(tx => fn(wrap(tx)), options);
            const value = target[key];
            if (key === 'user' || key === state?.memberModel)
                return new Proxy(value, { get(model, method) {
                        const fn = model[method];
                        if (typeof fn !== 'function')
                            return fn;
                        return async (...args) => {
                            const result = await fn.apply(model, args);
                            if (key === 'user' && method === 'findUnique' && args[0].where?.id === state.actor && args[0].select?.email) {
                                state.emailReads++;
                                if (state.race && state.emailReads === 2) {
                                    state.writerStarted = true;
                                    state.writer = raw.$transaction(async (writerTx) => { state.writerPid = Number((await writerTx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid); return state.adapterWriter ? require(root + '/node_modules/@next-auth/prisma-adapter').PrismaAdapter(writerTx).updateUser({ id: state.actor, email: state.newEmail }) : writerTx.user.update({ where: { id: state.actor }, data: { email: state.newEmail } }); }, { timeout: 10000 }).then(() => { state.writerFinished = true; });
                                    {
                                        state.admissionPid = Number((await client.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid);
                                        const deadline = Date.now() + 3000;
                                        state.writerBlockedByAdmission = false;
                                        while (Date.now() < deadline && !state.writerFinished) {
                                            if (state.writerPid) {
                                                const observed = await raw.$queryRawUnsafe('SELECT wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1', state.writerPid);
                                                if (observed[0]?.wait_event_type === 'Lock' && observed[0].blockers.map(Number).includes(state.admissionPid)) {
                                                    state.writerBlockedByAdmission = true;
                                                    break;
                                                }
                                            }
                                            await new Promise(r => setTimeout(r, 20));
                                        }
                                        state.writerBlockedWhileAdmission = state.writerBlockedByAdmission;
                                        assert(state.writerBlockedByAdmission, 'Writer must be blocked by the actual admission PostgreSQL backend');
                                    }
                                    state.writerFinishedBeforeReadReleased = !!state.writerFinished;
                                }
                            }
                            if (key === state?.memberModel && method === 'updateMany' && args[0].data?.status === 'ACTIVE') {
                                state.claimWriteObserved = true;
                                state.writerFinishedAtClaimWrite = !!state.writerFinished;
                            }
                            return result;
                        };
                    } });
            return typeof value === 'function' ? value.bind(target) : value;
        } });
}
const db = wrap(raw), plans = load('src/lib/pricing-v2/plans.ts', {}), team = load('src/lib/pricing-v2/team.ts', { './plans': plans }), roles = load('src/lib/company-roles/roles.ts', {}), toolRoles = load('src/lib/company-roles/tool-roles.ts', { './roles': roles });
const core = load('src/lib/pricing-v2/seat-operation.ts', { 'node:crypto': crypto, '@/lib/prisma': { prisma: db }, './team': team });
const scopePort = { resolveToolUnionScope: async () => state.enabled ? { enabled: true, scope: state.scope } : { enabled: false }, toolUnionScopeIdentity: v => v.enabled ? JSON.stringify(v.scope) : 'off', readToolUnionLicense: async () => ({ used: 1, limit: 2 }), ToolUnionScopeError: class extends Error {
    } };
const policy = load('src/lib/company-roles/policy.ts', {}), permissions = load('src/lib/company-roles/permissions.ts', { './roles': roles, './policy': policy }), access = load('src/lib/company-roles/access.ts', { './permissions': permissions, './policy': policy, './roles': roles, './tool-roles': toolRoles }), optout = load('src/lib/company-roles/auto-link-opt-out.server.ts', {}), orgs = load('src/lib/company-roles/tool-orgs.server.ts', { '@/lib/prisma': { prisma: db }, './auto-link-opt-out.server': optout, './tool-roles': toolRoles }), roleServer = load('src/lib/company-roles/access.server.ts', { '@/lib/prisma': { prisma: db }, '@/lib/pricing-v2/rollout': { newPricingRollout: () => 'all' }, '@/lib/pricing-v2/prices': { teamPriceConfig: () => ({ ok: true }) }, './access': access, './rollout': { companyRolesRollout: () => state?.roleMode || 'enforce', companyRolesModeFor: () => state?.roleMode || 'enforce' }, './tool-orgs.server': orgs });
const admission = load('src/lib/pricing-v2/tool-seat-admission.server.ts', { '@/lib/company-roles/access.server': roleServer, '@prisma/client': { Prisma }, '@/lib/prisma': { prisma: db }, '@/lib/company-roles/tool-roles': toolRoles, './tool-seat-union-scope.server': scopePort, './seat-operation': core });
const response = load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } });
const tools = ['aio', 'shodan', 'quote', 'mensetsu', 'aishodan', 'sfa'];
const apis = Object.fromEntries(tools.map(tool => [tool, load('src/app/api/' + tool + '/invite/[token]/route.ts', { '@/lib/pricing-v2/tool-seat-admission.server': admission, 'next/server': {}, '@/lib/private-api-response': response, 'next-auth': { getServerSession: async () => ({ user: { id: state.actor, email: state.oldEmail, name: 'Synthetic actor' } }) }, '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: db }, ['@/lib/' + tool + '/access']: { resolveUserId: async () => state.actor }, '@/lib/sfa/limits': { checkSfaQuota: async () => null, sfaQuotaResponse: () => { throw new Error('Unexpected quota response'); } } })]));
(async () => {
    try {
        for (const [toolIndex, tool] of tools.entries())
            for (const [caseIndex, spec] of [{ name: 'disabled scope serializes email writer after membership', enabled: false, race: true }, { name: 'enabled scope serializes email writer after membership', enabled: true, race: true }, { name: 'disabled scope rejects already changed current email', enabled: false, race: false, stale: true }, { name: 'enforced company guest cannot activate', enabled: true, race: true, companyRole: 'guest', roleMode: 'enforce', denied: true }, { name: 'shadow company guest retains tool admission', enabled: true, race: true, companyRole: 'guest', roleMode: 'shadow' }, { name: 'installed PrismaAdapter email writer waits under pricing off', enabled: false, race: true, adapterWriter: true }].entries()) {
                const i = toolIndex * 6 + caseIndex;
                state = { ...spec, tool, memberModel: tool + 'Member', actor: 'synthetic-email-actor-' + i, owner: 'synthetic-email-owner-' + i, org: 'synthetic-email-org-' + i, company: 'synthetic-email-company-' + i, token: 'synthetic-email-token-' + i, oldEmail: 'synthetic-email-old-' + i + '@example.invalid', newEmail: 'synthetic-email-new-' + i + '@example.invalid', emailReads: 0, writerFinished: false };
                state.scope = { companyId: state.company, ownerUserId: state.owner, fenceKey: state.company, kind: 'legacy', attribution: 'linked-org' };
                await raw.user.createMany({ data: [{ id: state.owner, email: 'owner-' + i + '@example.invalid', plan: 'PRO' }, { id: state.actor, email: state.stale ? state.newEmail : state.oldEmail, plan: 'FREE' }] });
                await raw.accountCompany.create({ data: { id: state.company, userId: state.owner, name: 'Synthetic email company' } });
                await raw[tool + 'Organization'].create({ data: { id: state.org, name: 'Synthetic email organization', slug: 'synthetic-email-' + i } });
                await raw[tool + 'Member'].createMany({ data: [{ id: 'synthetic-owner-member-' + i, organizationId: state.org, userId: state.owner, role: 'owner', status: 'ACTIVE' }, { id: 'synthetic-pending-' + i, organizationId: state.org, inviteEmail: state.oldEmail, inviteToken: state.token, role: 'member', status: 'PENDING', createdAt: new Date() }] });
                await raw.accountCompanyMember.create({ data: { id: 'synthetic-central-member-' + i, companyId: state.company, userId: state.actor, email: state.oldEmail, role: spec.companyRole || 'member', status: 'active' } });
                await raw.accountCompanyToolOrg.create({ data: { tool, organizationId: state.org, companyId: state.company, linkedBy: state.owner } });
                const result = await apis[tool].POST(new Request('https://synthetic.invalid/api/' + tool + '/invite/' + state.token, { method: 'POST' }), { params: Promise.resolve({ token: state.token }) });
                if (state.writer)
                    await state.writer;
                const member = await raw[tool + 'Member'].findUnique({ where: { id: 'synthetic-pending-' + i }, select: { userId: true, status: true, inviteToken: true } }), account = await raw.user.findUnique({ where: { id: state.actor }, select: { email: true } });
                if (spec.stale || spec.denied) {
                    assert.equal(result.status, 403);
                    assert.equal(member.status, 'PENDING');
                    assert.equal(member.userId, null);
                }
                else {
                    assert.equal(result.status, 200);
                    assert.equal(member.status, 'ACTIVE');
                    assert.equal(member.userId, state.actor);
                    assert.equal(account.email, state.newEmail);
                    assert.equal(state.writerFinishedAtClaimWrite, false);
                    assert(state.writerBlockedWhileAdmission);
                }
                rows.push({ tool, name: spec.name, companyRole: spec.companyRole || 'member', roleMode: spec.roleMode || 'enforce', enabledScope: spec.enabled, status: result.status, emailReads: state.emailReads, writerFinishedBeforeReadReleased: state.writerFinishedBeforeReadReleased ?? null, writerFinishedAtClaimWrite: state.writerFinishedAtClaimWrite ?? null, writerBlockedWhileAdmission: state.writerBlockedWhileAdmission ?? null, pgLockObserved: state.writerBlockedByAdmission ?? false, admissionBackendPid: state.admissionPid ?? null, writerBackendPid: state.writerPid ?? null, membershipActive: member.status === 'ACTIVE', currentEmailChanged: account.email === state.newEmail, passed: true });
            }
        assert.equal(rows.length, 36);
        completed = true;
    }
    finally {
        if (state?.writer)
            await state.writer.catch(() => { });
        await raw.$disconnect();
        fs.writeFileSync(path.join(evidenceDir, 'tool-invite-current-email-results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), completed, count: rows.length, rows, sourceHashes: hashes, actualSixToolPostsAndSharedSeatUserLock: true, installedAdapterWriterCases: rows.filter(row => row.name.includes('PrismaAdapter')).length, installedAdapterSourceSha256: crypto.createHash('sha256').update(fs.readFileSync(require.resolve(root + '/node_modules/@next-auth/prisma-adapter'))).digest('hex'), syntheticSfaQuota: true, realPrivatePrismaAndPostgres: true, actualCompanyCeilingAndSqlRoleLookup: true, syntheticSessionScopeLicenseAndFlagConfiguration: true, notProductionRolloutToggle: true, providerRequests: 0, productionWrites: 0, wholeAuditComplete: false }, null, 2) + String.fromCharCode(10));
    }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
