const crypto = require('node:crypto')
const { load } = require('./load-typescript.cjs')
/** Synthetic operations for input/provider unit tests. Real transactions are covered separately. */
exports.textHttpFixture = function (reserve) {
  const saved = new Map()
  class BannerTextOperationError extends Error { constructor(status, message) { super(message); this.status = status } }
  const key = (actor, kind, id) => JSON.stringify([actor, kind, id])
  const operations = {
    BannerTextOperationError,
    isValidBannerTextResult: load('src/lib/banner/text-operation.ts', { 'node:crypto': crypto, '@/lib/prisma': { prisma: {} }, './text-budget': {} }).isValidBannerTextResult,
    bannerTextOperationId(id) { if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BannerTextOperationError(400, 'Invalid operation'); return id.toLowerCase() },
    bannerTextFingerprint: value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),
    async beginBannerTextOperation(actor, kind, id, inputHash) {
      const k = key(actor, kind, id), old = saved.get(k)
      if (old) { if (old.inputHash !== inputHash) throw new BannerTextOperationError(409, 'Changed input'); return old }
      const admitted = await reserve(actor)
      if (admitted.state === 'limit') return admitted
      saved.set(k, { state: 'pending', inputHash, result: null })
      return { state: 'started', usage: admitted.usage }
    },
    async completeBannerTextOperation(actor, kind, id, inputHash, result) { saved.set(key(actor, kind, id), { state: 'completed', inputHash, result }); return result },
    async failBannerTextOperation(actor, kind, id, inputHash) { saved.set(key(actor, kind, id), { state: 'failed', inputHash, result: null }); return 'failed' },
    async recoverBannerTextOperation(actor, kind, id) { return saved.get(key(actor, kind, id)) || { state: 'missing', result: null } }
  }
  return load('src/lib/banner/text-http.ts', {
    'node:crypto': crypto,
    'next/server': { NextResponse: { json: (value, options) => Response.json(value, options) } },
    './text-budget': { bannerTextLimitPayload: (usage, upgradeAvailable) => ({ code: 'DAILY_TEXT_LIMIT_REACHED', usage, ...(upgradeAvailable ? { upgradeUrl: '/banner/pricing' } : {}) }) },
    './text-operation': operations
  }, { setTimeout, clearTimeout, TextDecoder, Uint8Array })
}
