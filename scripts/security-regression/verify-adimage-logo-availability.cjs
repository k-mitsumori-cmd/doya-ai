const {connect,request:operationRequest}=require('./adimage-operation-http-fixture.cjs')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
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

async function logoRemoval(fail) {
  const file='scripts/security-regression/verify-adimage-operation-tool-mounted.cjs'
  const prefix=fs.readFileSync(file,'utf8').split('\n(async()=>{')[0]
  const f=new Function('require','__dirname',prefix+'\nreturn {mount,close,act,prepare,click,client,dom,host:()=>host,reset:()=>{receipts=new Map();mode="success";calls=[];dom.window.localStorage.clear()},setNetwork:v=>network=v,original:network};')(createRequire(path.resolve(file)),path.dirname(path.resolve(file)))
  try {
    f.reset()
    let deletes=0
    f.setNetwork(async c=>{
      if(!c.url.endsWith('/logo'))return f.original(c)
      const intent=f.client.readAdImageIntent('actor-a')
      if(c.init.method==='DELETE'){deletes++;if(fail)return Response.json({error:'Synthetic internal failure'},{status:503})}
      return Response.json({operationId:intent.operationId,kind:intent.kind,targetId:intent.targetId,state:'completed',brandId:intent.targetId,logoName:c.init.method==='DELETE'?null:'brand.png',logoConfig:c.init.method==='DELETE'?null:{pos:'bottom-right',maxWidthPct:22,paddingPct:4}})
    })
    await f.mount();await f.prepare()
    await f.act(()=>{const el=f.host().querySelector('input[type="file"]');Object.defineProperty(el,'files',{value:[new f.dom.window.File(['synthetic'],'brand.png',{type:'image/png'})],configurable:true});el.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}))})
    assert(f.host().textContent.includes('brand.png'));await f.click('結果を確認しました');await f.click('ロゴを外す')
    assert.equal(deletes,1)
    if(fail){assert(f.host().textContent.includes('brand.png'));assert(f.host().textContent.includes('保存結果を確認'));assert(!f.host().textContent.includes('Synthetic internal failure'));assert.equal(f.client.readAdImageIntent('actor-a').kind,'logo-remove')}
    else {assert(!f.host().textContent.includes('brand.png'));assert(f.host().textContent.includes('結果を確認しました'));assert.equal(f.client.readAdImageIntent('actor-a').kind,'logo-remove')}
  } finally {await f.close()}
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
  await check('failed logo removal preserves selected logo and durable result-confirmation fence',()=>logoRemoval(true))
  await check('validated successful removal clears selected logo and requires acknowledgment',()=>logoRemoval(false))
})().catch((error) => { console.error(error); process.exitCode = 1 })
