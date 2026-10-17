// 実行: npm run test:expense
// 他の組織の支出を見たり変えたりできないこと（IDOR）を、API のソースから静的に確かめる。
// ⚠️ expense の表を id だけで引くと、他の組織の ID を指定されたときに中身が返ってしまう。
//    where には必ず organizationId を入れる。例外は「organizationId 付きで引いた行の id（x.id）」で更新・削除するときだけ。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const API_DIR = join(ROOT, 'src/app/api/expense')

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? routeFiles(p) : name === 'route.ts' ? [p] : []
  })
}

/** `where: {` から対応する `}` までを取り出す */
function whereClauses(src: string): string[] {
  const out: string[] = []
  let i = src.indexOf('where: {')
  while (i !== -1) {
    let depth = 0
    let j = i + 'where: '.length
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++
      else if (src[j] === '}' && --depth === 0) break
    }
    out.push(src.slice(i + 'where: '.length, j + 1))
    i = src.indexOf('where: {', j)
  }
  return out
}

// ログインだけで使える口（組織を作る前・所属一覧）。組織のデータは返さない
const NO_ORG_HANDLERS: Record<string, string[]> = {
  'usage/route.ts': ['GET'],
  'organization/route.ts': ['POST'],
}

const files = routeFiles(API_DIR)

test('API ルートが存在する', () => {
  assert.ok(files.length >= 15, `routes: ${files.length}`)
})

for (const file of files) {
  const rel = relative(API_DIR, file)
  const src = readFileSync(file, 'utf8')

  test(`${rel}: すべてのハンドラが withExpense を通る`, () => {
    const handlers = Array.from(src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\(/g)).map((m) => m[1])
    assert.ok(handlers.length > 0)
    const allowed = NO_ORG_HANDLERS[rel] ?? []
    for (const h of handlers) {
      if (allowed.includes(h)) continue
      const body = src.slice(src.indexOf(`export async function ${h}(`))
      const next = body.slice(1).search(/\nexport async function /)
      const own = next === -1 ? body : body.slice(0, next + 1)
      assert.match(own, /return withExpense\(req, '(member|manager|admin|owner)'/, `${h} が withExpense を通っていません`)
    }
  })

  test(`${rel}: where に organizationId が入っている`, () => {
    for (const w of whereClauses(src)) {
      const ok =
        w.includes('organizationId') ||
        // organizationId 付きで引いた行の id で更新・削除する
        /^\{\s*id:\s*[a-z]+\.id\s*\}$/.test(w) ||
        // 契約（organizationId で確認済み）の単価の複合キー
        /^\{\s*contractId_effectiveFrom:/.test(w) ||
        // 入口: ログイン中のユーザーのメールで本人の id を引く
        /^\{\s*email(:|\s*\})/.test(w) ||
        /^\{\s*id:\s*\{\s*in:\s*rows\.map\(\(r\) => r\.userId\)\s*\}\s*\}$/.test(w)
      assert.ok(ok, `organizationId の無い where: ${w}`)
    }
  })

  test(`${rel}: findUnique を組織の確認なしに使わない`, () => {
    for (const m of Array.from(src.matchAll(/prisma\.expense\w+\.findUnique(OrThrow)?\(\{([^)]*)\}\)/g))) {
      assert.match(m[2], /ctx\.organizationId|organizationId_/, `組織を確認していない findUnique: ${m[0]}`)
    }
  })
}

test('cron は CRON_SECRET が無いと動かない', () => {
  const src = readFileSync(join(ROOT, 'src/app/api/cron/expense-schedule/route.ts'), 'utf8')
  assert.match(src, /!process\.env\.CRON_SECRET \|\| authHeader !== `Bearer \$\{process\.env\.CRON_SECRET\}`/)
})

test('振込先口座は manager 以上にだけ返す', () => {
  const src = readFileSync(join(ROOT, 'src/lib/expense/dto.ts'), 'utf8')
  assert.match(src, /const canSeeBank = hasMinRole\(ctx\.role, 'manager'\)/)
  assert.match(src, /bank: canSeeBank/)
})

test('Slack の送り先は hooks.slack.com だけ', () => {
  const src = readFileSync(join(ROOT, 'src/lib/expense/validate.ts'), 'utf8')
  assert.match(src, /\^https:\\\/\\\/hooks\\\.slack\\\.com\\\/services\\\//)
})
