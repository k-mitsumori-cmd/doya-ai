// 実行: npx tsx --test src/components/home-agent/headlines.test.ts
// 経営ホームの見出しの候補と、選び方の回帰テスト。画面は描かない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HEADLINES, headlineCandidates, japanHour, pickHeadline, timeOfDay } from './headlines'

test('候補: 全部で15〜23個。見出しの「！」は1つまで、問いかけに「！」は付けない', () => {
  assert.ok(HEADLINES.length >= 15 && HEADLINES.length <= 23)
  assert.equal(new Set(HEADLINES.map((h) => h.text)).size, HEADLINES.length, '重ならない')
  for (const h of HEADLINES) {
    assert.ok((h.text.match(/！/g) ?? []).length <= 1, `${h.text}: ！は1つまで`)
    if (h.kind === 'ask') assert.ok(!h.text.includes('！') && h.text.endsWith('？'), `${h.text}: 問いかけは？で終わる`)
    assert.ok(h.text.length <= 26, `${h.text}: 長すぎない（スマホで1文字だけの行を出さない）`)
  }
})

test('問いかけ型と名乗り出る型が、だいたい半々（名前の旗が off の候補で）', () => {
  const list = headlineCandidates({ renamed: false, hour: 12 })
  const ask = list.filter((h) => h.kind === 'ask').length
  const offer = list.length - ask
  assert.ok(Math.abs(ask - offer) <= 3, `問いかけ ${ask} / 名乗り出る ${offer}`)
  const all = HEADLINES.filter((h) => !h.buddy)
  const a2 = all.filter((h) => h.kind === 'ask').length
  assert.ok(Math.abs(a2 - (all.length - a2)) <= 3)
})

test('名前（ドヤバディ）が入る言葉は、旗が on のときだけ候補に入る。ドヤAI とは書かない', () => {
  assert.ok(headlineCandidates({ renamed: false, hour: 12 }).every((h) => !h.text.includes('ドヤバディ') && !h.buddy))
  assert.ok(headlineCandidates({ renamed: true, hour: 12 }).some((h) => h.text.includes('ドヤバディ')))
  for (const h of HEADLINES) assert.ok(!h.text.includes('ドヤAI'), h.text)
  for (const h of HEADLINES) assert.equal(Boolean(h.buddy), h.text.includes('ドヤバディ'), `${h.text}: buddy の印と名前が合う`)
})

test('時間帯: 朝・昼・夜の言葉は、その時間帯だけ。ほかの時間帯には出ない', () => {
  assert.equal(timeOfDay(7), 'morning')
  assert.equal(timeOfDay(13), 'noon')
  assert.equal(timeOfDay(22), 'night')
  assert.equal(timeOfDay(3), 'night')
  const texts = (hour: number) => headlineCandidates({ renamed: false, hour }).map((h) => h.text)
  assert.ok(texts(8).includes('おはようございます。今日は何を一緒にやりますか？'))
  assert.ok(!texts(13).includes('おはようございます。今日は何を一緒にやりますか？'))
  assert.ok(texts(21).includes('お疲れさまです。残りの仕事、引き受けますよ。'))
  assert.ok(!texts(8).includes('お疲れさまです。残りの仕事、引き受けますよ。'))
})

test('選び方: 乱数の端でも落ちず、同じ乱数なら同じ言葉。いつ呼んでも候補の中から出る', () => {
  const opts = { renamed: true, hour: 9 }
  const list = headlineCandidates(opts).map((h) => h.text)
  assert.ok(list.includes(pickHeadline(opts, () => 0)))
  assert.ok(list.includes(pickHeadline(opts, () => 0.999999)))
  assert.equal(pickHeadline(opts, () => 0.3), pickHeadline(opts, () => 0.3))
  const seen = new Set<string>()
  for (let i = 0; i < 400; i++) seen.add(pickHeadline(opts, () => Math.random()))
  assert.ok(seen.size >= list.length - 2, 'ほぼ全部の言葉が出る')
})

test('日本時間の「時」: UTC 0時 = 日本の9時、UTC 15時 = 日本の0時', () => {
  assert.equal(japanHour(new Date('2026-10-30T00:00:00Z')), 9)
  assert.equal(japanHour(new Date('2026-10-30T15:00:00Z')), 0)
  assert.equal(japanHour(new Date('2026-10-30T14:59:00Z')), 23)
})
