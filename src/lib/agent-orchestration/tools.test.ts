// 実行: npx tsx --test src/lib/agent-orchestration/tools.test.ts
// 商談の準備を、各ツールの呼び出しを差し替えて最後まで動かす（AI・DB・課金には触れない）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SALES_PREP, matchRecipe, normalizeCompanyUrl, parseSalesPrepAnswers, sampleAnswers, slideInputOf, type SalesPrepAnswers } from './recipes'
import { runAgentTasks, progressOf } from './runner'
import { fakeToolDeps, runSalesPrepTask, toTaskError, type ToolDeps, type ToolRouteId, type SalesPrepTaskId } from './tools'

const answers = { url: 'example.co.jp', offer: 'web', budget: '50to200', stage: 'proposal' }
const parsed = () => {
  const p = parseSalesPrepAnswers(answers)
  assert.ok(p.ok)
  return p.value as SalesPrepAnswers
}

/** 呼ばれたルートと本文を記録する差し替え */
function recording(base: ToolDeps = fakeToolDeps({ delayMs: 1 })) {
  const calls: { route: ToolRouteId; body: Record<string, unknown> }[] = []
  const deps: ToolDeps = { ...base, call: async (route, body) => { calls.push({ route, body }); return base.call(route, body) } }
  return { deps, calls }
}

test('答えを確かめる: URL・選択肢が正しくなければ、直す質問を返す', () => {
  assert.deepEqual(parseSalesPrepAnswers({ ...answers, url: 'javascript:alert(1)' }), { ok: false, questionId: 'url', error: '相手の会社のサイトの URL を入れてください。' })
  assert.equal((parseSalesPrepAnswers({ ...answers, offer: 'x' }) as { questionId: string }).questionId, 'offer')
  assert.equal(normalizeCompanyUrl('https://user:pw@example.com'), null)
  assert.equal(normalizeCompanyUrl('localhost'), null)
  const v = parsed()
  assert.equal(v.url, 'https://example.co.jp/')
  assert.equal(v.domain, 'example.co.jp')
  assert.equal(v.slideCount, 8)
  // 例の答えは URL だけが空（ここだけは入力が要る）
  assert.equal(parseSalesPrepAnswers(sampleAnswers(SALES_PREP)).ok, false)
})

test('入力した文から組み合わせを選ぶ', () => {
  assert.equal(matchRecipe('来週の 商談の準備 を手伝って')?.id, 'sales-prep')
  assert.equal(matchRecipe('バナーを作りたい'), null)
})

test('各ツールのルートに、答えから作った入力だけを渡す', async () => {
  const { deps, calls } = recording()
  const a = parsed()
  await runSalesPrepTask('research', a, deps)
  await runSalesPrepTask('quote', a, deps)
  await runSalesPrepTask('slides', a, deps)
  assert.deepEqual(calls.map((c) => c.route), ['shodan.prepare', 'quote.suggest', 'quote.create', 'slide.project', 'slide.structure'])
  assert.deepEqual(calls[0].body, { url: 'https://example.co.jp/' })
  assert.equal(calls[1].body.productName, 'Webサイト制作')
  assert.equal(calls[1].body.budget, 2_000_000)
  assert.equal((calls[2].body.items as unknown[]).length, 3)
  assert.equal(calls[3].body.docType, 'proposal')
  assert.equal(calls[3].body.slideCount, 8)
  assert.deepEqual(calls[4].body, { projectId: 'slide_sample', referenceUrl: 'https://example.co.jp/' })
})

test('結果は、各ツールの画面へのリンクと要点にまとめる', async () => {
  const a = parsed()
  const deps = fakeToolDeps({ delayMs: 1 })
  const r = await runSalesPrepTask('research', a, deps)
  assert.equal(r.href, '/shodan/sample/p/prep_sample')
  assert.match(r.summary, /見本株式会社/)
  const q = await runSalesPrepTask('quote', a, deps)
  assert.equal(q.href, '/quote/documents/quote_sample')
  // 300,000 + 9×60,000 + 3×30,000 = 930,000
  assert.match(q.summary, /93万円/)
  const s = await runSalesPrepTask('slides', a, deps)
  assert.equal(s.href, '/doyaslide/slide_sample')
})

test('ルートの失敗を、種類と利用者向けの文に直す', () => {
  const setup = toTaskError('shodan', { status: 401, data: { error: 'ログイン/組織が必要です' } }, 'x')
  assert.equal(setup.kind, 'setup')
  assert.equal(setup.href?.href, '/shodan')
  const power = toTaskError('quote', { status: 402, data: { error: 'ドヤパワーが足りません。', code: 'DOYA_POWER_INSUFFICIENT' } }, 'x')
  assert.equal(power.kind, 'power')
  assert.equal(power.userMessage, 'ドヤパワーが足りません。')
  const limit = toTaskError('shodan', { status: 402, data: { error: '無料プランは月3件までです。', code: 'LIMIT', upgradeUrl: '/shodan/pricing?org=a' } }, 'x')
  assert.equal(limit.kind, 'limit')
  assert.equal(limit.href?.href, '/shodan/pricing?org=a')
  // 外のサイトへのリンクは使わない
  assert.equal(toTaskError('quote', { status: 402, data: { code: 'LIMIT_REACHED', upgradeUrl: '//evil.example/x' } }, 'x').href, undefined)
  assert.equal(toTaskError('doyaslide', { status: 429, data: { code: 'DOYASLIDE_TEXT_DAILY_LIMIT' } }, '既定の文').userMessage, '既定の文')
  assert.equal(toTaskError('doyaslide', { status: 401, data: {} }, 'x').kind, 'auth')
  // 長すぎる・文字列でない error は使わない
  assert.equal(toTaskError('quote', { status: 500, data: { error: 'x'.repeat(500) } }, '既定の文').userMessage, '既定の文')
})

test('商談の準備を最後まで動かす: 3つを同時に動かし、スライドの失敗だけを、作ったプロジェクトを使ってやり直す', async () => {
  const a = parsed()
  const flag = { done: false }
  const { deps, calls } = recording(fakeToolDeps({ delayMs: 5, failSlidesOnce: flag }))
  let peak = 0
  const execute = (t: { id: string }, ctx: { resume?: Record<string, string> }) => runSalesPrepTask(t.id as SalesPrepTaskId, a, deps, ctx.resume)
  const first = await runAgentTasks({ tasks: SALES_PREP.tasks, concurrency: 3, execute, onChange: (s) => { peak = Math.max(peak, progressOf(s).running) } })
  assert.equal(peak, 3)
  assert.equal(first.research.status, 'done')
  assert.equal(first.quote.status, 'done')
  assert.equal(first.slides.status, 'failed')
  assert.equal(first.slides.error, '構成の生成に失敗しました。もう一度お試しください。')
  assert.deepEqual(first.slides.resume, { projectId: 'slide_sample' })

  calls.length = 0
  const second = await runAgentTasks({ tasks: SALES_PREP.tasks, execute, prev: first })
  // 済んだ2つは動かさず、スライドは構成だけを作り直す（プロジェクトを二重に作らない）
  assert.deepEqual(calls.map((c) => c.route), ['slide.structure'])
  assert.equal(second.slides.status, 'done')
  assert.equal(progressOf(second).done, 3)
})

test('ドヤパワー: 包みが付いたルートで減ったまま（操作のキーあり）を used、失敗して戻したものを refunded に数える', async () => {
  const a = parsed()
  const ok = await runSalesPrepTask('slides', a, fakeToolDeps({ delayMs: 0, powerOn: true }))
  assert.deepEqual(ok.power, { used: 30, refunded: 0 })
  const q = await runSalesPrepTask('quote', a, fakeToolDeps({ delayMs: 0, powerOn: true }))
  assert.deepEqual(q.power, { used: 1, refunded: 0 })
  // 構成で失敗 → 包みが戻した
  await assert.rejects(runSalesPrepTask('slides', a, fakeToolDeps({ delayMs: 0, powerOn: true, failSlidesOnce: { done: false } })), (e: { power?: unknown }) => {
    assert.deepEqual(e.power, { used: 0, refunded: 30 })
    return true
  })
  // 見積の品目の案は作れたが、保存で失敗した → 案の分は減ったまま（戻していない）
  const half: ToolDeps = fakeToolDeps({ delayMs: 0, powerOn: true })
  const base = half.call
  half.call = async (route, body) => (route === 'quote.create' ? { status: 503, data: { error: '保存できませんでした。' } } : base(route, body))
  await assert.rejects(runSalesPrepTask('quote', a, half), (e: { power?: unknown }) => {
    assert.deepEqual(e.power, { used: 1, refunded: 0 })
    return true
  })
  // ドヤパワーを使わない人は、どちらも 0
  assert.deepEqual((await runSalesPrepTask('slides', a, fakeToolDeps({ delayMs: 0 }))).power, { used: 0, refunded: 0 })
  // 残りが足りずに断られた（DOYA_POWER_INSUFFICIENT）ときは、減っていないので戻してもいない
  const short: ToolDeps = { ...fakeToolDeps({ delayMs: 0, powerOn: true }), call: async () => ({ status: 402, data: { error: 'ドヤパワーが足りません。', code: 'DOYA_POWER_INSUFFICIENT' } }) }
  await assert.rejects(runSalesPrepTask('quote', a, short), (e: { power?: unknown; kind?: string }) => {
    assert.equal(e.kind, 'power')
    assert.deepEqual(e.power, { used: 0, refunded: 0 })
    return true
  })
})

test('runner は、試みごとのドヤパワーを足していく', async () => {
  const a = parsed()
  const flag = { done: false }
  const deps = fakeToolDeps({ delayMs: 0, powerOn: true, failSlidesOnce: flag })
  const execute = (t: { id: string }, ctx: { resume?: Record<string, string> }) => runSalesPrepTask(t.id as SalesPrepTaskId, a, deps, ctx.resume)
  const first = await runAgentTasks({ tasks: SALES_PREP.tasks, execute })
  const second = await runAgentTasks({ tasks: SALES_PREP.tasks, execute, prev: first })
  assert.deepEqual(second.slides.power, { used: 30, refunded: 30 })
  assert.deepEqual(second.quote.power, { used: 1, refunded: 0 })
})

test('システム点検の印: 印があるときだけ、見積書・スライドの名前の先頭に付け、商談準備には labelPrefix を渡す', async () => {
  const a = parsed()
  const prefix = '【自動点検】'
  const apply = (name: string, max: number) => (name.startsWith(prefix) ? name : `${prefix}${name}`).slice(0, max)
  const { deps, calls } = recording({ ...fakeToolDeps({ delayMs: 1 }), label: { prefix, apply } })
  await runSalesPrepTask('research', a, deps)
  await runSalesPrepTask('quote', a, deps)
  await runSalesPrepTask('slides', a, deps)
  const body = (r: ToolRouteId) => calls.find((c) => c.route === r)!.body
  assert.equal(body('shodan.prepare').labelPrefix, prefix)
  assert.equal(body('quote.create').title, `${prefix}Webサイトの制作のお見積り`)
  assert.ok(String(body('slide.project').title).startsWith(prefix))
  assert.ok(String(body('slide.project').title).length <= 120)
  // 印が無いときは、何も付けない（ふつうの利用者）
  const plain = recording()
  await runSalesPrepTask('research', a, plain.deps)
  await runSalesPrepTask('quote', a, plain.deps)
  assert.equal('labelPrefix' in plain.calls[0].body, false)
  assert.equal(plain.calls.find((c) => c.route === 'quote.create')!.body.title, 'Webサイトの制作のお見積り')
})

// 2026-10-26 統括の指摘: 構成づくりの途中で関数の時間の上限に当たると、作ったスライドの ID が残らず、
// やり直しのたびに同じ名前のスライドが増えていた
test('スライド: 作ったらすぐ projectId を残し、そのあと構成を作る', async () => {
  const a = parsed()
  const order: string[] = []
  const base = fakeToolDeps({ delayMs: 0 })
  const deps: ToolDeps = {
    ...base,
    call: async (route, body) => { order.push(route); return base.call(route, body) },
    checkpoint: async (r) => { order.push(`checkpoint:${r.projectId}`) },
  }
  await runSalesPrepTask('slides', a, deps)
  assert.deepEqual(order, ['slide.project', 'checkpoint:slide_sample', 'slide.structure'])
  // resume に ID があるときは、作らず、残し直しもしない
  order.length = 0
  await runSalesPrepTask('slides', a, deps, { projectId: 'slide_prev' })
  assert.deepEqual(order, ['slide.structure'])
})

test('スライド: ID が残っていなくても、前の試みで作ったスライドがあれば使う（同じ名前のスライドを増やさない）', async () => {
  const a = parsed()
  const { deps, calls } = recording(fakeToolDeps({ delayMs: 0 }))
  const asked: unknown[] = []
  deps.reusableSlideProject = async (input) => { asked.push(input); return 'slide_left' }
  await runSalesPrepTask('slides', a, deps)
  assert.deepEqual(calls.map((c) => c.route), ['slide.structure'])
  assert.equal(calls[0].body.projectId, 'slide_left')
  // 作戦の中身（段階・提案・予算から作る文）も渡し、答えの違う作戦や手で作ったスライドは使わない
  assert.deepEqual(asked, [{ title: 'example.co.jp 様へのWebサイトの制作のご提案', docType: 'proposal', slideCount: 8, customBrief: slideInputOf(a).customBrief }])
  // 探す部品が失敗しても、作って進む
  const f = recording(fakeToolDeps({ delayMs: 0 }))
  f.deps.reusableSlideProject = async () => { throw new Error('db down') }
  await runSalesPrepTask('slides', a, f.deps)
  assert.deepEqual(f.calls.map((c) => c.route), ['slide.project', 'slide.structure'])
})

test('スライド: 構成が待つ時間を過ぎたら、作ったスライドの ID を resume に入れて失敗にする', async () => {
  const a = parsed()
  const base = fakeToolDeps({ delayMs: 0 })
  const deps: ToolDeps = {
    ...base,
    slideStructureWaitMs: 20,
    call: async (route, body) => (route === 'slide.structure' ? new Promise(() => {}) : base.call(route, body)),
  }
  await assert.rejects(runSalesPrepTask('slides', a, deps), (e: { resume?: Record<string, string>; userMessage?: string }) => {
    assert.deepEqual(e.resume, { projectId: 'slide_sample' })
    assert.match(String(e.userMessage), /同じスライドで続けます/)
    return true
  })
})

test('スライド: 1回目が構成の途中で止められても、やり直しで作るスライドは1つだけ', async () => {
  const a = parsed()
  const made: { id: string; title: string; structured: boolean }[] = []
  let hang = true
  const deps: ToolDeps = {
    ...fakeToolDeps({ delayMs: 0 }),
    slideStructureWaitMs: 30,
    call: async (route, body) => {
      if (route === 'slide.project') { const id = `slide_${made.length + 1}`; made.push({ id, title: String(body.title), structured: false }); return { status: 201, data: { project: { id } } } }
      if (route === 'slide.structure') {
        if (hang) return new Promise(() => {})
        made.find((m) => m.id === body.projectId)!.structured = true
        return { status: 200, data: { slides: [{ headline: '表紙' }] } }
      }
      return { status: 500, data: {} }
    },
    // 本番は DB を探す（routes.server.ts の reusableSlideProject）。ここでは作った物の一覧から探す
    reusableSlideProject: async ({ title }) => made.find((m) => m.title === title && !m.structured)?.id ?? null,
  }
  // 1回目: 構成の途中で関数が止められた（失敗の記録も resume も残らなかったとして、答えを捨てる）
  await runSalesPrepTask('slides', a, deps).catch(() => null)
  // 2回目: resume 無しでやり直す
  hang = false
  const r = await runSalesPrepTask('slides', a, deps)
  assert.equal(made.length, 1)
  assert.equal(r.href, '/doyaslide/slide_1')
})

test('スライド: やり直しで、構成がもうあれば成功にし、構成を作っている途中なら待つように伝える', async () => {
  const a = parsed()
  const reply = (data: Record<string, unknown>): ToolDeps => {
    const base = fakeToolDeps({ delayMs: 0 })
    return { ...base, call: async (route, body) => (route === 'slide.structure' ? { status: 409, data } : base.call(route, body)) }
  }
  const done = await runSalesPrepTask('slides', a, reply({ code: 'DOYASLIDE_STRUCTURE_EXISTS', error: 'x' }), { projectId: 'slide_done' })
  assert.equal(done.href, '/doyaslide/slide_done')
  assert.match(done.summary, /構成はできています/)
  await assert.rejects(runSalesPrepTask('slides', a, reply({ code: 'DOYASLIDE_STRUCTURE_BUSY', error: 'x' }), { projectId: 'slide_busy' }), (e: { resume?: Record<string, string>; userMessage?: string }) => {
    assert.deepEqual(e.resume, { projectId: 'slide_busy' })
    assert.match(String(e.userMessage), /数分おいてから/)
    return true
  })
  // 印の無い 409 は、今までどおり失敗
  await assert.rejects(runSalesPrepTask('slides', a, reply({ error: 'x' }), { projectId: 'slide_x' }))
})
