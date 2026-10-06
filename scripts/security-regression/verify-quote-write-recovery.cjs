const {OrgResponseError}=require('./load-typescript.cjs').load('src/lib/org-client-response.ts');
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.resolve(__dirname, '../../src/app/quote/Tool.tsx'), 'utf8')
const ast = ts.createSourceFile('Tool.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const handlers = {}
function visit(node) {
  if (ts.isFunctionDeclaration(node) && ['createOrg', 'saveProduct'].includes(node.name?.text)) {
    handlers[node.name.text] = node.getText(ast)
  }
  ts.forEachChild(node, visit)
}
visit(ast)

function makeHandler(name, env) {
  assert.ok(handlers[name], `${name} handler exists`)
  const script = ts.transpileModule(`(${handlers[name]})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return vm.runInNewContext(script, env)
}

async function verifyOrganization() {
  let error = '', loading = false, fetches = 0, loads = 0
  const pending = []
  const env = {
    Error, OrgResponseError, context: { isCurrent: () => true }, epoch: 1,
    orgName: 'テスト組織',orgNameRef:{current:'テスト組織'}, creatingOrgRequest: { current: false },
    setCreatingOrg: value => { loading = value }, setError: value => { error = value }, setQuotaAction() {},
    notifyError: (setter, message) => setter(message), withOrg: (_service, route) => route,
    fetch: () => { fetches++; return new Promise((resolve, reject) => pending.push({ resolve, reject })) },
    load: async () => { loads++ }, setOrganizationUncertain() {}, selectOrganization() {}, changeOrganization() { loads++ },
  }
  const createOrg = makeHandler('createOrg', env)
  const first = createOrg()
  await createOrg()
  assert.equal(fetches, 1, 'rapid repeated clicks submit once')
  assert.equal(loading, true)
  pending[0].reject(new OrgResponseError(true))
  await first
  assert.match(error, /確認できません/, 'unknown result is visible')
  assert.equal(loading, false)
  assert.equal(env.creatingOrgRequest.current, true);await createOrg();assert.equal(fetches,1,'retained callback cannot duplicate unknown organization creation')
  const freshCreateOrg=makeHandler('createOrg',{...env,creatingOrgRequest:{current:false}})
  const retry = freshCreateOrg()
  pending[1].resolve(Response.json({ slug: 'test', name:'テスト組織' }))
  await retry
  assert.equal(fetches, 2)
  assert.equal(loads, 1)
  console.log('PASS quote organization unknown result blocks retained retry; fresh-context confirmed acknowledgement selects organization')
}

async function verifyProduct() {
  let error = '', loading = false, uncertain = false, fetches = 0, loads = 0, selected = null, cleared = false
  const pending = []
  const env = {
    Error, OrgResponseError, context: { isCurrent: () => true }, epoch: 1,
    draftProfile: { companyName: 'テスト商材' }, productName: 'テスト商材', draftUrl: 'https://example.invalid',draftProfileRef:{current:{companyName:'テスト商材'}},productNameRef:{current:'テスト商材'},draftUrlRef:{current:'https://example.invalid'},urlRef:{current:''},
    savingProductRequest: { current: false },savedProductRef:{current:null},setSavedProduct() {},isQuoteProductAcknowledgement:require('./load-typescript.cjs').load('src/lib/quote/response-shape.ts').isQuoteProductAcknowledgement,
    setSavingProduct: value => { loading = value }, setError: value => { error = value }, setQuotaAction() {},
    setProductSaveUncertain: value => { uncertain = value },
    notifyError: (setter, message) => setter(message), withOrg: (_service, route) => route,
    fetch: () => { fetches++; return new Promise((resolve, reject) => pending.push({ resolve, reject })) },
    setDraftProfile: value => { cleared = value === null;env.draftProfileRef.current=value }, setUrl(value) {env.urlRef.current=value}, setProductName(value) {env.productNameRef.current=value},
    load: async () => { loads++ }, setOrganizationUncertain() {}, selectOrganization() {}, changeOrganization() { loads++ }, setSelectedProduct: value => { selected = value },
  }
  const saveProduct = makeHandler('saveProduct', env)
  const first = saveProduct()
  await saveProduct()
  assert.equal(fetches, 1, 'rapid repeated clicks cannot create duplicate products')
  assert.equal(loading, true)
  pending[0].reject(new OrgResponseError(true))
  await first
  assert.match(error, /保存された可能性/)
  assert.equal(uncertain, true, 'ambiguous result offers a list refresh')
  assert.equal(cleared, false, 'draft stays available after a failed connection')
  assert.equal(loading, false)
  assert.equal(env.savingProductRequest.current, true);await saveProduct();assert.equal(fetches,1,'retained callback cannot duplicate unknown product save')
  const freshSaveProduct=makeHandler('saveProduct',{...env,savingProductRequest:{current:false}})
  const retry = freshSaveProduct()
  pending[1].resolve(Response.json({ product: { id: 'saved-product',name:'テスト商材',sourceUrl:'https://example.invalid',profile:env.draftProfileRef.current } }))
  await retry
  assert.equal(fetches, 2)
  assert.equal(loads, 1)
  assert.equal(selected, 'saved-product')
  assert.equal(cleared, true)
  assert.equal(uncertain, false)
  console.log('PASS quote product unknown result blocks retained retry; fresh-context confirmed acknowledgement clears draft')
}

Promise.resolve().then(verifyOrganization).then(verifyProduct).catch(error => { console.error(error); process.exitCode = 1 })
