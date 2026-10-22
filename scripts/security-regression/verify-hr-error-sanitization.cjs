const privateApiResponse = require('./load-typescript.cjs').load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } });
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load, check } = require('./load-typescript.cjs')
const { assertPrivateErrorResponses } = require('./assert-hr-private-error-responses.cjs')
const root = path.resolve(__dirname, '../../src/app/api/hr')
const secret = 'postgres://private-password@example.invalid/hr'
const failure = () => { throw Error(secret) }
const ctx = { organizationId: 'org', role: 'ADMIN', memberId: 'member', employeeId: 'employee' }
const server = { NextResponse: Response }

async function expectSafe(promise, expected) {
  const response = await promise
  assert.equal(response.status, 500)
  const body = await response.json()
  assert.equal(body.error, expected)
  assert(!JSON.stringify(body).includes(secret))
}
;(async () => {
  await check('HR employee list retains 401 but never returns private database error', async () => {
    const mocks = {
      '@/lib/private-api-response': privateApiResponse, 'next/server': server,
      'next-auth': {}, '@/lib/auth': {},
      '@/lib/prisma': { prisma: { hrEmployee: { findMany: failure, count: async () => 0 } } },
      '@/lib/hr/access': { getHrContext: async () => ctx, hasMinRole: () => true },
      '@/lib/hr/types': { HrMemberRole: { MANAGER: 'MANAGER' } },
      '@/lib/hr/constants': { DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 },
      '@/lib/hr/billing': {}, '@/lib/service-usage': {},
    }
    const api = load('src/app/api/hr/employees/route.ts', mocks)
    await expectSafe(api.GET({ nextUrl: new URL('http://offline.invalid/') }), 'Failed to fetch employees')
    mocks['@/lib/hr/access'].getHrContext = async () => null
    assert.equal((await api.GET({ nextUrl: new URL('http://offline.invalid/') })).status, 401)
  })
  await check('HR organization member list does not return private database error', async () => {
    const api = load('src/app/api/hr/organization/members/route.ts', {
      '@/lib/private-api-response': privateApiResponse, 'next/server': server,
      '@/lib/prisma': { prisma: { hrOrganizationMember: { findMany: failure } } },
      '@/lib/hr/access': { getHrContext: async () => ctx, hasMinRole: () => true },
    })
    await expectSafe(api.GET(), 'Failed to fetch members')
  })
  await check('HR dashboard does not return private database error', async () => {
    const api = load('src/app/api/hr/dashboard/route.ts', {
      '@/lib/private-api-response': privateApiResponse, 'next/server': server,
      '@/lib/prisma': { prisma: {
        hrOrganization: { findUnique: failure }, hrEmployee: { count: async () => 0 },
        hrDepartment: { count: async () => 0 }, hrEvaluationPeriod: { findMany: async () => [] },
        hrOneOnOne: { count: async () => 0, findMany: async () => [] },
      } },
      '@/lib/hr/access': { getHrContext: async () => ctx, hasMinRole: () => true },
      '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN' } },
      '@/lib/hr/billing': { hrJstMonthRange: () => ({ start: new Date('2099-01-01'), end: new Date('2099-02-01') }) },
      '@/lib/hr/evaluation-access': { getEvaluationReadWhere: async () => ({}) },
      '@/lib/hr/one-on-one-access': { getOneOnOneReadWhere: async () => ({}) },
    })
    await expectSafe(api.GET(), 'Failed')
  })
  await check('HR denied onboarding returns fixed403 without echoing a coded private exception', async () => {
    const api = load('src/app/api/hr/organization/route.ts', {
      '@/lib/hr/organization-choices': load('src/lib/hr/organization-choices.ts', { 'node:crypto': require('node:crypto'), './types': load('src/lib/hr/types.ts') }),
      '@/lib/private-api-response': privateApiResponse, 'next/server': server, 'next-auth': { getServerSession: async () => ({user:{id:'synthetic'}}) }, '@/lib/auth': {},
      '@prisma/client': {}, '@/lib/prisma': {}, '@/lib/hr/types': {},
      '@/lib/hr/membership-write': { withHrMembershipWrite: async () => { throw Error('Unexpected membership write') }, HrMembershipChanged: class HrMembershipChanged extends Error {} },
      '@/lib/account-lifecycle/state': require('./hr-membership-fixture-bridge.cjs').state,
      '@/lib/hr/access': { getOrCreateOrganization: async () => { throw Object.assign(new Error(secret),{code:'INVALID_MEMBERSHIP_ROLE'}) } },
    })
    const response = await api.POST({json:async()=>({name:'Synthetic'})}); assert.equal(response.status,403)
    const body=await response.json(); assert.equal(body.error,'組織の権限を確認できません。管理者に確認してください。')
    assert.equal(body.code,'INVALID_MEMBERSHIP_ROLE'); assert(!JSON.stringify(body).includes(secret))
  })
  await check('HR error dataflow rejects unguarded, unknown-class, stack and500 responses', async () => {
    const header = "import { HrEvaluationInputError } from '@/lib/hr/evaluation-input';";
    for (const code of ["return privateApiJson({error:e.message},{status:500})", "if(e instanceof Error) return privateApiJson({error:e.message},{status:400})", "if(e instanceof HrEvaluationInputError) return privateApiJson({error:e.stack},{status:400})", "if(e instanceof HrEvaluationInputError) return privateApiJson({error:e.message},{status:500})", "if(e instanceof HrEvaluationInputError) {} return privateApiJson({error:e.message},{status:400})"]) assert.throws(()=>assertPrivateErrorResponses(header+code));
    assert.doesNotThrow(()=>assertPrivateErrorResponses(header+"if(e instanceof HrEvaluationInputError) return privateApiJson({error:e.message},{status:400}); return privateApiJson({error:'Failed'},{status:500})"));
    const typed = "import { LifecycleError } from '@/lib/account-lifecycle/state'; import { OwnerTransferError } from '@/lib/hr/owner-transfer/types';";
    assert.doesNotThrow(() => assertPrivateErrorResponses(typed + "if(error instanceof LifecycleError || error instanceof OwnerTransferError) return privateApiJson({error:error.message},{status:error.status})"));
    for (const invalid of [
      "if(error instanceof LifecycleError || error instanceof Error) return privateApiJson({error:error.message},{status:error.status})",
      "if(error instanceof LifecycleError || other instanceof OwnerTransferError) return privateApiJson({error:error.message},{status:error.status})",
      "if(error instanceof LifecycleError) return privateApiJson({error:error.stack},{status:error.status})",
      "if(error instanceof LifecycleError) return privateApiJson({error:error.message},{status:500})",
      "return privateApiJson({error:error.message},{status:409})",
    ]) assert.throws(() => assertPrivateErrorResponses(typed + invalid));
  })
  await check('HR membership failure responses use fixed text and private headers', async () => {
    const { state } = require('./hr-membership-fixture-bridge.cjs')
    const errors = [Error('SYNTHETIC_PRIVATE_DATABASE_DETAIL'), new state.LifecycleError('HR_MEMBERSHIP_CHANGED')]
    for (const error of errors) {
      const api = load('src/app/api/hr/organization/route.ts', {
        '@/lib/hr/organization-choices': load('src/lib/hr/organization-choices.ts', { 'node:crypto': require('node:crypto'), './types': load('src/lib/hr/types.ts') }),
        '@/lib/private-api-response': privateApiResponse, 'next/server': server,
        'next-auth': { getServerSession: async () => null }, '@/lib/auth': {},
        '@prisma/client': { Prisma: { DbNull: null } }, '@/lib/prisma': {},
        '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN' } },
        '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'org', userId: 'user', memberId: 'member', role: 'ADMIN' }), hasMinRole: () => true },
        '@/lib/hr/membership-write': { withHrMembershipWrite: async () => { throw error }, HrMembershipChanged: class HrMembershipChanged extends Error {} },
        '@/lib/account-lifecycle/state': state,
      })
      const response = await api.PATCH({ json: async () => ({ name: 'Synthetic' }) })
      assert.equal(response.status, error instanceof state.LifecycleError ? 409 : 500)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      assert.equal(response.headers.get('vary'), 'Cookie')
      assert.equal((await response.text()).includes('SYNTHETIC_PRIVATE_DATABASE_DETAIL'), false)
    }
  })
  await check('HR API 500 handlers never interpolate exception messages', async () => {
    let checked = 0
    function visit(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name)
      if (item.isDirectory()) visit(file)
      else if (file.endsWith('.ts')) {
        const source = fs.readFileSync(file, 'utf8')
        checked += (source.match(/status:\s*500/g) || []).length
        assertPrivateErrorResponses(source, file)
      }
    } }
    visit(root)
    assert(checked >= 33)
    const evaluationSource = fs.readFileSync(path.join(root, 'evaluations/route.ts'), 'utf8')
    assert(!/console\.(?:error|warn)\([^\n]*,\s*(?:e|err|error)\b/.test(evaluationSource), 'evaluation routes log an internal error object')
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
