// 実行: npx tsx --test src/lib/brand/email-rename.test.ts
// メール送信（sendEmail）の、サービス名の切り替え。旗が off の間は、送り主・件名・本文が1文字も変わらないことを確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(join(process.cwd(), 'src/lib/email.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

async function send(flag: string | undefined, params: { from?: string; subject: string; html: string }): Promise<{ from: string; subject: string; html: string }> {
  let body: { from: string; subject: string; html: string } | null = null
  const env: Record<string, string> = { RESEND_API_KEY: 'k', RESEND_FROM_EMAIL: 'ドヤAI <noreply@example.test>' }
  if (flag !== undefined) env.NEXT_PUBLIC_BRAND_RENAME_ROLLOUT = flag
  const sandbox: Record<string, unknown> = {
    exports: {},
    process: { env },
    fetch: async (_u: string, o: { body: string }) => { body = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ id: 'x' }) } },
    AbortController, setTimeout, clearTimeout, console,
  }
  vm.runInNewContext(compiled, sandbox, { filename: 'email.ts' })
  await (sandbox.exports as { sendEmail: (p: unknown) => Promise<unknown> }).sendEmail({ to: 'a@example.test', ...params })
  assert.ok(body)
  return body!
}

const params = {
  subject: '【ドヤAI】お問い合わせへのご返信',
  html: '<p>ドヤAIをご利用いただき、ありがとうございます。ドヤAIOとドヤAI質問リンクとドヤAI商談は、そのままです。</p>',
}

test('旗が off（未設定・空・off）のとき: 送り主・件名・本文は、1文字も変わらない', async () => {
  for (const flag of [undefined, '', 'off', 'preview', 'true']) {
    const b = await send(flag, params)
    assert.equal(b.from, 'ドヤAI <noreply@example.test>', `旗 ${String(flag)}`)
    assert.equal(b.subject, params.subject)
    assert.equal(b.html, params.html)
  }
})

test('旗が all のとき: 送り主の名前・件名・本文のサービス名だけが変わり、ツール名は変わらない', async () => {
  for (const flag of ['all', ' ALL ']) {
    const b = await send(flag, params)
    assert.equal(b.from, 'ドヤ部下 <noreply@example.test>')
    assert.equal(b.subject, '【ドヤ部下】お問い合わせへのご返信')
    assert.equal(b.html, '<p>ドヤ部下をご利用いただき、ありがとうございます。ドヤAIOとドヤAI質問リンクとドヤAI商談は、そのままです。</p>')
  }
})
