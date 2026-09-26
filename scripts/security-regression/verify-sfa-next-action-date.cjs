const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

let prompt = ''
const { suggestNextAction } = load('src/lib/sfa/ai.ts', {
  '@seo/lib/gemini': {
    GEMINI_TEXT_MODEL_DEFAULT: 'test-model',
    geminiGenerateJson: async ({ prompt: input }) => {
      prompt = input
      return {
        nextAction: '次の一手', reason: '理由', risk: '',
        tasks: [
          { title: '商談を確認する', dueDate: '2026-09-30' },
          { title: '誤った日付', dueDate: '2026-02-30' },
          { title: '資料を送付する', dueDate: '2026-10-03' },
        ],
      }
    },
  },
})

;(async () => {
  const before = await suggestNextAction({ dealName: '境界テスト' }, new Date('2026-09-30T14:59:59Z'))
  assert.match(prompt, /今日の日付: 2026-09-30/)
  assert.equal(before.tasks[0].dueDate, '2026-09-30')
  const after = await suggestNextAction({ dealName: '境界テスト' }, new Date('2026-09-30T15:00:00Z'))
  assert.match(prompt, /今日の日付: 2026-10-01/)
  assert.equal(after.tasks[0].dueDate, '2026-10-01', 'past date is clamped to the JST calendar day')
  assert.equal(after.tasks[1].dueDate, null, 'nonexistent calendar date is not offered for task creation')
  assert.equal(after.tasks[2].dueDate, '2026-10-03')
  console.log('PASS SFA next-action dates follow JST and reject nonexistent dates')
})().catch(error => { console.error(error); process.exitCode = 1 })
