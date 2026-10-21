const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { load, check } = require('./load-typescript.cjs')

const readiness = load('src/lib/account-lifecycle/checkout-cutover-readiness.ts')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const receipt = load('src/lib/account-lifecycle/checkout-receipt.ts', {
  'node:crypto': crypto, './state': state, './checkout-urls': { checkoutUrls: () => { throw Error('URL generation prohibited') } },
})
const http = load('src/lib/account-lifecycle/checkout-http.ts', {
  'server-only': {}, './state': state, './checkout-receipt': receipt, './checkout': {}, './checkout-store': {},
  './checkout-provider': {}, './checkout-stripe-provider': {}, '@/lib/stripe': {}, '@/lib/prisma': {},
})
const digest = letter => letter.repeat(64)
const expected = { sourceDigest: digest('a'), mode: 'test', dbBindingDigest: digest('b'),
  requiredEntrypoints: ['generic_v1', 'hr_v1'], requiredWorkers: ['checkout_v1_worker'] }
const stopped = id => ({ id, stoppedAt: '2026-10-22T00:00:00Z', evidenceDigest: digest('c') })
const complete = () => ({ version: 1, deploymentSourceDigest: digest('a'), buildSourceDigest: digest('a'), mode: 'test',
  dbBindingDigest: digest('b'), stoppedEntrypoints: [stopped('generic_v1'), stopped('hr_v1')],
  stoppedWorkers: [stopped('checkout_v1_worker')], workerInventoryDigest: digest('d'),
  inFlightReconciliation: [],
  inFlightReconciliationDigest: digest('e'), unresolvedInFlight: 0,
  unresolvedLegacy: { absent_unproven_drain: 0, creating_needs_review: 0, ready_needs_exact_provider: 0, malformed_needs_review: 0 },
  legacyReconciliationDigest: digest('f'), evidenceDigest: digest('0') })

;(async () => {
  await check('unknown operational evidence never becomes a cutover approval', async () => {
    const absent = readiness.inspectCheckoutCutoverReadiness(null, expected)
    assert.equal(absent.status, 'incomplete'); assert.equal(absent.cutoverVerified, false)
    const input = { ...complete(), stoppedWorkers: null, workerInventoryDigest: null, inFlightReconciliation: null, unresolvedInFlight: null }
    const result = readiness.inspectCheckoutCutoverReadiness(input, expected)
    assert.equal(result.status, 'incomplete'); assert.equal(result.cutoverVerified, false)
    assert(result.unknown.includes('stoppedWorkers'))
    assert(result.unknown.includes('in_flight_reconciliation'))
    assert(result.unknown.includes('unresolved_in_flight'))
    assert.equal(readiness.inspectCheckoutCutoverReadiness(complete(), { ...expected, requiredWorkers: null }).status, 'incomplete')
    assert.equal(readiness.inspectCheckoutCutoverReadiness(complete(), { ...expected, requiredEntrypoints: [] }).status, 'incomplete')
  })
  await check('mismatched source, mode, DB and unresolved legacy remain incomplete', async () => {
    const result = readiness.inspectCheckoutCutoverReadiness({ ...complete(), deploymentSourceDigest: digest('9'), mode: 'live',
      dbBindingDigest: digest('8'), unresolvedInFlight: 1,
      unresolvedLegacy: { ...complete().unresolvedLegacy, creating_needs_review: 1 } }, expected)
    assert.equal(result.status, 'incomplete'); assert.equal(result.cutoverVerified, false)
    for (const name of ['deployment_source_mismatch', 'build_source_mismatch', 'mode_mismatch', 'db_binding_mismatch',
      'in_flight_unresolved', 'unresolved_legacy:creating_needs_review']) assert(result.contradictions.includes(name), name)
  })
  await check('even complete synthetic fields are reviewable evidence only', async () => {
    const result = readiness.inspectCheckoutCutoverReadiness(complete(), expected)
    assert.equal(result.status, 'reviewable'); assert.equal(result.cutoverVerified, false)
    assert.equal(result.unknown.length, 0); assert.equal(result.contradictions.length, 0)
  })
  await check('actual epoch reader rejects missing and invalid mode, epoch or coverage without provider IO', async () => {
    const epoch = '11111111-1111-4111-8111-111111111111'
    const valid = { version: 1, mode: 'test', epoch, coverage: 'old_ingress_stopped_and_workers_reconciled', evidenceDigest: digest('a') }
    let reads = 0
    const db = { systemSetting: { findUnique: async ({ where }) => { reads++; assert.equal(where.key, receipt.checkoutKeys.cutover('test')); return row } } }
    let row = null
    for (const value of [null, '{bad', JSON.stringify({ ...valid, mode: 'live' }), JSON.stringify({ ...valid, epoch: 'wrong' }),
      JSON.stringify({ ...valid, coverage: 'source_calls_zero' })]) {
      row = value === null ? null : { value }
      await assert.rejects(http.currentCheckoutEpoch('test', db), error => error.code === 'CHECKOUT_CUTOVER_NOT_VERIFIED' && error.status === 503)
    }
    row = { value: JSON.stringify(valid) }
    assert.equal(await http.currentCheckoutEpoch('test', db), epoch)
    assert.equal(reads, 6)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
