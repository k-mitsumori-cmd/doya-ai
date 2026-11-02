// 実行: npx tsx --test src/components/home-agent/examples.test.ts
// 経営ホームの例の文が、どれも作戦の組み合わせに合うこと（押して送ると「まだ作戦にできません」にならない）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AGENT_EXAMPLES, AGENT_EXAMPLE_ITEMS } from './examples'
import { matchRecipe } from '@/lib/agent-orchestration/recipes'

test('例の文は6つ以上あり、どれも作戦の組み合わせに合う', () => {
  assert.ok(AGENT_EXAMPLES.length >= 6)
  for (const t of AGENT_EXAMPLES) assert.ok(matchRecipe(t), t)
  assert.equal(new Set(AGENT_EXAMPLES).size, AGENT_EXAMPLES.length)
})

test('部署ごとの例: まとめて頼む例は作戦に合い、どの部署にも例がある', () => {
  for (const e of AGENT_EXAMPLE_ITEMS.filter((x) => x.bundle)) assert.ok(matchRecipe(e.text), e.text)
  for (const d of ['marketing', 'sales', 'hr', 'admin']) assert.ok(AGENT_EXAMPLE_ITEMS.some((e) => e.dept === d), d)
  assert.equal(new Set(AGENT_EXAMPLE_ITEMS.map((e) => e.text)).size, AGENT_EXAMPLE_ITEMS.length)
})
