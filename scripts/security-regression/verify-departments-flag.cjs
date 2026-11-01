// 部署ごとの入口の旗（DEPARTMENTS_ROLLOUT）の回帰テスト（静的な確認）。
// - 旗が off（既定・値なし・知らない値）のとき: セッションを読まずに false
// - layout は、サーバーの旗が on のときだけ ShellGate に departments を渡す（画面側で旗を決めない）
// - src/lib/departments.ts はサーバー専用の部品（next/headers・prisma・next-auth など）を import しない（画面からも使う純粋な表）
// - 主に使う部署の API（/api/account/departments）は旗を先に見て、cookie だけに書く（DB に書かない）
// - 部署の表・cookie・並びのテスト（src/lib/departments.test.ts）を流す
// git を使わない。DB・課金・外部 API には触れない。
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '../..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
let failed = false
const check = (name, fn) => { try { fn(); console.log('PASS ' + name) } catch (e) { failed = true; console.error('FAIL ' + name); console.error(e) } }

check('Departments flag: off is the default and reads no session', () => {
  const flag = read('src/lib/departments/flag.ts')
  assert.ok(flag.indexOf("if (rollout === 'off') return false") > 0)
  assert.ok(flag.indexOf("if (rollout === 'off') return false") < flag.indexOf('getServerSession('), 'off must return before reading the session')
  assert.match(flag, /if \(v === 'preview' \|\| v === 'all'\) return v\s*\n\s*return 'off'/)
  assert.match(flag, /process\.env\.DEPARTMENTS_ROLLOUT/)
})

check('Departments flag: the shell layout passes departments only from the server flag', () => {
  const layout = read('src/app/(shell)/layout.tsx')
  assert.match(layout, /const departmentsOn = signedIn \? await isDepartmentsEnabled\(\) : false/)
  assert.match(layout, /const departments = departmentsOn \? \{ enabled: true,/)
  assert.match(layout, /departments=\{departments\}/)
  const gate = read('src/components/shell/ShellGate.tsx')
  assert.match(gate, /departments=\{departments\}/)
  const shell = read('src/components/shell/AppShell.tsx')
  assert.match(shell, /const deptOn = Boolean\(departments\?\.enabled\)/)
  // 主の部署は旗が on のときだけ使う（off なら既定の順のまとまり）
  assert.match(shell, /buildDepartmentGroups\(deptOn \? departments\?\.primary \?\? \[\] : \[\]\)/)
  assert.match(shell, /<ToolGroupsNav groups=\{toolGroups\}/)
  const page = read('src/app/(shell)/home/page.tsx')
  // 部門ごとの製品（PRODUCT_HUBS_ROLLOUT）が on のときは、部署の切り替えを読まない（製品のホームへのリンクに替わる。docs/design/buddy-products-2026-11-01.md）
  assert.match(page, /const productsOn = await isProductHubsEnabled\(\)/)
  assert.match(page, /const departmentsOn = !productsOn && \(await isDepartmentsEnabled\(\)\)/)
  assert.match(page, /departmentsOn\s*\n?\s*\? \{/)
})

check('Departments choice API: flag first, cookie only, HttpOnly, no DB writes', () => {
  const api = read('src/app/api/account/departments/route.ts')
  for (const m of ['GET', 'PUT']) {
    const body = api.slice(api.indexOf('export async function ' + m))
    assert.match(body, /^export async function \w+\([^)]*\) \{\s*\n\s*if \(!\(await isDepartmentsEnabled\(\)\)\) return notFound\(\)/, m + ' must check the flag first')
  }
  assert.doesNotMatch(api, /prisma|@\/lib\/auth|getServerSession/)
  assert.match(api, /parseDepartmentsCookie\(/)
  assert.match(api, /httpOnly: true/)
  assert.match(api, /sameSite: 'lax'/)
  const dialog = read('src/components/shell/CompanyDialog.tsx')
  assert.match(dialog, /fetch\('\/api\/account\/departments'/)
  assert.match(dialog, /\{depts \? \(/, 'the department field shows only when the API answered')
})

check('Departments table: pure and client-safe (no server-only imports)', () => {
  for (const f of ['src/lib/departments.ts', 'src/components/home-agent/examples.ts']) {
    const src = read(f)
    const imports = [...src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1])
    for (const spec of imports) {
      assert.equal(/^(next\/headers|next-auth|@prisma\/client|stripe)/.test(spec) || /prisma|\.server|auth|flag/.test(spec), false, f + ' imports ' + spec)
    }
  }
})

check('Departments table and cookie rules (node:test)', () => {
  const tsx = path.join(root, 'node_modules/.bin/tsx')
  const r = spawnSync(tsx, ['--test', 'src/lib/departments.test.ts'], { cwd: root, encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''))
})

if (failed) { console.error('Security regression failed: verify-departments-flag.cjs'); process.exit(1) }
console.log(JSON.stringify({ scope: 'DEPARTMENTS_ROLLOUT flag (off reads no session), layout passes departments from the server flag only, departments table is pure, unit tests. No DB, billing or AI.' }))
