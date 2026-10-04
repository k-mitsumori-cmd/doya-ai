const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const quote = '複数部門と調整して導入しました'
const candidateText = `私は${quote}。その後も運用を改善しました。`.repeat(12)
let raw
const { evaluateSession } = load('src/lib/mensetsu/evaluate.ts', {
  '@seo/lib/gemini': { GEMINI_TEXT_MODEL_DEFAULT: 'test', geminiGenerateJson: async () => raw },
  './guardrails': { GUARDRAIL_PROMPT: '' },
})
const input = {
  jobTitle: '営業', levelLabel: '中途',
  criteria: [{ key: 'collaboration', name: '協働', rubric: {}, weight: 1 }],
  questions: [{ ord: 0, text: 'どのように協働しましたか' }],
  turns: [
    { speaker: 'interviewer', text: '売上を倍増させました' },
    { speaker: 'candidate', text: candidateText },
  ],
}
const response = (quotes, verdict = 'recommend') => ({
  scores: [{ criterionKey: 'collaboration', score: 5, insufficient: false, rationale: '協働した', quotes }],
  verdict, overallComment: '', candidateFeedback: '', recruiterReport: '',
})

;(async () => {
  await check('verbatim candidate evidence retains a supported score', async () => {
    raw = response([quote])
    const result = await evaluateSession(input)
    assert.equal(result.scores[0].score, 5)
    assert.equal(result.scores[0].insufficient, false)
    assert.equal(result.verdict, 'recommend')
  })
  await check('invented or interviewer-only quotes cannot support a recommendation', async () => {
    raw = response(['売上を倍増させました', '候補者が言っていない発言'])
    const result = await evaluateSession(input)
    assert.equal(result.scores[0].score, null)
    assert.equal(result.scores[0].insufficient, true)
    assert.equal(result.scores[0].quotes.length, 0)
    assert.equal(result.verdict, 'hold')
  })
  await check('mixed evidence keeps only verified candidate quotes', async () => {
    raw = response(['候補者が言っていない発言', quote])
    const result = await evaluateSession(input)
    assert.equal(result.scores[0].score, 5)
    assert.equal(result.scores[0].quotes.length, 1)
    assert.equal(result.scores[0].quotes[0], quote)
  })
  await check('too little candidate speech leaves a supported score but holds the verdict', async () => {
    raw = response([quote])
    const result = await evaluateSession({
      ...input,
      turns: [{ speaker: 'candidate', text: quote }],
    })
    assert.equal(result.scores[0].score, 5)
    assert.equal(result.verdict, 'hold')
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
