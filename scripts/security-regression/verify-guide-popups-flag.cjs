// ドヤくんの知らせの旗（GUIDE_POPUPS_ROLLOUT）の回帰テスト。
// - 旗が off（既定・値なし・知らない値）のとき: セッションを読まずに false。枠は知らせの部品を置かない
// - 知らせの部品は、DB・課金・外の API に触れない（見た記録は端末だけ）。絵文字を使わない
// - 決まり（順番・作業中・once）と旗の判定のテスト（src/lib/notice/notice.test.ts）を流す
// git を使わない。DB・課金・外部 API には触れない。
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '../..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
let failed = false
const check = (name, fn) => { try { fn(); console.log('PASS ' + name) } catch (e) { failed = true; console.error('FAIL ' + name); console.error(e) } }

check('Guide popups flag: off reads no session, and the shell mounts the notice parts only when the server says so', () => {
  const flag = read('src/lib/notice/flag.ts')
  assert.ok(flag.indexOf("if (rollout === 'off') return false") > 0)
  assert.ok(flag.indexOf("if (rollout === 'off') return false") < flag.indexOf('getServerSession('), 'off must return before reading the session')
  const layout = read('src/app/(shell)/layout.tsx')
  assert.match(layout, /const guide = signedIn \? await isGuidePopupsEnabled\(\) : false/)
  assert.match(layout, /guide=\{guide\}/)
  const gate = read('src/components/shell/ShellGate.tsx')
  assert.match(gate, /guide = false/)
  assert.match(gate, /guide && shown && userKey\s*\n?\s*\? <NoticeProvider/)
})

check('Guide popups: the notice parts touch no DB, billing or outside service, and use no emoji', () => {
  const files = ['src/components/notice/NoticeProvider.tsx', 'src/components/notice/HotToastBridge.tsx', 'src/components/notice/sonner-look.ts', 'src/components/notice/HandoffSuggest.tsx', 'src/lib/notice/artifacts.ts', 'src/components/notice/ShellNotices.tsx', 'src/lib/notice/queue.ts', 'src/lib/notice/seen.ts', 'src/lib/notice/announcements.ts']
  for (const f of files) {
    const src = read(f)
    assert.equal(/@\/lib\/prisma|from 'stripe'|@\/lib\/stripe|https?:\/\/(?!claude\.ai)/.test(src), false, f)
    // 画面に出る文字（コメントを除いた所）に絵文字が無いこと。コメントの ⚠️ は決まりの印なので見ない
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(code), false, f + ' has an emoji')
  }
})

check('Guide popups: queue, seen and flag rules (node:test)', () => {
  const tsx = path.join(root, 'node_modules/.bin/tsx')
  const r = spawnSync(tsx, ['--test', 'src/lib/notice/notice.test.ts'], { cwd: root, encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''))
})


check('Handoff (7): sign-out on any path clears the record, the card does not fetch on display, and the card is mounted only inside the flag', () => {
  // 統括の点検 2026-10-26 中3
  const layout = read('src/app/layout.tsx')
  assert.match(layout, /<ClearArtifactsOnSignOut \/>/)
  const clear = read('src/components/notice/ClearArtifactsOnSignOut.tsx')
  assert.match(clear, /status === 'unauthenticated'\) clearAllRecentArtifacts\(\)/)
  const art = read('src/lib/notice/artifacts.ts')
  assert.match(art, /export interface RecentArtifact \{ kind: ArtifactKind; id: string; at: number \}/, 'the record keeps no display name')
  const hs = read('src/components/notice/HandoffSuggest.tsx')
  const main = hs.slice(hs.indexOf('export default function HandoffSuggest'))
  assert.equal(/fetch\(/.test(main), false, 'showing the card must not fetch')
  const use = hs.slice(hs.indexOf('const use = async'), hs.indexOf('export default function HandoffSuggest'))
  assert.match(use, /fetch\('\/api\/doyaslide\/projects\/from-quote'/)
  assert.match(use, /JSON\.stringify\(\{ kind: artifact\.kind, id: artifact\.id \}\)/, 'only kind and id are sent')
  const gate = read('src/components/shell/ShellGate.tsx')
  assert.match(gate, /guide && shown && userKey\s*\n?\s*\? <NoticeProvider userKey=\{userKey\}>\{framed\}<ShellNotices \/><HandoffSuggest \/><\/NoticeProvider>/)
  assert.equal((gate.match(/<HandoffSuggest/g) || []).length, 1)
})

if (failed) { console.error('Security regression failed: verify-guide-popups-flag.cjs'); process.exit(1) }
console.log(JSON.stringify({ scope: 'GUIDE_POPUPS_ROLLOUT flag, shell mounting, no DB/billing/outside calls in notice parts, queue/seen/flag unit tests. No DB, billing or AI.' }))
