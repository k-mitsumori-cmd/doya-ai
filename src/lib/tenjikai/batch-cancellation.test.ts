import assert from 'node:assert/strict'
import test from 'node:test'
import { runPanelBatch, type BatchFace, type BatchResult } from './batch'
import { requestImages } from '../../components/tenjikai/useImageGen'

const targets = [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }, { id: 'three', name: 'Three' }]
const success: BatchResult = { ok: true, images: ['data:image/png;base64,c3ludGhldGlj'] }
const input = { prompt: 'synthetic', aspectRatio: '1:1', kind: 'graphic_panel' as const }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function observations() {
  const updates: BatchFace[][] = []
  const images: string[] = []
  return { updates, images, handlers: { onUpdate: (faces: BatchFace[]) => updates.push(faces), onImage: (_target: unknown, image: string) => images.push(image) } }
}

test('中止済みのバッチは要求も画面更新も始めない', async () => {
  const controller = new AbortController()
  controller.abort()
  const seen = observations()
  await runPanelBatch(targets, async () => assert.fail('No request after cancellation'), seen.handlers, controller.signal)
  assert.deepEqual(seen.updates, [])
  assert.deepEqual(seen.images, [])
})

for (const outcome of ['resolve', 'reject'] as const) {
  test(`中止後の遅い${outcome}で次の要求や更新を始めない`, async () => {
    const controller = new AbortController()
    const pending = deferred<BatchResult>()
    const seen = observations()
    let calls = 0
    const work = runPanelBatch(targets, () => { calls++; return pending.promise }, seen.handlers, controller.signal)
    const before = seen.updates.length
    assert.equal(calls, 1)
    controller.abort()
    if (outcome === 'resolve') pending.resolve(success)
    else pending.reject(new Error('synthetic late failure'))
    await work
    assert.equal(calls, 1)
    assert.equal(seen.updates.length, before)
    assert.deepEqual(seen.images, [])
  })
}

test('作成中の通知で中止された場合も要求前に止まる', async () => {
  const controller = new AbortController()
  const seen = observations()
  await runPanelBatch(targets, async () => assert.fail('Cancelled in onUpdate'), {
    onUpdate: () => controller.abort(), onImage: seen.handlers.onImage,
  }, controller.signal)
  assert.deepEqual(seen.images, [])
})

test('1面を受け付けた後の中止は次の面へ進まない', async () => {
  const controller = new AbortController()
  const seen = observations()
  let calls = 0
  await runPanelBatch(targets, async () => { calls++; return success }, {
    onUpdate: seen.handlers.onUpdate,
    onImage: (target, image) => { seen.handlers.onImage(target, image); controller.abort() },
  }, controller.signal)
  assert.equal(calls, 1)
  assert.equal(seen.images.length, 1)
  assert.equal(seen.updates.length, 1, 'No done update after the callback cancels its scope')
})

test('失敗通知で中止された後は残りの面の更新もしない', async () => {
  const controller = new AbortController()
  let calls = 0
  const updates: BatchFace[][] = []
  await runPanelBatch(targets, async () => { calls++; return { ok: false, tone: 'disabled', message: 'synthetic' } }, {
    onUpdate: faces => { updates.push(faces); if (faces[0].status === 'failed') controller.abort() },
    onImage: () => assert.fail('Failure cannot produce an image'),
  }, controller.signal)
  assert.equal(calls, 1)
  assert.equal(updates.length, 2)
})

test('中止されていないバッチは全ての面を順番に作る', async () => {
  const seen = observations()
  const requested: string[] = []
  await runPanelBatch(targets, async target => { requested.push(target.id); return success }, seen.handlers, new AbortController().signal)
  assert.deepEqual(requested, targets.map(target => target.id))
  assert.equal(seen.images.length, 3)
  assert.deepEqual(seen.updates.at(-1)?.map(face => face.status), ['done', 'done', 'done'])
})

async function withFetch(fake: typeof fetch, run: () => Promise<void>) {
  const previous = globalThis.fetch
  globalThis.fetch = fake
  try { await run() } finally { globalThis.fetch = previous }
}

test('中止済みの画像要求はfetchを呼ばない', async () => {
  const controller = new AbortController()
  controller.abort()
  await withFetch(async () => assert.fail('No transport after cancellation'), async () => {
    assert.equal((await requestImages(input, controller.signal)).ok, false)
  })
})

test('実際の要求ヘルパーは同じsignalと既存の承認情報をfetchへ渡す', async () => {
  const controller = new AbortController()
  let calls = 0
  await withFetch(async (url, options) => {
    calls++
    assert.equal(url, '/api/tenjikai/image')
    assert.equal(options?.signal, controller.signal)
    assert.equal(options?.method, 'POST')
    assert.deepEqual(JSON.parse(String(options?.body)), { ...input, count: 1, approved: true })
    return new Response(JSON.stringify({ images: ['synthetic'] }), { status: 200 })
  }, async () => {
    assert.deepEqual(await requestImages(input, controller.signal), { ok: true, images: ['synthetic'] })
    assert.equal(calls, 1)
  })
})

test('fetchが中止を無視して応答しても本文を読まず破棄する', async () => {
  const controller = new AbortController()
  const pending = deferred<Response>()
  let reads = 0
  const response = new Response()
  response.json = async () => { reads++; return { images: ['stale'] } }
  await withFetch(async () => pending.promise, async () => {
    const work = requestImages(input, controller.signal)
    controller.abort()
    pending.resolve(response)
    assert.equal((await work).ok, false)
    assert.equal(reads, 0)
  })
})

test('本文の読み込み中に中止された結果も成功として返さない', async () => {
  const controller = new AbortController()
  const body = deferred<{ images: string[] }>()
  const started = deferred<void>()
  const response = new Response()
  response.json = async () => { started.resolve(); return body.promise }
  await withFetch(async () => response, async () => {
    const work = requestImages(input, controller.signal)
    await started.promise
    controller.abort()
    body.resolve({ images: ['stale'] })
    assert.equal((await work).ok, false)
  })
})

test('fetchへ渡したsignalで進行中の通信を中止できる', async () => {
  const controller = new AbortController()
  await withFetch(async (_url, options) => new Promise<Response>((_resolve, reject) => {
    assert.equal(options?.signal, controller.signal)
    options?.signal?.addEventListener('abort', () => reject(new Error('synthetic abort')), { once: true })
  }), async () => {
    const work = requestImages(input, controller.signal)
    controller.abort()
    assert.equal((await work).ok, false)
  })
})

test('signalを渡さない既存呼び出しの失敗分類は変わらない', async () => {
  for (const [status, tone] of [[401, 'forbidden'], [403, 'disabled'], [402, 'limit'], [429, 'limit'], [504, 'error'], [500, 'error']] as const) {
    await withFetch(async () => new Response('{}', { status }), async () => {
      const result = await requestImages(input)
      assert.equal(result.ok, false)
      if (!result.ok) assert.equal(result.tone, tone)
    })
  }
})
