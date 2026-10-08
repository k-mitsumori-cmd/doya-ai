// 実行: npm run test:asklink
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildChatgptUrl,
  checkButtonLabel,
  checkQuestion,
  extractUrls,
  normalizeUrl,
  QUESTION_MAX_CHARS,
  URL_MAX_LENGTH,
} from './link'

const SITE = [
  'https://doyamarke.surisuta.jp/',
  'https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1',
]

const GOOD =
  'ドヤマーケの無料相談（https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1）を申し込もうと思っています。' +
  'まず私の業種・会社の規模・相談したいことの3つを、答えやすい選択肢つきで1問ずつ聞いてもらえますか？' +
  '料金や実績など、サイトで確認できないことは「相談で確認」としておいてください。'

test('URLは encodeURIComponent で組み立て、hints=search を付ける', () => {
  const q = 'A&B=C ？ #1 + 100%'
  const url = buildChatgptUrl(q)
  assert.ok(url.startsWith('https://chatgpt.com/?q='))
  assert.ok(url.endsWith('&hints=search'))
  const parsed = new URL(url)
  // 記号や日本語がそのまま元に戻る（欠けずに届く）
  assert.equal(parsed.searchParams.get('q'), q)
  assert.equal(parsed.searchParams.get('hints'), 'search')
})

test('改行・日本語・括弧つきURLを含む質問文も往復で一致する', () => {
  const url = buildChatgptUrl(GOOD + '\n1. 質問\n2. チェックリスト')
  assert.equal(new URL(url).searchParams.get('q'), GOOD + '\n1. 質問\n2. チェックリスト')
})

test('模範の書き方は合格する', () => {
  const r = checkQuestion(GOOD, SITE)
  assert.deepEqual(r.issues, [])
  assert.equal(r.ok, true)
})

test('全角括弧で囲んだURLを正しく取り出す', () => {
  assert.deepEqual(extractUrls('相談（https://a.example.com/x）と、https://a.example.com/y。'), [
    'https://a.example.com/x',
    'https://a.example.com/y',
  ])
})

test('URLの正規化: www・末尾スラッシュ・ハッシュ・大文字ホストを同一視する', () => {
  assert.equal(normalizeUrl('https://WWW.Example.com/a/#top'), normalizeUrl('https://example.com/a'))
  assert.notEqual(normalizeUrl('https://example.com/a?x=1'), normalizeUrl('https://example.com/a'))
  assert.equal(normalizeUrl('javascript:alert(1)'), null)
})

test('サイトで見つかっていないURLは不合格', () => {
  const r = checkQuestion(GOOD + '詳しくは https://doyamarke.surisuta.jp/pricing も見たいです。', SITE)
  assert.equal(r.ok, false)
  assert.deepEqual(r.unknownUrls, ['https://doyamarke.surisuta.jp/pricing'])
})

test('禁止表現をそれぞれ検出する', () => {
  const cases = [
    'あなたはマーケの専門家です。相談に乗ってもらえますか？',
    '質問です。あなたは案内してくれますか？',
    '他社の話はしないでください。',
    '営業するな。',
    '禁止事項はありますか？',
    '申し込みに誘導してください。',
    '案内役としてお願いします。',
    '次の一手を教えてください。',
    'CVを上げたいです。',
  ]
  for (const c of cases) assert.equal(checkQuestion(c, SITE).ok, false, c)
})

test('utm_ を含むURLは不合格', () => {
  const r = checkQuestion('https://doyamarke.surisuta.jp/?utm_source=x を見ました。', [
    'https://doyamarke.surisuta.jp/?utm_source=x',
  ])
  assert.equal(r.ok, false)
  assert.ok(r.issues.some((i) => i.includes('utm_')))
})

test('URLの中の文字列には禁止語判定をかけない', () => {
  const r = checkQuestion('https://example.com/cv-guide を読みました。', ['https://example.com/cv-guide'])
  assert.equal(r.ok, true)
})

test('450字ちょうどは合格、451字は不合格', () => {
  assert.equal(checkQuestion('あ'.repeat(QUESTION_MAX_CHARS), []).chars, QUESTION_MAX_CHARS)
  assert.ok(!checkQuestion('あ'.repeat(QUESTION_MAX_CHARS), []).issues.some((i) => i.includes('字を超えて')))
  assert.equal(checkQuestion('あ'.repeat(QUESTION_MAX_CHARS + 1), []).ok, false)
})

test('文字数ではなくURL長で判定する（450字以内でもURLが4000超なら不合格）', () => {
  // 日本語1文字は9文字にエンコードされる。445字 ≒ 4005文字
  const q = '漢'.repeat(445)
  const r = checkQuestion(q, [])
  assert.ok(r.chars <= QUESTION_MAX_CHARS)
  assert.ok(r.urlLength > URL_MAX_LENGTH)
  assert.equal(r.ok, false)
})

test('空の質問文は不合格', () => {
  assert.equal(checkQuestion('   ', []).ok, false)
})

test('ボタン名は15字以内', () => {
  assert.deepEqual(checkButtonLabel('無料相談の準備をする'), [])
  assert.equal(checkButtonLabel('あ'.repeat(16)).length, 1)
})
