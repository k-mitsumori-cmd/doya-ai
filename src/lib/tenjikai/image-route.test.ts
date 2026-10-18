// 実行: npm run test:tenjikai
// 画像生成 API（従量課金）の守りを、ソースから静的に確かめる。課金 API は呼ばない。
// ⚠️ 上限をプロセス内の変数で数えると、Vercel のインスタンスをまたいだときに守れない（点検 A）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(process.cwd(), 'src/app/api/tenjikai/image/route.ts'), 'utf8')
const at = (needle: string) => {
  const i = src.indexOf(needle)
  assert.ok(i >= 0, `${needle} が見つからない`)
  return i
}

test('上限をプロセス内の変数で数えていない', () => {
  assert.doesNotMatch(src, /new Map\(/)
  assert.doesNotMatch(src, /^(const|let) usage\b/m)
})

test('生成の前に、ログイン・上限の消費・実行の記録をこの順で行う', () => {
  const login = at('getServerSession(authOptions)')
  const quota = at('reserveImageQuota(userId')
  const job = at('tenjikaiGenerationJob.create(')
  const call = at('await fetch(endpoint')
  assert.ok(login < quota && quota < job && job < call)
})

test('失敗したとき、外部 API の応答の本文を利用者に返さない', () => {
  assert.doesNotMatch(src, /detail\s*:/)
  assert.doesNotMatch(src, /NextResponse\.json\(\{[^}]*text/)
})

test('有効化のフラグが無ければ、何もせずに断る', () => {
  assert.ok(at("process.env.TENJIKAI_IMAGEGEN_ENABLED !== 'true'") < at('getServerSession(authOptions)'))
})
