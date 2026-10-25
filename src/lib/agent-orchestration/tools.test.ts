// 実行: npx tsx --test src/lib/agent-orchestration/tools.test.ts
// 商談の準備を、各ツールの呼び出しを差し替えて最後まで動かす（AI・DB・課金には触れない）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SALES_PREP, matchRecipe, normalizeCompanyUrl, parseSalesPrepAnswers, sampleAnswers, type SalesPrepAnswers } from './recipes'
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
