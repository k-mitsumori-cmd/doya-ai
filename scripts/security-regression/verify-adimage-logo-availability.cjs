const {connect,request:operationRequest}=require('./adimage-operation-http-fixture.cjs')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { load, check } = require('./load-typescript.cjs')

async function exercise(kind, logoPath, downloaded) {
  const file = kind === 'create'
    ? 'src/app/api/adimage/concepts/route.ts'
    : 'src/app/api/adimage/concepts/[id]/refine/route.ts'
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const mocks = {}
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement)) mocks[statement.moduleSpecifier.text] = {}
  }
  let claims = 0
  let campaigns = 0
  let generations = 0
  let reads = 0
  const identity = { userId: 'owner', guestId: null, plan: 'PRO' }
  mocks['next/server'] = { NextResponse: Response }
  mocks['@/lib/prisma'] = { prisma: {
    adImageBrand: { findFirst: async () => ({ id: 'brand', name: 'Brand', logoPath }) },
    adImageCampaign: { create: async () => { campaigns++; throw Error('unexpected campaign') } },
    adImageConcept: { findFirst: async () => ({
      id: 'concept', campaignId: 'campaign', campaign: { brand: { id: 'brand', name: 'Brand', logoPath } },
      feedbacks: [], creatives: [{ placementKey: 'square' }], copy: {}, generation: 1,
    }) },
  } }
  mocks['@/lib/adimage/access'] = {
    getIdentity: async () => identity, requireUser: () => ({ ok: true }),
    ensureGuestId: () => ({ identity, newGuestId: null }), ownerWhere: () => ({ userId: 'owner' }),
    assertQuota: async () => ({ ok: true }),
  }
  mocks['@/lib/adimage/image-budget'] = {
    claimImageBudget: async () => { claims++; throw Error('unexpected claim') },
  }
  mocks['@/lib/adimage/placements'] = {
    findPlacement: (key) => ({ key }), DEFAULT_PLACEMENT_KEYS: ['square'], groupByGenSize: () => [],
  }
  mocks['@/lib/adimage/copy'] = { normalizeCopy: (copy) => copy }
  mocks['@/lib/adimage/feedback'] = { REFINE_CHIPS: [] }
  mocks['@/lib/adimage/generate'] = { generateBaked: async () => { generations++ } }
  mocks['@/lib/adimage/storage'] = { downloadBuffer: async () => { reads++; return downloaded } }
  connect(mocks, async () => { claims++; throw Error('unexpected claim') })
  const route = load(file, mocks)
  const response = await route.POST(operationRequest(kind === 'create' ? {
    brandId: 'brand', copy: { headline: 'Headline', cta: 'CTA' }, placements: ['square'],
  } : { note: '改善' }), { params: Promise.resolve({ id: 'concept' }) })
  return { response, claims, campaigns, generations, reads }
}

function logoRemoval(response) {
  const file = 'src/app/adimage/Tool.tsx'
  const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let source
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'removeLogo') source = node.getText(ast)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(source)
  const state = { logoName: 'brand.png', busy: false, error: '' }
  const env = {
    brandId: 'brand', imageOperation: { current: { revision: 0, busy: false } }, operation: { blocked: false }, fetch: async () => response,
    setLogoBusy: (value) => { state.busy = value },
    setLogoName: (value) => { state.logoName = value },
    setError: (value) => { state.error = value },
    notifyError: (setError, message) => setError(message),
  }
  const code = ts.transpileModule(`(${source})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return { removeLogo: vm.runInNewContext(code, env), state }
}

;(async () => {
  for (const kind of ['create', 'refine']) {
    await check(`${kind} rejects unavailable registered logo before image reservation`, async () => {
      const result = await exercise(kind, 'owner/brand/logo.png', null)
      assert.equal(result.response.status, 503)
      assert.match((await result.response.json()).error, /ロゴを読み込めませんでした/)
      assert.equal(result.reads, 1)
      assert.equal(result.claims, 0)
      assert.equal(result.campaigns, 0)
      assert.equal(result.generations, 0)
    })
  }
  await check('failed logo removal keeps the selected logo and shows the server error', async () => {
    const { removeLogo, state } = logoRemoval(Response.json({ error: '削除できません' }, { status: 503 }))
    await removeLogo()
    assert.equal(state.logoName, 'brand.png')
    assert.equal(state.error, '削除できません')
    assert.equal(state.busy, false)
  })
  await check('successful logo removal clears the selected logo', async () => {
    const { removeLogo, state } = logoRemoval(Response.json({ ok: true }))
    await removeLogo()
    assert.equal(state.logoName, '')
    assert.equal(state.error, '')
    assert.equal(state.busy, false)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
