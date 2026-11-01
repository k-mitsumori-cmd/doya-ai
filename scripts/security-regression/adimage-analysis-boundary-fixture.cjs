// Actual request/output parser and HTTP formatter, with synthetic in-memory
// admission only. Real receipts, rollback and concurrency are tested in private PG.
const { load } = require('./load-typescript.cjs'), crypto = require('node:crypto')
function connect(mocks, options) {
  const globals = { TextEncoder, TextDecoder, setTimeout, clearTimeout }
  const output = load('src/lib/adimage/analysis-result.ts', { './types': load('src/lib/adimage/types.ts') }, globals)
  const actual = load('src/lib/adimage/image-operation.ts', { 'node:crypto': crypto, './access': {}, './image-budget': {} }, globals)
  const prisma = mocks['@/lib/prisma'].prisma
  let pending = false, saved
  prisma.adImageBrand.findFirst = async () => saved ? { id: saved.id, userId: 'test' } : null
  const core = { ...actual, adImageTargetHash: () => 'a'.repeat(64), recoverAdImageOperation: async () => { pending = false; saved = null; return { state: 'missing' } }, beginAdImageOperation: async () => {
    options.admit(); const reason = options.reason()
    if (reason === 'limit') return { state: 'limit', quota: { ok: false, reason: 'Daily cap', code: 'ANALYSIS_DAILY_LIMIT', limitReached: true, ...(options.plan() === 'PRO' ? { contactUrl: 'https://doyamarke.surisuta.jp/contact' } : { upgradeUrl: '/adimage/pricing' }) } }
    if (reason) return { state: reason }
    pending = true; return { state: 'started' }
  }, settleAdImageAnalysisOperation: async (input, result, write) => { saved = await write(prisma); pending = false; options.finish(false); return { ...input, brandId: saved.id, targetHash: 'a'.repeat(64), analysisResult: result } },
  failAdImageAnalysisOperation: async (input, refund, failure) => { pending = false; options.finish(refund); return { state: 'failed', receipt: { ...input, analysisFailure: failure } } }, failAdImageOperation: async () => { if (pending) { pending = false; options.finish(false) } } }
  mocks['@/lib/adimage/analysis-input'] = load('src/lib/adimage/analysis-input.ts', {}, globals)
  mocks['@/lib/adimage/analysis-result'] = output
  mocks['@/lib/adimage/image-operation'] = core
  mocks['@/lib/adimage/image-operation-http'] = load('src/lib/adimage/image-operation-http.ts', { 'next/server': mocks['next/server'], '@/lib/prisma': { prisma }, './access': mocks['@/lib/adimage/access'], './storage': {}, './placements': {}, '@/lib/fetch-timeout': {}, './image-operation': core, './analysis-result': output }, globals)
}
module.exports = { connect }
