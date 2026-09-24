const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ role = 'ADMIN', foreign = false, occupied = false, uniqueRace = false } = {}) {
  const writes = []
  const prisma = {
    hrOrganizationMember: {
      findFirst: async ({ where }) => {
        if (where.id === 'target') return { id: 'target', role: 'MEMBER', employeeId: null }
        if (where.employeeId) return occupied ? { id: 'someone-else' } : null
        throw Error('unexpected membership query')
      },
      update: async ({ data }) => {
        if (uniqueRace) throw Object.assign(Error('private constraint'), { code: 'P2002' })
        writes.push(data)
        return { id: 'target', ...data }
      },
    },
    hrEmployee: {
      findFirst: async ({ where }) => {
        assert.equal(where.organizationId, 'org')
        return foreign ? null : { id: where.id }
      },
    },
  }
  const api = load('src/app/api/hr/organization/members/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/hr/access': {
      getHrContext: async () => ({ organizationId: 'org', memberId: 'admin', role }),
      hasMinRole: actual => actual === 'ADMIN' || actual === 'OWNER',
    },
    '@/lib/hr/types': { HrMemberRole: { OWNER: 'OWNER', ADMIN: 'ADMIN', MANAGER: 'MANAGER', MEMBER: 'MEMBER' } },
  })
  return {
    writes,
    request: body => api.PATCH({ json: async () => body }, { params: Promise.resolve({ id: 'target' }) }),
  }
}

;(async () => {
  await check('foreign and malformed employee links are rejected before writes', async () => {
    const foreign = fixture({ foreign: true })
    assert.equal((await foreign.request({ employeeId: 'foreign' })).status, 400)
    assert.equal(foreign.writes.length, 0)
    const malformed = fixture()
    for (const employeeId of ['', 123, {}]) assert.equal((await malformed.request({ employeeId })).status, 400)
    assert.equal(malformed.writes.length, 0)
  })
  await check('occupied employee link and concurrent unique conflict return 409', async () => {
    const occupied = fixture({ occupied: true })
    assert.equal((await occupied.request({ employeeId: 'e' })).status, 409)
    assert.equal(occupied.writes.length, 0)
    const race = fixture({ uniqueRace: true })
    const response = await race.request({ employeeId: 'e' })
    assert.equal(response.status, 409)
    assert.ok(!(await response.text()).includes('private constraint'))
  })
  await check('admin can link and unlink a same-organization employee', async () => {
    const valid = fixture()
    assert.equal((await valid.request({ employeeId: 'e' })).status, 200)
    assert.equal((await valid.request({ employeeId: null })).status, 200)
    assert.equal(valid.writes.length, 2)
    assert.equal(valid.writes[0].employeeId, 'e')
    assert.equal(valid.writes[1].employeeId, null)
  })
  await check('general member cannot link employee records', async () => {
    assert.equal((await fixture({ role: 'MEMBER' }).request({ employeeId: 'e' })).status, 403)
  })
  console.log(JSON.stringify({ passed: results.length, results }))
})().catch(error => { console.error(error); process.exitCode = 1 })
