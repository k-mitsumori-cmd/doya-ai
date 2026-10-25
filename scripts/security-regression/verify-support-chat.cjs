// サポートチャット（SUPPORT_CHAT_ROLLOUT）の回帰テスト。
// - 旗が off（既定・値なし・知らない値）のとき: セッションを読まずに false。API は 404。枠はボタンを置かない
// - API はドヤパワーの台帳と課金に触れない。有料の AI を直接呼ばない（答え方は answer.ts の差し込み口だけ）
// - Slack は共通の送り口（notify.ts / notifications.ts）を通す。fetch で Webhook を直接叩かない
// - 画面と決まりのファイルに絵文字を使わない
// - 決まりのテスト（src/lib/support-chat/support-chat.test.ts）を流す
// git を使わない。DB・課金・外部 API には触れない。
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '../..')
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8')
let failed = false
const check = (name, fn) => { try { fn(); console.log('PASS ' + name) } catch (e) { failed = true; console.error('FAIL ' + name); console.error(e) } }

check('Support chat flag: off reads no session; routes 404 first; the shell mounts the chat only when the server says so', () => {
  const flag = read('src/lib/support-chat/flag.ts')
  assert.ok(flag.indexOf("if (rollout === 'off') return false") > 0)
  assert.ok(flag.indexOf("if (rollout === 'off') return false") < flag.indexOf('getServerSession('), 'off must return before reading the session')
  for (const f of ['src/app/api/support-chat/ask/route.ts', 'src/app/api/support-chat/ticket/route.ts']) {
    const src = read(f)
    const gate = src.indexOf('if (!(await isSupportChatEnabled())) return NextResponse.json')
    assert.ok(gate > 0, f + ' must check the flag')
    assert.ok(gate < src.indexOf('getServerSession(authOptions)'), f + ' must check the flag before reading the session')
  }
  const layout = read('src/app/(shell)/layout.tsx')
  assert.match(layout, /const supportChat = signedIn \? await isSupportChatEnabled\(\) : false/)
  const gate = read('src/components/shell/ShellGate.tsx')
  assert.match(gate, /supportChat = false/)
  assert.match(gate, /\{supportChat && shown \? <SupportChat \/> : null\}/)
})

check('Support chat: no Doya Power, billing or direct paid AI; Slack only through the shared sender', () => {
  const files = ['src/app/api/support-chat/ask/route.ts', 'src/app/api/support-chat/ticket/route.ts', 'src/lib/support-chat/answer.ts', 'src/lib/support-chat/knowledge.ts', 'src/lib/support-chat/rules.ts', 'src/lib/support-chat/ticket.ts', 'src/lib/support-chat/request.ts', 'src/components/support-chat/SupportChat.tsx']
  for (const f of files) {
    const src = read(f)
    assert.equal(/@\/lib\/doya-power|from 'stripe'|@\/lib\/stripe|generativelanguage|api\.openai|api\.anthropic|@anthropic-ai|@google\/genai|from 'openai'|geminiGenerate/.test(src), false, f)
    assert.equal(/fetch\(\s*(webhook|url|dedicated)/i.test(src), false, f + ' must not post to a webhook directly')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(code), false, f + ' has an emoji')
  }
  const ticket = read('src/app/api/support-chat/ticket/route.ts')
  assert.match(ticket, /postToSlackBlocks|postSlack\(/)
  assert.match(ticket, /notifyAlert\(/, 'a failed Slack post must go to the alert route')
})

check('Support chat: rules, mock answers, ticket and redaction (node:test)', () => {
  const tsx = path.join(root, 'node_modules/.bin/tsx')
  const r = spawnSync(tsx, ['--test', 'src/lib/support-chat/support-chat.test.ts'], { cwd: root, encoding: 'utf8', timeout: 60000 })
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''))
})

if (failed) { console.error('Security regression failed: verify-support-chat.cjs'); process.exit(1) }
console.log(JSON.stringify({ scope: 'SUPPORT_CHAT_ROLLOUT flag, route gates, shell mounting, no Doya Power/billing/paid AI, shared Slack sender, unit tests. No DB, billing or AI.' }))
