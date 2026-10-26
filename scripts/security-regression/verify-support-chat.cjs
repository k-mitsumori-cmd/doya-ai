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
  for (const f of ['src/app/api/support-chat/ask/route.ts', 'src/app/api/support-chat/ticket/route.ts', 'src/app/api/support-chat/tickets/route.ts', 'src/app/api/support-chat/tickets/[ticketNo]/route.ts']) {
    const src = read(f)
    const gate = src.indexOf('if (!(await isSupportChatEnabled())) return NextResponse.json')
    assert.ok(gate > 0, f + ' must check the flag')
    const session = Math.min(...['getServerSession(authOptions)', 'supportUserId()'].map((k) => { const i = src.indexOf(k, src.indexOf('export async function')); return i < 0 ? Infinity : i }))
    assert.ok(gate < session, f + ' must check the flag before reading the session')
    // GET と POST の両方があるファイルは、どちらも旗を見る
    const handlers = (src.match(/export async function (GET|POST)/g) || []).length
    const gates = (src.match(/if \(!\(await isSupportChatEnabled\(\)\)\) return NextResponse\.json/g) || []).length
    assert.equal(gates, handlers, f + ' every handler must check the flag')
  }
  // 本人の受付は userId でしぼる（他人の受付番号では読めない・書けない）
  const store = read('src/lib/support-chat/store.ts')
  assert.equal((store.match(/where: \{ ticketNo, userId \}/g) || []).length, 2, 'readMyTicket and addMyMessage must scope by userId')
  // 管理の API は、管理者認証の valid を見る
  for (const f of ['src/app/api/admin/support/route.ts', 'src/app/api/admin/support/[id]/route.ts']) {
    const src = read(f)
    assert.match(src, /verifyAdminSession\(/, f)
    assert.ok(/const \{ valid \} = await verifyAdminSession|r\.valid \?/.test(src), f + ' must read valid')
  }
  const layout = read('src/app/(shell)/layout.tsx')
  assert.match(layout, /const supportChat = signedIn \? await isSupportChatEnabled\(\) : false/)
  const gate = read('src/components/shell/ShellGate.tsx')
  assert.match(gate, /supportChat = false/)
  assert.match(gate, /\{supportChat && shown \? <SupportChat \/> : null\}/)
})

check('Support chat: no Doya Power, billing or direct paid AI; Slack only through the shared sender', () => {
  const files = ['src/app/api/support-chat/ask/route.ts', 'src/app/api/support-chat/ticket/route.ts', 'src/app/api/support-chat/tickets/route.ts', 'src/app/api/support-chat/tickets/[ticketNo]/route.ts', 'src/app/api/admin/support/route.ts', 'src/app/api/admin/support/[id]/route.ts', 'src/lib/support-chat/answer.ts', 'src/lib/support-chat/knowledge.ts', 'src/lib/support-chat/rules.ts', 'src/lib/support-chat/ticket.ts', 'src/lib/support-chat/request.ts', 'src/lib/support-chat/store.ts', 'src/lib/support-chat/mail.ts', 'src/lib/support-chat/gemini.ts', 'src/lib/support-chat/claude.ts', 'src/lib/support-chat/select.ts', 'src/lib/support-chat/prompt.ts', 'src/components/support-chat/SupportChat.tsx', 'src/app/admin/support/page.tsx']
  for (const f of files) {
    const src = read(f)
    assert.equal(/@\/lib\/doya-power|from 'stripe'|@\/lib\/stripe|api\.openai|api\.anthropic|@google\/genai|from 'openai'|geminiGenerate/.test(src), false, f)
    // 有料の AI を呼ぶのは claude.ts（本命）と gemini.ts（予備）だけ（answerQuestion を通し、上限と運営へ渡す判定がかかる）
    if (f !== 'src/lib/support-chat/gemini.ts') assert.equal(/generativelanguage/.test(src), false, f + ' must not call Gemini directly')
    if (f !== 'src/lib/support-chat/claude.ts') assert.equal(/@anthropic-ai\/sdk/.test(src), false, f + ' must not call Claude directly')
    assert.equal(/fetch\(\s*(webhook|url|dedicated)/i.test(src), false, f + ' must not post to a webhook directly')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(code), false, f + ' has an emoji')
  }
  const claude = read('src/lib/support-chat/claude.ts')
  assert.match(claude, /SUPPORT_CLAUDE_MODEL_DEFAULT = 'claude-haiku-5-5'/, 'the model the user chose on 2026-10-26')
  assert.match(claude, /effort: 'low'/)
  assert.equal(/temperature|top_p|top_k|budget_tokens/.test(claude.replace(/^\s*\/\/.*$/gm, '')), false, 'Haiku 5.5 rejects sampling params and thinking budgets')
  // 画面の確認ページからも読む answer.ts は、SDK や有料 AI の部品を読まない（ブラウザに入れない）
  const answer = read('src/lib/support-chat/answer.ts')
  assert.equal(/from '\.\/(claude|gemini|select)'/.test(answer), false, 'answer.ts must stay free of the SDK')
  const gemini = read('src/lib/support-chat/gemini.ts')
  assert.match(gemini, /thinkingBudget: 0/, 'thinking tokens are not in the approved cost estimate')
  assert.match(gemini, /'x-goog-api-key': key/, 'the API key goes in a header, not the URL')
  const ask = read('src/app/api/support-chat/ask/route.ts')
  assert.match(ask, /if \(answerer\.paid\)[\s\S]*consumeDailyQuota\('support-chat-ai'/, 'paid AI must count the global daily limit')
  const ticket = read('src/app/api/support-chat/ticket/route.ts')
  assert.match(ticket, /postToSlackBlocks|postSlack\(/)
  assert.match(ticket, /notifyAlert\(/, 'a failed Slack post must go to the alert route')
})

check('Support chat: rules, mock answers, ticket and redaction (node:test)', () => {
  const tsx = path.join(root, 'node_modules/.bin/tsx')
  const r = spawnSync(tsx, ['--test', 'src/lib/support-chat/support-chat.test.ts'], { cwd: root, encoding: 'utf8', timeout: 60000, env: { ...process.env, SUPPORT_CHAT_ROLLOUT: '' } })
  assert.equal(r.status, 0, (r.stdout || '') + (r.stderr || ''))
})

if (failed) { console.error('Security regression failed: verify-support-chat.cjs'); process.exit(1) }
console.log(JSON.stringify({ scope: 'SUPPORT_CHAT_ROLLOUT flag, route gates, shell mounting, no Doya Power/billing/paid AI, shared Slack sender, unit tests. No DB, billing or AI.' }))
