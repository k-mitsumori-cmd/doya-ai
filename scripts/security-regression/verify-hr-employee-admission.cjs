const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

;(async () => {
  await check('employee admission locks organization and blocks at its active quota', async () => {
    let writes = 0
    const tx = {
      $queryRaw: async () => [{ id: 'o' }],
      hrOrganizationMember: { findFirst: async () => ({ userId: 'owner' }) },
      user: { findUnique: async () => ({ plan: 'FREE' }) },
      hrEmployee: { count: async ({ where }) => { assert.equal(where.status, 'ACTIVE'); return 5 } },
    }
    const billing = load('src/lib/hr/billing.ts', { '@/lib/prisma': { prisma: { $transaction: fn => fn(tx) } } })
    const result = await billing.createWithinEmployeeLimit('o', async () => { writes++; return 'created' })
    assert.equal(result.allowed, false)
    assert.equal(result.limit, 5)
    assert.equal(writes, 0)
    assert.match(billing.employeeLimitMessage('PRO', 100), /お問い合わせ/)
    assert.doesNotMatch(billing.employeeLimitMessage('PRO', 100), /アップグレード/)
  })

  await check('single employee writes history in the admitted transaction', async () => {
    let employeeWrites = 0
    let historyWrites = 0
    const tx = {
      hrEmployee: { create: async ({ data }) => { employeeWrites++; return { id: 'e', lastName: data.lastName, firstName: data.firstName, department: null } } },
      hrEmployeeHistory: { create: async ({ data }) => { historyWrites++; assert.equal(data.employeeId, 'e') } },
    }
    const api = load('src/app/api/hr/employees/route.ts', {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
      '@/lib/auth': {},
      '@/lib/prisma': { prisma: {} },
      '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'o', userId: 'u', role: 'OWNER' }), hasMinRole: () => true },
      '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN' } },
      '@/lib/hr/constants': { DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 },
      '@/lib/hr/billing': {
        createWithinEmployeeLimit: async (id, create) => { assert.equal(id, 'o'); return { allowed: true, value: await create(tx) } },
        employeeLimitMessage: () => '',
      },
      '@/lib/service-usage': { recordServiceUsage: async () => {} },
    })
    const response = await api.POST({ json: async () => ({ lastName: '山田', firstName: '太郎' }) })
    assert.equal(response.status, 200)
    assert.deepEqual([employeeWrites, historyWrites], [1, 1])
  })

  await check('CSV import reports partial success and a persistent PRO contact route', async () => {
    let calls = 0
    const api = load('src/app/api/hr/employees/import/route.ts', {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
      '@/lib/auth': {},
      '@/lib/prisma': { prisma: {} },
      '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'o', role: 'ADMIN' }), hasMinRole: () => true },
      '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN' } },
      '@/lib/hr/billing': {
        createWithinEmployeeLimit: async (id, create) => {
          calls++
          if (calls > 1) return { allowed: false, plan: 'PRO', limit: 100 }
          const tx = {
            hrEmployee: { create: async () => ({ id: 'e' }) },
            hrEmployeeHistory: { create: async () => ({}) },
          }
          return { allowed: true, value: await create(tx) }
        },
        employeeLimitMessage: () => '上限です。お問い合わせください。',
      },
    })
    const response = await api.POST({ json: async () => ({ csvText: 'lastName,firstName\n山田,太郎\n佐藤,花子' }) })
    const data = await response.json()
    assert.equal(response.status, 200)
    assert.equal(data.imported, 1)
    assert.equal(data.failed, 1)
    assert.equal(data.code, 'HR_ORG_EMPLOYEE_LIMIT')
    assert.equal(data.limitNotice.upgradeUrl, undefined)
    assert.match(data.limitNotice.contactUrl, /contact/)
  })

  await check('new employee photo uploads only after admission and is attached to the saved employee', async () => {
    const source = fs.readFileSync('src/app/hr/employees/new/page.tsx', 'utf8')
    const ast = ts.createSourceFile('new-page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    let handler
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleSubmit') handler = node.initializer.getText(ast)
      ts.forEachChild(node, visit)
    }
    visit(ast)
    assert.ok(handler)
    for (const mode of ['limit', 'saved']) {
      const calls = []
      const destinations = []
      const env = {
        form: { lastName: '山田', firstName: '太郎' },
        photoFile: new Blob(['photo']),
        FormData,
        setSaving() {}, setLimitNotice() {}, setSubmitted() {},
        router: { push: path => destinations.push(path) },
        toast: { success() {}, error() {} },
        setTimeout: fn => fn(),
        fetch: async (path, options) => {
          calls.push(path)
          if (path === '/api/hr/employees') return Response.json(mode === 'limit'
            ? { code: 'HR_ORG_EMPLOYEE_LIMIT', error: '上限', upgradeUrl: '/hr/pricing' }
            : { employee: { id: 'e' } }, { status: mode === 'limit' ? 403 : 200 })
          if (path === '/api/hr/upload') return Response.json({ url: 'https://example.com/photo.png' })
          if (path === '/api/hr/employees/e') {
            assert.deepEqual(JSON.parse(options.body), { photoUrl: 'https://example.com/photo.png' })
            return Response.json({ success: true })
          }
          throw Error(`Unexpected fetch ${path}`)
        },
      }
      const js = ts.transpileModule(`(${handler})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
      const submit = vm.runInNewContext(js, env)
      await submit({ preventDefault() {} })
      assert.deepEqual(calls, mode === 'limit'
        ? ['/api/hr/employees']
        : ['/api/hr/employees', '/api/hr/upload', '/api/hr/employees/e'])
      if (mode === 'saved') assert.deepEqual(destinations, ['/hr/employees'])
    }
  })

  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
