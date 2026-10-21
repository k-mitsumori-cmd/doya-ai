const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { load, check } = require('./load-typescript.cjs')

const root = path.resolve(__dirname, '../..')
const oldPath = 'scripts/security-regression/fixtures/checkout-reservation-v1-91f5c8af.ts'
const oldHash = '11dab2b148831dbb3e7afd5d87bf0670aabd69550e2d28b8e4c01c307dc3c803'
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
assert.equal(hash(fs.readFileSync(path.join(root, oldPath))), oldHash, 'the old worker source must remain fixed')
const guard = load('src/lib/checkout-legacy-guard.ts')
const closed = error => error?.code === 'CHECKOUT_LEGACY_ENTRY_CLOSED' && error.status === 503

function sourceFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(folder, entry.name)
    return entry.isDirectory() ? sourceFiles(file) : /\.(ts|tsx)$/.test(entry.name) ? [file] : []
  })
}

;(async () => {
  await check('new v1 reservation export rejects before DB, provider read or create, even past its old TTL', async () => {
    let dbCalls = 0, providerReads = 0, providerWrites = 0
    const db = { systemSetting: new Proxy({}, { get() { dbCalls++; throw Error('DB prohibited') } }) }
    const legacy = load('src/lib/checkout-reservation.ts')
    for (const signatureParts of [{ phase: 'ready' }, { phase: 'creating', expiresAt: 1 }]) {
      await assert.rejects(legacy.createReservedCheckoutSession({ userId: 'synthetic', signatureParts,
        create: async () => { providerWrites++; throw Error('provider create prohibited') } }, db,
      async () => { providerReads++; throw Error('provider read prohibited') }), error =>
        error instanceof legacy.CheckoutReservationError && closed(error))
    }
    assert.deepEqual({ dbCalls, providerReads, providerWrites }, { dbCalls: 0, providerReads: 0, providerWrites: 0 })
  })

  await check('new direct Checkout Session export rejects before Stripe create', async () => {
    let providerWrites = 0
    class FakeStripe {
      constructor() { this.checkout = { sessions: { create: async () => { providerWrites++; throw Error('provider create prohibited') } } } }
    }
    const module = load('src/lib/stripe.ts', { stripe: FakeStripe, 'node:crypto': crypto, './checkout-legacy-guard': guard })
    await assert.rejects(module.createCheckoutSession({ priceId: 'price_synthetic', userId: 'synthetic', userEmail: 'synthetic@example.invalid',
      successUrl: 'https://example.invalid/success', cancelUrl: 'https://example.invalid/cancel' }), closed)
    assert.equal(providerWrites, 0)
  })

  await check('fixed old worker can return a ready URL after a later tombstone, without changing its source', async () => {
    const parts = { priceId: 'price_synthetic' }
    const key = 'checkout-reservation:v1:test:synthetic'
    const url = 'https://checkout.example.invalid/old'
    let raw = JSON.stringify({ phase: 'ready', signature: hash(JSON.stringify(parts)), sessionId: 'cs_old', url, expiresAt: 1900000000 })
    let releaseRead, enteredRead
    const entered = new Promise(resolve => { enteredRead = resolve })
    const db = { systemSetting: { findUnique: async ({ where }) => { assert.equal(where.key, key); return { value: raw } } } }
    const old = load(oldPath, { 'node:crypto': crypto, '@/lib/prisma': { prisma: db },
      '@/lib/stripe': { stripe: { checkout: { sessions: { retrieve: async () => { throw Error('unexpected default retrieve') } } } } } })
    const reading = old.createReservedCheckoutSession({ userId: 'synthetic', signatureParts: parts,
      create: async () => { throw Error('unexpected old write') } }, db,
    async () => { enteredRead(); return new Promise(resolve => { releaseRead = () => resolve({ id: 'cs_old', status: 'open', url }) }) })
    await entered
    raw = 'v2_tombstoned_after_old_read'
    releaseRead()
    assert.equal((await reading).url, url, 'an already-running old binary is not stopped by the new helper')
    assert.equal(raw, 'v2_tombstoned_after_old_read')
  })

  await check('src contains no caller of the two closed writer exports', async () => {
    const names = new Set(['createReservedCheckoutSession', 'createCheckoutSession'])
    const excluded = new Set(['src/lib/checkout-reservation.ts', 'src/lib/stripe.ts'])
    const references = []
    const files = sourceFiles(path.join(root, 'src'))
    for (const absolute of files) {
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      if (excluded.has(relative)) continue
      const text = fs.readFileSync(absolute, 'utf8')
      const tree = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, relative.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      const visit = node => {
        if (ts.isIdentifier(node) && names.has(node.text)) references.push(`${relative}:${tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1}:${node.text}`)
        ts.forEachChild(node, visit)
      }
      visit(tree)
    }
    assert.deepEqual(references, [], 'future runtime caller must join the lifecycle coordinator')
    console.log(JSON.stringify({ inventoriedSourceFiles: files.length, closedWriterReferences: references.length, oldSourceSha256: oldHash }))
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
