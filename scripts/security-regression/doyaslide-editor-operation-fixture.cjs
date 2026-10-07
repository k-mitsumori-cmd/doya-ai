// Editor handler tests mock the hook lifecycle, but use the actual new response
// validator. Legacy test data is translated at this fixture boundary; full hook
// persistence/auth/locks are exercised by the separate StrictMode mounted suite.
const { load } = require('./load-typescript.cjs')
const { readDoyaSlideOperationResponse } = load('src/lib/doyaslide/operation-client.ts', {}, { TextDecoder, Uint8Array, setTimeout, clearTimeout })
module.exports = function install(context) {
  let sequence = 0
  context.operation = {
    blocked: false,
    acknowledge: () => true,
    submit: async (kind, body, signal, slideId) => {
      const operationId = '10000000-0000-4000-8000-' + String(++sequence).padStart(12, '0')
      const { res, data } = await context.readSlideResponse('/api/doyaslide/operations', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, projectId: context.id, kind, operationId, ...(slideId ? { slideId } : {}) }) }, 310000)
      let payload = data
      if (data && (Array.isArray(data.slides) || data.slide)) {
        const slides = kind === 'batch' ? data.slides : [data.slide]
        const outputs = slides.filter(slide => slide?.imageUrl).slice(-4)
        payload = { operationId, projectId: slides[0]?.projectId || context.id, kind, state: outputs.length ? 'completed' : data.errorCount ? 'failed' : 'completed', results: outputs.map(slide => ({ slideId: slide.id, imageUrl: slide.imageUrl, rawImageUrl: slide.rawImageUrl, version: slide.version, model: slide.model })), errorCount: data.errorCount ?? 0, skipped: data.skipped ?? 0, deferred: 0, limit: data.limit ?? 20, quota: data.quota }
      }
      return readDoyaSlideOperationResponse(Response.json(payload, { status: res.status }), { operationId, projectId: context.id, kind, slideId }, signal)
    },
  }
}
