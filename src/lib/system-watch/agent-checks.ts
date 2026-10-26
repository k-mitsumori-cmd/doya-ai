// エージェント（商談の準備）の確認。設計は feat/agent-orchestration の
// docs/architecture/agent-orchestration/FAILURE-CHECKLIST.md §7（エージェントの担当 local_bf659a4c が作成）。
//
// 無料（10分ごとの system-watch に入れる）
//   - 旗の外の人（ログインなし）に /api/agent/tasks が 404 を返すか
//   - 見本の会社のサイトを、AI を使わずに読めるか（取得・本文の長さ・NUL）
// 有料（1日1回。SystemSetting watch:v1:paid-agent-enabled が 'true' のときだけ。2026-10-26 ユーザー承認・1日 約10円まで）
//   - B1: 商談の準備を1回通す（会社の調査・見積の案・スライドの構成）。1回 約1.8円（上限 約10円）。
//         テスト用のユーザー（SYSTEM_WATCH_TEST_USER_ID）として呼ぶ。ドヤパワーの旗が on なら、その会社の台帳から 31 減る
//   - B2: 会社の調査だけを見本の URL 3つで通す（gemini-2.5-flash を3回）。約3.6円
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { safeFetchText } from '@/lib/net/safe-fetch'
import { bodySnippet, describeFetchError } from '@/lib/health-check-report'
import { httpCheck, siteBase } from './http'
import type { CheckDef, CheckOutcome } from './types'

export const PAID_AGENT_ENABLED_KEY = 'watch:v1:paid-agent-enabled'

/** 見本の会社の URL（ユーザーの会社・大手の JS のサイト・Shift_JIS のサイト）。SystemSetting か環境変数で決める */
export async function sampleCompanyUrls(): Promise<string[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'watch:v1:sample-company-urls' } }).catch(() => null)
  const raw = row?.value || process.env.SYSTEM_WATCH_SAMPLE_COMPANY_URLS || ''
  return raw.split(/[\s,]+/).filter(u => /^https?:\/\//.test(u)).slice(0, 3)
}

export function agentFreeChecks(base = siteBase()): CheckDef[] {
  return [
    {
      id: 'api:agent-guard', area: 'API', label: 'エージェントの API が旗の外の人に見えないか（/api/agent/tasks）', severity: 'urgent', threshold: 2,
      hints: ['404 以外なら、旗（AGENT_ORCHESTRATION_ROLLOUT）の判定が外れている。src/lib/agent-orchestration/flag.ts を見る'],
      // ログインなしの POST。旗の判定で 404 になり、本文は読まれない
      run: () => httpCheck(base + '/api/agent/tasks', { method: 'POST', status: 404 }),
    },
    {
      id: 'agent:sample-sites', area: '外部サービス', label: '見本の会社のサイトを AI なしで読めるか（会社の調査の前提）', severity: 'action', threshold: 2,
      hints: ['取得に失敗したサイトだけなら、そのサイト側の変更か拒否。全部なら外向きの通信か src/lib/net/safe-fetch.ts を見る', 'NUL を含むなら、会社の調査の文字の掃除（research.ts）が外れていないかを見る'],
      run: async (): Promise<CheckOutcome> => {
        const urls = await sampleCompanyUrls()
        if (!urls.length) return { ok: true, detail: '見本の URL が未設定のため確認しない（watch:v1:sample-company-urls）' }
        const lines: string[] = []
        const bad: string[] = []
        for (const url of urls) {
          try {
            const text = await safeFetchText(url, { timeoutMs: 12_000 })
            if (!text) { bad.push(`${url}: 取得できません`); continue }
            const hasNul = text.includes('\u0000')
            const plain = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            if (hasNul) bad.push(`${url}: 本文に NUL があります`)
            else if (plain.length < 200) bad.push(`${url}: 本文が短すぎます（${plain.length}文字。JS で描くサイトの可能性）`)
            lines.push(`${url} ${plain.length}文字`)
          } catch (e) {
            bad.push(`${url}: ${describeFetchError(e, 12_000)}`)
          }
        }
        return bad.length ? { ok: false, error: bad.join(' / '), detail: lines.join(' / ') } : { ok: true, detail: lines.join(' / ') }
      },
    },
  ]
}

/** テスト用のユーザーとして、15分だけ有効なセッションを作って呼ぶ。終わったら必ず消す。 */
async function withTestUserSession<T>(fn: (cookie: string) => Promise<T>): Promise<T> {
  const userId = process.env.SYSTEM_WATCH_TEST_USER_ID
  if (!userId) throw new Error('SYSTEM_WATCH_TEST_USER_ID が本番に設定されていません（テスト用のアカウントの作成待ち）')
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) throw new Error('SYSTEM_WATCH_TEST_USER_ID のユーザーが DB にいません')
  const token = crypto.randomBytes(32).toString('hex')
  await prisma.session.create({ data: { sessionToken: token, userId, expires: new Date(Date.now() + 15 * 60_000) } })
  const secure = (process.env.NEXTAUTH_URL ?? '').startsWith('https://')
  try {
    return await fn(`${secure ? '__Secure-' : ''}next-auth.session-token=${token}`)
  } finally {
    await prisma.session.deleteMany({ where: { sessionToken: token } }).catch(() => {})
  }
}

type TaskOutcome = { taskId: string; status: number; ok: boolean; message: string }

export function paidAgentChecks(base = siteBase()): (CheckDef & { costYen: number })[] {
  return [
    {
      id: 'paid:agent-research-samples', area: '外部サービス', label: 'B2 会社の調査を見本の URL で通す（gemini-2.5-flash）', severity: 'action', threshold: 1, costYen: 3.6,
      hints: ['失敗の札の cause と actions を見る', '本番のログの "[shodan/preparations] research failed" の stage・code・reason を見る'],
      run: async (): Promise<CheckOutcome> => {
        const urls = await sampleCompanyUrls()
        if (!urls.length) return { ok: true, detail: '見本の URL が未設定のため回していない（watch:v1:sample-company-urls）' }
        const { researchCompany } = await import('@/lib/shodan/research')
        const bad: string[] = []
        const lines: string[] = []
        for (const url of urls) {
          try {
            const r = await researchCompany(url) as unknown as Record<string, any>
            const failure = r.failure ? `${r.failure.cause ?? ''} ${Array.isArray(r.failure.actions) ? r.failure.actions.join('・') : ''}`.trim() : ''
            const home = r.sourceStatus?.homepage
            if (home !== 'ok' || !r.companyName) bad.push(`${url}: サイト=${home ?? '不明'} 社名=${r.companyName ? 'あり' : 'なし'}${failure ? `（${failure}）` : ''}`)
            lines.push(`${url}: ${r.companyName ?? '社名なし'}`)
          } catch (e) {
            bad.push(`${url}: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`)
          }
        }
        return bad.length ? { ok: false, error: bad.join(' / '), detail: lines.join(' / ') } : { ok: true, detail: lines.join(' / ') }
      },
    },
    {
      id: 'paid:agent-sales-prep', area: '外部サービス', label: 'B1 商談の準備を1回通す（会社の調査・見積の案・スライドの構成）', severity: 'urgent', threshold: 1, costYen: 1.8,
      hints: ['落ちた ToDo の札（cause と actions）を見る。会社の調査なら "[shodan/preparations] research failed" の stage・code・reason を見る', '402 ならテスト用の会社のドヤパワーが足りない。429 なら同時に動かす数の上限', 'テスト用のユーザーが UI_PREVIEW_EMAILS に入っているか（旗が preview のとき）を見る'],
      run: async (): Promise<CheckOutcome> => {
        const [url] = await sampleCompanyUrls()
        if (!url) return { ok: true, detail: '見本の URL が未設定のため回していない（watch:v1:sample-company-urls）' }
        const answers = { url, offer: 'web', budget: 'u50', stage: 'first' }
        const outcomes = await withTestUserSession(async cookie => Promise.all((['research', 'quote', 'slides'] as const).map(async (taskId): Promise<TaskOutcome> => {
          try {
            const res = await fetch(base + '/api/agent/tasks', {
              method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(280_000),
              headers: { 'content-type': 'application/json', cookie, origin: base },
              body: JSON.stringify({ recipeId: 'sales-prep', taskId, answers }),
            })
            const text = await res.text().catch(() => '')
            let j: Record<string, any> = {}
            try { j = JSON.parse(text) } catch { /* 下で本文の先頭を使う */ }
            if (res.ok && j.result) return { taskId, status: res.status, ok: true, message: 'できました' }
            return { taskId, status: res.status, ok: false, message: j.error ? `${j.error}（kind=${j.kind ?? '?'}）` : bodySnippet(text, 160) }
          } catch (e) {
            return { taskId, status: 0, ok: false, message: describeFetchError(e, 280_000) }
          }
        })))
        const failed = outcomes.filter(o => !o.ok)
        const detail = outcomes.map(o => `${o.taskId}: HTTP ${o.status || 'なし'} ${o.message}`).join(' / ')
        return failed.length ? { ok: false, url: base + '/api/agent/tasks', status: failed[0].status || undefined, error: failed.map(o => `${o.taskId}: ${o.message}`).join(' / '), detail } : { ok: true, url: base + '/api/agent/tasks', detail }
      },
    },
  ]
}
