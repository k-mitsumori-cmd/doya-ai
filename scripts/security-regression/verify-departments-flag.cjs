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
  // 旗が off なら、今までの区分（SHELL_GROUPS）のまま。部署のまとまりは旗の裏だけ
  assert.match(shell, /\{deptOn \? \(\s*<ToolGroupsNav/)
  assert.match(shell, /\) : SHELL_GROUPS\.map\(\(group\) =>/)
  const page = read('src/app/(shell)/home/page.tsx')
  // 部門ごとの製品（PRODUCT_HUBS_ROLLOUT）が on のときは、部署の切り替えを読まない（製品のホームへのリンクに替わる。docs/design/buddy-products-2026-11-01.md）
  assert.match(page, /const productsOn = await isProductHubsEnabled\(\)/)
  assert.match(page, /const departmentsOn = !productsOn && \(await isDepartmentsEnabled\(\)\)/)
  assert.match(page, /departmentsOn\s*\n?\s*\? \{/)
})

// 部門ごとの製品（PRODUCT_HUBS_ROLLOUT。docs/design/buddy-products-2026-11-01.md）が off のときは、画面を今のまま（2026-11-02 統括の確認）
check('Product hubs flag: off reads no session and changes nothing on screen', () => {
  const flag = read('src/lib/products/flag.ts')
  assert.ok(flag.lastIndexOf("if (rollout === 'off') return false") > 0)
  assert.ok(flag.lastIndexOf("if (rollout === 'off') return false") < flag.indexOf('getServerSession('), 'off must return before reading the session')
  assert.match(flag, /process\.env\.PRODUCT_HUBS_ROLLOUT/)
  const layout = read('src/app/(shell)/layout.tsx')
  assert.match(layout, /const productsOn = signedIn \? await isProductHubsEnabled\(\) : false/)
  assert.match(layout, /const products = productsOn\s*\n\s*\? await/)
  const shell = read('src/components/shell/AppShell.tsx')
  assert.match(shell, /const productsOn = Boolean\(products\?\.enabled\)/)
  // 切り替えは旗の内側だけ。off なら今のロゴと、部署の旗の分岐（off なら SHELL_GROUPS）のまま
  for (const m of shell.matchAll(/<ProductSwitcher /g)) {
    assert.match(shell.slice(m.index - 40, m.index), /\{productsOn \? \(\s*$/, 'ProductSwitcher must be inside {productsOn ? (')
  }
  assert.match(shell, /\) : \(\s*<>\s*\{\/\*[^]*?\*\/\}\s*\{deptOn \? \(/, 'with products off, the menu falls back to the departments flag branch')
  assert.match(shell, /<NavItem tool=\{productsOn \? productHome : SHELL_HOME\}/)
  assert.match(shell, /withDepartments=\{deptOn && !productsOn\} withProducts=\{productsOn\}/)
  // 製品のホームは旗を先に見る（off なら 404・/home へ）
  assert.match(read('src/app/(shell)/hub/[product]/page.tsx'), /if \(!\(await isProductHubsEnabled\(\)\)\) notFound\(\)/)
  assert.match(read('src/app/(shell)/hub/page.tsx'), /if \(!\(await isProductHubsEnabled\(\)\)\) redirect\('\/home'\)/)
  // 経営ホームの製品の帯も旗の内側だけ
  assert.match(read('src/app/(shell)/home/page.tsx'), /productStrip=\{productsOn \? <ProductStrip \/> : null\}/)
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
