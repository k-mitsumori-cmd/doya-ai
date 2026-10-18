// ドヤ社内インタビュー 単体テスト（npm run test:shanai）
// DB・LLM・外部通信は使わない（読み取り関数は偽の DB で確かめる）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quoteExists } from './evidence'
import { robotsAllows, wildcardMatch } from './robots'
import { checkSurvey, sanitizeAnswers, SURVEY_QUESTIONS } from './survey'
import { isSurveyToken, newSurveyToken } from './token'
import { SHANAI_NAV, isNavActive } from './nav'
import { listInterviews, countInterviews } from './interviews-read'
import { SHANAI_AGENT_TOOLS, findShanaiTool, ApprovalRequiredError } from './agent-tools'

test('引用の照合: 空白・言い淀みの揺れは許し、数字の改変は通さない', () => {
  assert.equal(quoteExists('お客様の声を直接聞けるのが楽しい', '本当に、お客様の声を 直接聞けるのが楽しいんです'), true)
  assert.equal(quoteExists('導入社数は500社', '導入社数は300社です'), false)
  assert.equal(quoteExists('あ', 'あいう'), false)
})

test('robots.txt の照合: ワイルドカードと末尾 $、悪意あるパターンでも即座に終わる', () => {
  assert.equal(wildcardMatch('/admin', '/admin/x'), true)
  assert.equal(wildcardMatch('/*.pdf$', '/a/b.pdf'), true)
  assert.equal(wildcardMatch('/*.pdf$', '/a/b.pdf?x'), false)
  assert.equal(wildcardMatch('/p*q', '/p123'), false)
  const t = Date.now()
  wildcardMatch('/' + '*a'.repeat(100) + 'b', '/' + 'a'.repeat(2000))
  assert.ok(Date.now() - t < 200)
  assert.equal(robotsAllows({ disallow: ['/private'], allow: ['/private/ok'] }, '/private/ok/page'), true)
  assert.equal(robotsAllows({ disallow: ['/private'], allow: [] }, '/private/x'), false)
})

test('アンケート: 最低文字数を満たすまで提出できず、追加質問の文面は利用者が書き換えられない', () => {
  assert.equal(checkSurvey({}).canSubmit, false)
  const full = Object.fromEntries(SURVEY_QUESTIONS.map((q) => [q.id, { answer: 'あ'.repeat(q.minChars) }]))
  assert.equal(checkSurvey(full).canSubmit, true)
  assert.deepEqual(sanitizeAnswers({ career: { answer: 'x', followupQuestion: '書き換え' } }), { career: { answer: 'x' } })
  assert.equal(sanitizeAnswers({ unknown: { answer: 'x' } }).unknown, undefined)
})

test('回答URLのトークンは推測できない形式', () => {
  const a = newSurveyToken()
  assert.equal(isSurveyToken(a), true)
  assert.notEqual(a, newSurveyToken())
  assert.equal(isSurveyToken('ckabcdefghijklmnopqrstuv'), false)
})

test('ナビ: データだけで選択中を判定する（R-1）', () => {
  const list = SHANAI_NAV.find((n) => n.href === '/shanai')!
  assert.equal(isNavActive(list, '/shanai/interviews/abc'), true)
  assert.equal(isNavActive(list, '/shanai/company'), false)
  assert.ok(SHANAI_NAV.every((n) => n.href.startsWith('/shanai')))
})

test('読み取り関数: userId で絞り、userId が無ければ DB を呼ばない（R-4・D-5）', async () => {
  const calls: any[] = []
  const fakeDb: any = {
    shanaiInterview: {
      findMany: async (args: any) => {
        calls.push(args)
        return [
          { id: 'i1', mode: 'voice', status: 'DONE', intervieweeName: '山田', department: 'CS', position: '', createdAt: new Date(0), updatedAt: new Date(0), articles: [{ id: 'a', title: '記事', version: 1 }], photos: [{ id: 'p' }] },
        ]
      },
      count: async (args: any) => (args.where.status === 'DONE' ? 1 : 3),
    },
  }
  const rows = await listInterviews('user-1', { limit: 999 }, fakeDb)
  assert.equal(calls[0].where.userId, 'user-1')
  assert.equal(calls[0].take, 200)
  assert.equal(rows[0].latestTitle, '記事')
  assert.equal(rows[0].photoCount, 1)
  assert.deepEqual(await listInterviews('', {}, fakeDb), [])
  assert.equal(calls.length, 1)
  assert.deepEqual(await countInterviews('user-1', fakeDb), { total: 3, done: 1, inProgress: 2 })
})

test('エージェント道具: 区分は §5 のとおりで、回答URLの送付は承認なしでは動かない', async () => {
  assert.deepEqual(
    SHANAI_AGENT_TOOLS.map((t) => [t.key, t.effect, t.approval]),
    [
      ['shanai.listInterviews', 'read', 'none'],
      ['shanai.draftArticle', 'reversible', 'setting'],
      ['shanai.sendAnswerLink', 'irreversible', 'required'],
    ]
  )
  await assert.rejects(() => findShanaiTool('shanai.sendAnswerLink')!.run({ userId: 'u' } as any, { interviewId: 'x', email: 'a@b.jp' } as any), ApprovalRequiredError)
})
