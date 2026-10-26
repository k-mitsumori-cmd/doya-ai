// 実行: npm run test:tenjikai
// 2026-10-26 のユーザーの指摘への直しを確かめる。課金 API・DB は使わない（fetch は差し替える）。
// 1. 小間の大きさ（横 ○m × 奥行 ○m）を入れられ、3D と面の数・大きさがその値に合う
// 2. 根拠の無い来場者の人数（「4日間で1,300人」など）を画面に出さない
// 3. 「面の画像をまとめて作る」で、すぐ「作り始めました」の状態になり、面ごとに進み具合と失敗の理由が残る
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SAMPLE_INPUT, analyzeSite, boothSize, checkBoothMeter, computeBudget, generateBoothPlans, generateCreatives, generateNovelties, isValidBoothMeter, withBoothSize } from './engine'
import * as engine from './engine'
import { generateGraphicPlan } from './graphics'
import { NO_IMAGE_MESSAGE, SKIPPED_MESSAGE, batchSummary, runPanelBatch, type BatchFace, type BatchResult } from './batch'
import { IMAGEGEN_DISABLED_MESSAGE, isImageGenDisabled, requestImages } from '../../components/tenjikai/useImageGen'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

// ---------- 1. 小間の大きさ ----------

test('小間の大きさは 1〜30m・0.5m 刻みだけを受け付ける', () => {
  for (const ok of [1, 1.5, 3, 4.5, 29.5, 30]) assert.equal(isValidBoothMeter(ok), true, String(ok))
  for (const ng of [0, 0.5, 0.9, 2.97, 3.2, 30.5, 31, -3, Number.NaN, Number.POSITIVE_INFINITY, '3', null, undefined]) assert.equal(isValidBoothMeter(ng), false, String(ng))
  assert.deepEqual(checkBoothMeter('横', '4.5'), { ok: true, value: 4.5 })
  assert.deepEqual(checkBoothMeter('横', '４．５'), { ok: true, value: 4.5 }) // 全角の数字も読む
  const msg = (r: ReturnType<typeof checkBoothMeter>) => (r.ok ? '' : r.message)
  assert.match(msg(checkBoothMeter('横', '')), /横の長さを入れて/)
  assert.match(msg(checkBoothMeter('奥行', 'abc')), /数字で/)
  assert.match(msg(checkBoothMeter('奥行', '31')), /1〜30m/)
  assert.match(msg(checkBoothMeter('横', '3.2')), /0\.5m刻み/)
})

test('入れた横と奥行が、ブース案・3D の大きさになる', () => {
  for (const [w, d] of [[4.5, 3], [12, 6], [1, 1], [30, 30]] as const) {
    const input = withBoothSize(SAMPLE_INPUT, w, d)
    assert.equal(boothSize(input).w, w)
    assert.equal(boothSize(input).d, d)
    for (const plan of generateBoothPlans(input)) {
      assert.equal(plan.widthM, w)
      assert.equal(plan.depthM, d)
      // 置いた部材は、小間の中に収まる
      for (const e of plan.elements) assert.ok(e.x >= 0 && e.y >= 0 && e.x + e.w <= w + 0.01 && e.y + e.d <= d + 0.01, `${plan.variant} ${e.id}`)
    }
  }
})

test('面の数と大きさは、入れた横幅に合わせて変わる', () => {
  const a = analyzeSite(SAMPLE_INPUT.serviceUrl)
  const backwall = (w: number) => {
    const plan = generateBoothPlans(withBoothSize(SAMPLE_INPUT, w, 6))[0]
    return generateGraphicPlan(plan, a).filter((p) => p.elementId === 'w1')
  }
  const six = backwall(6)
  const twelve = backwall(12)
  assert.equal(six.length, 3)
  assert.equal(twelve.length, 6)
  assert.equal(six.reduce((s, p) => s + p.widthMm, 0), 6000)
  assert.equal(twelve.reduce((s, p) => s + p.widthMm, 0), 12000)
  // 制作物の背面壁の寸法も、入れた横幅に合う
  const creatives = generateCreatives(a, withBoothSize(SAMPLE_INPUT, 7.5, 3))
  assert.equal(creatives.find((c) => c.kind === 'backwall')!.widthMm, 7500)
})

test('小間料は、入れた広さを会場の基礎小間の面積で割った数で数える', () => {
  const input = withBoothSize({ ...SAMPLE_INPUT, venueId: 'makuhari' }, 6, 6) // 基礎小間 3m
  assert.equal(boothSize(input).komas, 4)
  assert.equal(input.komaCols, 2)
  assert.equal(input.komaRows, 2)
  const plan = generateBoothPlans(input)[0]
  const space = computeBudget(input, plan, [], generateNovelties(input), []).find((b) => b.category === 'space')!
  assert.equal(space.amountYen, 400000 * 4)
  // 最低1小間
  assert.equal(boothSize(withBoothSize(input, 1, 1)).komas, 1)
})

test('前の版で保存した内容（横・奥行が無い）は、今までどおり小間の列と行で決める', () => {
  const { widthM: _w, depthM: _d, ...old } = SAMPLE_INPUT
  const s = boothSize(old)
  assert.equal(s.w, 5.94)
  assert.equal(s.komas, 4)
})

test('サーバー（/api/tenjikai/generate）も同じ決まりで小間の大きさを確かめる', () => {
  const src = read('src/app/api/tenjikai/generate/route.ts')
  assert.match(src, /isValidBoothMeter\(b\.widthM\) && isValidBoothMeter\(b\.depthM\)/)
  assert.match(src, /if \(hasSize && !\(/)
})

// ---------- 2. 来場者の人数を出さない ----------

test('根拠の無い来場者の人数を、画面にも AI への指示にも出さない', () => {
  assert.equal('expectedVisitors' in engine, false, 'expectedVisitors は人数に見えるので使わない（数量の目安は handoutBase）')
  const dir = 'src/components/tenjikai'
  const files = [...readdirSync(join(root, dir)).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts')).map((f) => join(dir, f)), 'src/app/(shell)/tenjikai/Lp.tsx', 'src/lib/tenjikai/ai.ts']
  for (const f of files) {
    const src = read(f)
    assert.doesNotMatch(src, /expectedVisitors|handoutBase/, `${f}: 数量の目安の数を画面に出していない`)
    assert.doesNotMatch(src, /想定来場|来場\s*\$\{|人分のノベルティ|来場者は\s*\$\{/, `${f}: 来場者の人数を出していない`)
  }
})

// ---------- 3. まとめて作る ----------

const faces = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `面${i + 1}` }))

test('押したらすぐ、1面目が「作成中」・残りが「待ち」になる', async () => {
  const updates: BatchFace[][] = []
  let release: (r: BatchResult) => void = () => {}
  const run = runPanelBatch(faces(3), () => new Promise<BatchResult>((r) => (release = r)), { onUpdate: (f) => updates.push(f), onImage: () => {} })
  await Promise.resolve()
  assert.deepEqual(updates[0].map((f) => f.status), ['working', 'waiting', 'waiting'])
  assert.equal(batchSummary(updates[0]).running, true)
  release({ ok: true, images: ['data:image/png;base64,AA'] })
  // 残りの面は、そのまま成功させる
  await new Promise((r) => setTimeout(r, 0))
  release({ ok: true, images: ['data:image/png;base64,BB'] })
  await new Promise((r) => setTimeout(r, 0))
  release({ ok: true, images: ['data:image/png;base64,CC'] })
  assert.equal(await run, undefined)
  const last = updates[updates.length - 1]
  assert.deepEqual(last.map((f) => f.status), ['done', 'done', 'done'])
  assert.deepEqual(batchSummary(last), { total: 3, done: 3, failed: 0, finished: 3, running: false })
})

test('1面が失敗しても、理由を残して次の面へ進む', async () => {
  const images: string[] = []
  let last: BatchFace[] = []
  const results: BatchResult[] = [
    { ok: true, images: ['A'] },
    { ok: false, tone: 'error', message: '画像を作れませんでした。時間をおいて、もう一度お試しください。' },
    { ok: true, images: [] },
    { ok: true, images: ['D'] },
  ]
  let i = 0
  const stop = await runPanelBatch(faces(4), async () => results[i++], { onUpdate: (f) => (last = f), onImage: (_p, img) => images.push(img) })
  assert.equal(stop, undefined)
  assert.deepEqual(images, ['A', 'D'])
  assert.deepEqual(last.map((f) => f.status), ['done', 'failed', 'failed', 'done'])
  assert.match(last[1].message!, /作れませんでした/)
  assert.equal(last[2].message, NO_IMAGE_MESSAGE)
  assert.deepEqual(batchSummary(last), { total: 4, done: 2, failed: 2, finished: 4, running: false })
})

test('止めている（準備中）ときは、理由を出して残りの面を作らない', async () => {
  let calls = 0
  let last: BatchFace[] = []
  const stop = await runPanelBatch(faces(3), async () => {
    calls++
    return { ok: false, tone: 'disabled', message: IMAGEGEN_DISABLED_MESSAGE }
  }, { onUpdate: (f) => (last = f), onImage: () => {} })
  assert.equal(calls, 1, '課金の API に何度も送らない')
  assert.equal(stop?.tone, 'disabled')
  assert.deepEqual(last.map((f) => f.status), ['failed', 'skipped', 'skipped'])
  assert.equal(last[0].message, IMAGEGEN_DISABLED_MESSAGE)
  assert.equal(last[1].message, SKIPPED_MESSAGE)
})

test('通信の例外も、その面の失敗として扱う', async () => {
  let last: BatchFace[] = []
  await runPanelBatch(faces(1), async () => {
    throw new Error('offline')
  }, { onUpdate: (f) => (last = f), onImage: () => {} })
  assert.equal(last[0].status, 'failed')
  assert.match(last[0].message!, /通信できませんでした/)
})

function stubFetch(status: number, body: unknown) {
  const orig = globalThis.fetch
  globalThis.fetch = (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as typeof fetch
  return () => {
    globalThis.fetch = orig
  }
}

test('サーバーの答えを、面ごとの失敗の理由（日本語）に直す', async () => {
  const cases: [number, unknown, string, RegExp][] = [
    [403, { error: '画像の生成は準備中です。' }, 'disabled', /管理者の設定でまだ止めています（準備中）/],
    [401, { error: 'ログインが必要です。' }, 'forbidden', /ログイン/],
    [429, { error: 'きょう作れる枚数の上限（10枚）に達しました。' }, 'limit', /上限（10枚）/],
    [500, { error: '画像を作るための設定が済んでいないため、作れません。管理者に連絡してください。' }, 'error', /設定が済んでいない/],
    [503, { error: '実行の記録を残せないため、画像を作れません。' }, 'error', /記録を残せない/],
    [504, '<html>timeout</html>', 'error', /時間がかかりすぎた/],
    [502, 'not json', 'error', /画像を作れませんでした/],
  ]
  for (const [status, body, tone, re] of cases) {
    const restore = stubFetch(status, body)
    try {
      const r = await requestImages({ prompt: 'x', aspectRatio: '1:1', kind: 'graphic_panel' })
      assert.equal(r.ok, false, String(status))
      if (!r.ok) {
        assert.equal(r.tone, tone, String(status))
        assert.match(r.message, re, String(status))
        assert.doesNotMatch(r.message, /\b\d{3}\b/, `${status}: ステータスコードを見せない`)
      }
    } finally {
      restore()
    }
  }
})

test('「止めている」は、サーバーが enabled: false と答えたときだけ（未ログイン・通信の失敗は含めない）', () => {
  assert.equal(isImageGenDisabled({ enabled: false, remaining: 0, perDay: 10 }), true)
  assert.equal(isImageGenDisabled({ enabled: false, unknown: true, remaining: null, perDay: 0 }), false)
  assert.equal(isImageGenDisabled({ enabled: true, remaining: 3, perDay: 10 }), false)
  assert.equal(isImageGenDisabled(null), false)
})

test('確認の画面は body の直下に描く（親の transform で画面の真ん中から外れないように）', () => {
  const ui = read('src/components/tenjikai/ui.tsx')
  assert.match(ui, /createPortal\(/)
  assert.match(ui, /document\.body/)
  assert.match(ui, /fixed inset-0[^"]*items-center[^"]*justify-center/)
  const studio = read('src/components/tenjikai/BoothStudio.tsx')
  // まとめて作るときに、確認の画面を閉じて別の場所へ移らない（前は 3D へ移り、知らせが画面の外に出ていた）
  assert.doesNotMatch(studio, /scrollIntoView/)
  assert.match(studio, /作り始めました/)
  assert.match(studio, /data-face-status/)
})

test('展示会の画面は h1 を出さない（ページの h1 は枠の「ドヤ展示会」の1つだけ。2026-10-26 統括の本番の確認）', () => {
  const dir = join(process.cwd(), 'src/components/tenjikai')
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.tsx'))) {
    assert.doesNotMatch(readFileSync(join(dir, f), 'utf8'), /<h1[\s>]/, f)
  }
})
