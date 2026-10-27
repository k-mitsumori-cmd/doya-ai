// 「これ1つで全部進む」帯（旗 ONE_BUTTON_ROLLOUT）の回帰テスト（静的な確認と、旗の単体テスト）。
// - 旗が off（既定・値なし・知らない値）のとき: セッションを読まずに false
// - 枠の layout は、サーバーの旗を ShellGate に渡し、ShellGate が OneButtonContext で配る（画面側で旗を決めない）
// - 展示会のブース設計とドヤスライドの編集は、旗が on のときだけ帯を出し、同じボタンを二重に出さない
// - 帯の部品に絵文字を使わない
// git・docs・reference を読まない。DB・課金・外部 API には触れない。
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '../..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
let failed = false
const check = (name, fn) => { try { fn(); console.log('PASS ' + name) } catch (e) { failed = true; console.error('FAIL ' + name); console.error(e) } }

check('One button flag: off is the default and reads no session', () => {
  const flag = read('src/lib/one-button/flag.ts')
  assert.ok(flag.indexOf("if (rollout === 'off') return false") > 0)
  assert.ok(flag.indexOf("if (rollout === 'off') return false") < flag.indexOf('getServerSession('), 'off must return before reading the session')
  assert.match(flag, /process\.env\.ONE_BUTTON_ROLLOUT/)
})

check('One button flag: the shell layout decides it on the server and ShellGate provides it', () => {
  const layout = read('src/app/(shell)/layout.tsx')
  assert.match(layout, /const oneButton = signedIn \? await isOneButtonEnabled\(\) : false/)
  assert.match(layout, /oneButton=\{oneButton\}/)
  const gate = read('src/components/shell/ShellGate.tsx')
  assert.match(gate, /<OneButtonContext\.Provider value=\{oneButton\}>/)
  assert.match(read('src/components/one-button/context.tsx'), /createContext\(false\)/)
})

check('One button: booth and slide editor show the bar only with the flag, without duplicating the same button', () => {
  const booth = read('src/components/tenjikai/BoothStudio.tsx')
  assert.match(booth, /const oneButton = useOneButton\(\)/)
  assert.match(booth, /\{oneButton \? \(\s*<OneButtonBar/)
  assert.match(booth, /\{oneButton \? null : <NextStepBar/)
  const slide = read('src/app/(shell)/doyaslide/[id]/page.tsx')
  assert.match(slide, /const oneButton = useOneButton\(\)/)
  assert.match(slide, /\{oneButton \? \(\s*<div className="mb-4">\s*<OneButtonBar/)
  assert.match(slide, /\) : oneButton \? null : \(\s*<button\s*onClick=\{runGenerate\}/)
})

check('One button: every tool page shows the bar only behind the flag', () => {
  // 2026-10-27 ユーザーの指示「展示会に限らず、すべてのツールを分かりやすく」。帯を入れたツールの一覧
  const files = [
    'src/app/(shell)/persona/Tool.tsx', 'src/app/(shell)/asklink/Tool.tsx', 'src/app/(shell)/popup/Tool.tsx',
    'src/app/(shell)/aio/[orgSlug]/scan/page.tsx', 'src/app/(shell)/aishodan/Tool.tsx', 'src/app/(shell)/mensetsu/Tool.tsx',
    'src/app/(shell)/adimage/Tool.tsx', 'src/app/(shell)/seo/create/page.tsx', 'src/app/(shell)/quote/Tool.tsx',
    'src/app/(shell)/doyalist/Tool.tsx', 'src/components/doyaslide/NewDoyaSlideWizard.tsx',
    'src/app/(shell)/banner/dashboard/create/page.tsx', 'src/app/(shell)/shodan/[orgSlug]/new/page.tsx', 'src/app/(shell)/interview/Tool.tsx',
    'src/app/(shell)/sfa/[orgSlug]/page.tsx', 'src/components/promane/ui-next/PromaneOneButton.tsx',
  ]
  for (const f of files) {
    const src = read(f)
    assert.match(src, /const oneButton = useOneButton\(\)|if \(!useOneButton\(\)\) return null/, f)
    assert.match(src, /<OneButtonBar/, f)
    if (!/if \(!useOneButton\(\)\) return null/.test(src)) assert.match(src, /\{oneButton[^}\n]*(?:\?|&&) \(?\s*(?:<div[^>]*>\s*)?<OneButtonBar/, f)
  }
})

check('One button: server components stay on the server (flag off must not send their data to the browser)', () => {
  // プロマネのダッシュボードを 'use client' にすると、旗が off でも案件・取引先・タスク・経費が画面に送られる（2026-10-27 統括の点検 重大）
  const dash = read('src/components/promane/ui-next/DashboardNext.tsx')
  assert.doesNotMatch(dash, /^['"]use client['"]/m)
  assert.doesNotMatch(dash, /useOneButton/)
  assert.match(dash, /<PromaneOneButton newHref=\{newHref\} \/>/)
  assert.match(read('src/components/promane/ui-next/PromaneOneButton.tsx'), /^'use client'/)
})

check('One button bar: the button cannot be pressed again while running, unless the page opts in', () => {
  const bar = read('src/components/one-button/OneButtonBar.tsx')
  assert.match(bar, /disabled=\{disabled \|\| \(running && !clickableWhileRunning\)\}/)
  assert.match(read('src/app/(shell)/doyaslide/[id]/page.tsx'), /\(generating \|\| busySlide !== null \|\| operation\.blocked\)/)
  // 開発の道（ログインしていない next dev）では、旗が all のときだけ出す
  assert.match(read('src/app/(shell)/tenjikai/layout.tsx'), /<OneButtonProvider value=\{oneButtonRollout\(\) === 'all'\}>/)
})

check('One button bar: no emoji in the part', () => {
  for (const f of ['src/components/one-button/OneButtonBar.tsx', 'src/components/one-button/one-button.module.css']) {
    // コメントの「⚠️」は画面に出ないので除く（画面に出る文字と属性だけを見る）
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    assert.doesNotMatch(code, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, f)
  }
})

check('One button flag rules (node:test)', () => {
  const tsx = path.join(root, 'node_modules/.bin/tsx')
  const r = spawnSync(tsx, ['--test', 'src/lib/one-button/flag.test.ts'], { cwd: root, encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''))
})

if (failed) { console.error('Security regression failed: verify-one-button.cjs'); process.exit(1) }
console.log(JSON.stringify({ scope: 'ONE_BUTTON_ROLLOUT flag (off reads no session), shell layout passes it from the server, booth and slide editor show the bar only with the flag. No DB, billing or AI.' }))
