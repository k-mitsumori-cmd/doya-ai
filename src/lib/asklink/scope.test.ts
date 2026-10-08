// 実行: npm run test:asklink
// 他人の結果を見られないこと（IDOR）を、APIのソースから静的に確かめる。
// ⚠️ askLinkRun を id だけで引くと、他人のIDを指定したときに中身が返ってしまう。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const API_DIR = join(process.cwd(), 'src/app/api/asklink')

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? routeFiles(p) : name === 'route.ts' ? [p] : []
  })
}

const files = routeFiles(API_DIR)

test('APIのルートが見つかる', () => {
  assert.ok(files.length >= 4, files.join(', '))
})

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const rel = file.slice(process.cwd().length + 1)

  test(`${rel}: すべてのハンドラでログインを確認する`, () => {
    const handlers = src.match(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g) || []
    const checks = src.match(/await getAskLinkUserId\(\)/g) || []
    assert.ok(handlers.length > 0)
    assert.equal(checks.length, handlers.length)
  })

  test(`${rel}: run は userId 付きでしか引かない`, () => {
    // findUnique は id だけで引けてしまうので使わない
    assert.ok(!/askLinkRun\.findUnique\(/.test(src), 'askLinkRun.findUnique を使っている')
    for (const m of src.matchAll(/askLinkRun\.(findFirst|findMany|count)\(\{\s*where:\s*([^}]*)/g)) {
      assert.ok(/ownRun\(userId|userId/.test(m[2]), `userId の無い検索: ${m[0]}`)
    }
    // 更新は、userId で確認済みの run.id か、userId を含む条件でのみ行う
    for (const m of src.matchAll(/askLinkRun\.(update|updateMany|delete)\(\{\s*where:\s*\{([^}]*)\}/g)) {
      assert.ok(/run\.id|runId|userId/.test(m[2]), `確認していないIDでの更新: ${m[0]}`)
    }
  })
}
