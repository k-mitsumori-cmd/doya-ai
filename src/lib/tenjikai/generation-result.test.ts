import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeSite, generateBoothPlans, generateCreatives, SAMPLE_INPUT } from './engine'
import { readGenerationResult } from './generation-result'

const actorId = 'actor-a', clientRequestId = '11fe1420-6c7c-492e-b838-4ccdf9d7c6ad'
const plan = { source: 'ai', analysis: analyzeSite(SAMPLE_INPUT.serviceUrl), boothCopy: {}, creativeCopy: {} }
const envelope = (candidate: unknown = plan) => ({ state: 'generated', actorId, clientRequestId, projectId: 'project-a',
  plan: candidate, save: { project: 'basic', venue: 'not_saved', analysis: 'saved', plan: 'not_saved' } })

test('正しいresultだけを採用し、実engineの表示計算を通せる', () => {
  const result = readGenerationResult(envelope(), actorId, clientRequestId)
  assert.equal(result?.state, 'generated')
  if (result?.state === 'generated') {
    assert.equal(generateBoothPlans(SAMPLE_INPUT).length, 3)
    assert.equal(generateCreatives(result.plan.analysis, SAMPLE_INPUT).length, 6)
  }
  assert.equal(readGenerationResult(envelope(), 'other-actor', clientRequestId), null)
  assert.equal(readGenerationResult(envelope(), actorId, 'other-request'), null)
  assert.equal(readGenerationResult({ ...envelope(), projectId: '' }, actorId, clientRequestId), null)
})

test('不正な200 planをworkspaceへ渡さない', () => {
  const bad: unknown[] = [
    { ...plan, analysis: { ...plan.analysis, headline: undefined } },
    { ...plan, analysis: { ...plan.analysis, colors: {} } },
    { ...plan, analysis: { ...plan.analysis, valueProps: [{ title: 'only title' }] } },
    { ...plan, analysis: { ...plan.analysis, valueProps: [] } },
    { ...plan, analysis: { ...plan.analysis, targets: [] } },
    { ...plan, analysis: { ...plan.analysis, targets: ['ok', 1] } },
    { ...plan, analysis: { ...plan.analysis, domain: null } },
    { ...plan, boothCopy: { A: { name: 'name' } } },
    { ...plan, creativeCopy: { flyer: { copy: 'copy' } } },
    { ...plan, creativeCopy: { unknown: { copy: 'x', purpose: 'y' } } },
    { ...plan, boothCopy: { B: null } },
    { ...plan, creativeCopy: { flyer: false } },
  ]
  for (const candidate of bad) assert.equal(readGenerationResult(envelope(candidate), actorId, clientRequestId), null)
})
