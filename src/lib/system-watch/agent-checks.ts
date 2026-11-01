// エージェント（商談の準備）の確認。設計は feat/agent-orchestration の
// docs/architecture/agent-orchestration/FAILURE-CHECKLIST.md §7（エージェントの担当 local_bf659a4c が作成）。
//
// 無料（10分ごとの system-watch に入れる）
//   - 旗の外の人（ログインなし）に /api/agent/tasks が 404 を返すか
//   - 見本の会社のサイトを、AI を使わずに読めるか（取得・本文の長さ・NUL）
// 有料（1日1回。SystemSetting watch:v1:paid-agent-enabled が 'true' のときだけ。2026-10-26 ユーザー承認・1日 約10円まで）
//   - B1: 商談の準備を1回通す（会社の調査・見積の案・スライドの構成）。1回 約1.8円（上限 約10円）。
//         ユーザー本人のアカウント（SYSTEM_WATCH_TEST_USER_ID。2026-10-26 ユーザー指示）として呼ぶ。
//         ドヤパワーの旗が on なら、本人の会社の台帳から 31 減る。残りが MIN_POWER_FOR_B1 を切ったら回さない。
//         作る物には「【自動点検】」を付ける（marker.ts）。エージェントの側が印に対応するまでは回さない
//   - B2: 会社の調査だけを見本の URL で通す（gemini-2.5-flash を1つ1回）。B1 が使う1つ目を除いた2つで 約2.4円
// 見本のサイトは1日1回・1URL 1回まで読む（エージェントの担当の条件。今は自社のサイト）。
//   B1 は1つ目、B2 は2つ目と3つ目を読む。無料の「AI なしで読めるか」は、有料の確認が止まっているときだけ1日1回読む。
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { bodySnippet, describeFetchError } from '@/lib/health-check-report'
import { httpCheck, siteBase } from './http'
import { SYSTEM_WATCH_HEADER } from './marker'
import { systemWatchTokenFor } from './watch-gate'
import type { CheckDef, CheckOutcome } from './types'

export const PAID_AGENT_ENABLED_KEY = 'watch:v1:paid-agent-enabled'

/** 本人の作業に足りなくならないよう、ドヤパワーの残りがこれを切ったら B1 を回さない（2026-10-26 ユーザー指示の例の値） */
export const MIN_POWER_FOR_B1 = 300

/** 本人の会社のドヤパワーの残り（読むだけ。台帳の表を SQL で読む。旗が off・会社が無いときは null） */
export async function powerLeftFor(userId: string): Promise<number | null> {
  const { doyaPowerRollout } = await import('@/lib/doya-power/flag')
  if (doyaPowerRollout() === 'off') return null
  const rows = await prisma.$queryRaw<{ remaining: bigint | null }[]>`
    SELECT COALESCE(SUM(g.remaining), 0)::bigint AS remaining
    FROM account_companies c
    JOIN doya_power_accounts a ON a."companyId" = c.id
    LEFT JOIN doya_power_grants g ON g."accountId" = a.id AND (g."expiresAt" IS NULL OR g."expiresAt" > now())
    WHERE c."userId" = ${userId}`
  return rows.length ? Number(rows[0].remaining ?? 0) : null
}

/** 見本の会社。毎日読みに行くので、他社ではなく自社のサイト3つにする（2026-10-26 ユーザー指示、メイン経由）。
 *  2026-10-26 に手元で AI なしで読んで確かめた（取得・文字コード・本文の長さ・NUL）。社名の取り出しは AI なので、
 *  社名を照らし合わせるのは surisuta.jp だけにし、ほかは「社名が取れたか」を見る。 */
export type SampleCompany = { url: string; expectName?: string; note: string; jsRendered?: boolean }
export const DEFAULT_SAMPLE_COMPANIES: SampleCompany[] = [
  { url: 'https://surisuta.jp/', expectName: 'スリスタ', note: '会社のサイト。JavaScript で描く（本文 約8文字、題は「株式会社スリスタ」）', jsRendered: true },
  { url: 'https://doyamarke.surisuta.jp/', note: 'ドヤマーケのメディア（本文 約4,000字、UTF-8）' },
  { url: 'https://doya-ai.surisuta.jp/', note: 'ドヤAI（本文 約2,400字、UTF-8）' },
]

/** 見本の会社。SystemSetting watch:v1:sample-company-urls（か環境変数）で URL を差し替えられる（差し替えたときは社名を見ない） */
export async function sampleCompanies(): Promise<SampleCompany[]> {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'watch:v1:sample-company-urls' } }).catch(() => null)
  const raw = row?.value || process.env.SYSTEM_WATCH_SAMPLE_COMPANY_URLS || ''
  const urls = raw.split(/[\s,]+/).filter(u => /^https?:\/\//.test(u)).slice(0, 3)
  return urls.length ? urls.map(url => ({ url, note: '差し替えた見本' })) : DEFAULT_SAMPLE_COMPANIES
}

/** 文字コードを Content-Type から決めて読む（Shift_JIS のサイトを UTF-8 で読むと文字化けするため） */
export function decodeBody(body: Buffer, contentType: string): string {
  const charset = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase() ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 4096).toString('latin1'))?.[1]?.toLowerCase() ?? 'utf-8'
  try { return new TextDecoder(charset === 'windows-31j' || charset === 'sjis' ? 'shift_jis' : charset).decode(body) } catch { return body.toString('utf8') }
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
      id: 'agent:sample-sites', area: '外部サービス', label: '見本の会社のサイトを AI なしで読めるか（会社の調査の前提・1日1回）', severity: 'action', threshold: 1,
      hints: ['取得に失敗したサイトだけなら、そのサイト側の変更か拒否。全部なら外向きの通信か src/lib/net/safe-fetch.ts を見る', '文字化けなら、文字コードの判定（Content-Type と meta の charset）を見る', 'NUL を含むなら、会社の調査の文字の掃除（research.ts）が外れていないかを見る'],
      run: async (): Promise<CheckOutcome> => {
        // 人の会社のサイトなので1日1回だけ読む。有料の確認（B1・B2）が動く日は、そちらで読むので読まない
        const agentOn = (await prisma.systemSetting.findUnique({ where: { key: PAID_AGENT_ENABLED_KEY } }).catch(() => null))?.value === 'true'
        if (agentOn) return { ok: true, detail: '有料の確認 B1・B2 で同じサイトを読むため、ここでは読まない' }
        const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
        const memoKey = 'watch:v1:sample-sites-last'
        const memo = await prisma.systemSetting.findUnique({ where: { key: memoKey } }).catch(() => null)
        if (memo) { try { const m = JSON.parse(memo.value) as { day: string; outcome: CheckOutcome }; if (m.day === today) return m.outcome } catch { /* 読めなければ読み直す */ } }
        const { safeFetchResource } = await import('@/lib/net/safe-fetch')
        const lines: string[] = []
        const bad: string[] = []
        for (const s of await sampleCompanies()) {
          try {
            const r = await safeFetchResource(s.url, { timeoutMs: 12_000 })
            if (!r || !r.body.length) { bad.push(`${s.url}: 取得できません${r?.status ? `（HTTP ${r.status}）` : ''}`); continue }
            const text = decodeBody(r.body, r.contentType)
            const plain = text.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            const garbled = (plain.match(/\uFFFD/g) ?? []).length
            if (text.includes('\u0000')) bad.push(`${s.url}: 本文に NUL があります`)
            else if (garbled > 5) bad.push(`${s.url}: 文字化けしています（置き換え文字 ${garbled}個。${r.contentType}）`)
            else if (!s.jsRendered && plain.length < 200) bad.push(`${s.url}: 本文が短すぎます（${plain.length}文字）`)
            lines.push(`${s.url} ${plain.length}文字`)
          } catch (e) {
            bad.push(`${s.url}: ${describeFetchError(e, 12_000)}`)
          }
        }
        const outcome: CheckOutcome = bad.length ? { ok: false, error: bad.join(' / '), detail: lines.join(' / ') } : { ok: true, detail: lines.join(' / ') }
        await prisma.systemSetting.upsert({ where: { key: memoKey }, create: { key: memoKey, value: JSON.stringify({ day: today, outcome }) }, update: { value: JSON.stringify({ day: today, outcome }) } }).catch(() => {})
        return outcome
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

/** B1 の ToDo と、その ToDo が残す自動点検の記録の種類 */
export const TASK_RECORD_KIND = { research: 'shodan-preparation', quote: 'quote-document', slides: 'doyaslide-project' } as const
export type SalesPrepTask = keyof typeof TASK_RECORD_KIND

/** B1 の1つの ToDo の時間の上限。エージェントの作業は、スライドの構成で数分かかる（2026-10-26 本番の手動の1回で 25秒を超えた） */
export const B1_TASK_TIMEOUT_MS = 230_000
/** B1 の確認そのものの時間の上限（ToDo の上限のあと、記録を確かめる時間を足す）。ルートの maxDuration（300秒）に収める */
export const B1_CHECK_TIMEOUT_MS = 270_000

/**
 * B1 の結果を判定する（純粋関数）。
 * - 応答が成功なら、その ToDo はできた。
 * - 応答が届かなかった（時間切れ・通信が切れた・504）が、その ToDo の自動点検の記録ができていれば、作業は済んだとみなす
 *   （本番の手動の1回で、記録はできたのに確認の時間切れで NG になった。2026-10-26 統括の報告）。
 * - それ以外（4xx・5xx の応答、記録も無い時間切れ）は失敗。
 */
export function judgeSalesPrep(outcomes: TaskOutcome[], created: Partial<Record<SalesPrepTask, string[]>>): CheckOutcome & { createdIds: Partial<Record<SalesPrepTask, string[]>> } {
  const lines: string[] = []
  const bad: string[] = []
  for (const o of outcomes) {
    const ids = created[o.taskId as SalesPrepTask] ?? []
    const noResponse = o.status === 0 || o.status === 504
    if (o.ok) lines.push(`${o.taskId}: HTTP ${o.status} できました${ids.length ? `（記録 ${ids.join(',')}）` : ''}`)
    else if (noResponse && ids.length) lines.push(`${o.taskId}: 応答は届かなかったが、記録ができた（${ids.join(',')}）。作業は済んだとみなす（${o.message}）`)
    else { bad.push(`${o.taskId}: ${o.message}${noResponse ? '（記録も見つからない）' : ''}`); lines.push(`${o.taskId}: HTTP ${o.status || 'なし'} ${o.message}`) }
  }
  const detail = lines.join(' / ')
  const firstBad = outcomes.find(o => bad.some(b => b.startsWith(`${o.taskId}:`)))
  return bad.length
    ? { ok: false, status: firstBad?.status || undefined, error: bad.join(' / '), detail, createdIds: created }
    : { ok: true, detail, createdIds: created }
}

/** 本人の、今月の自動点検の記録の ID（ToDo ごと）。B1 の前後の差で、作った記録を知る */
async function markedFor(userId: string): Promise<Record<SalesPrepTask, string[]>> {
  const { systemWatchRecordIds } = await import('./marked-records')
  const [shodanOrgs, quoteOrgs] = await Promise.all([
    prisma.shodanMember.findMany({ where: { userId, status: 'ACTIVE' }, select: { organizationId: true } }).catch(() => []),
    prisma.quoteMember.findMany({ where: { userId, status: 'ACTIVE' }, select: { organizationId: true } }).catch(() => []),
  ])
  const [research, quote, slides] = await Promise.all([
    systemWatchRecordIds(prisma, 'shodan-preparation', shodanOrgs.map(o => o.organizationId)).catch(() => []),
    systemWatchRecordIds(prisma, 'quote-document', quoteOrgs.map(o => o.organizationId)).catch(() => []),
    systemWatchRecordIds(prisma, 'doyaslide-project', [userId]).catch(() => []),
  ])
  return { research, quote, slides }
}

export function paidAgentChecks(base = siteBase()): (CheckDef & { costYen: number })[] {
  return [
    {
      id: 'paid:agent-research-samples', area: '外部サービス', label: 'B2 会社の調査を見本の URL で通す（gemini-2.5-flash）', severity: 'action', threshold: 1, costYen: 2.4,
      hints: ['失敗の札の cause と actions を見る', '本番のログの "[shodan/preparations] research failed" の stage・code・reason を見る', '社名が違う・文字化けしているなら、文字コードの判定か会社の情報の取り出しを見る'],
      run: async (): Promise<CheckOutcome> => {
        // 1つ目は B1 が読むので、2つ目と3つ目だけを読む（1URL 1日1回まで）
        const samples = (await sampleCompanies()).slice(1)
        if (!samples.length) return { ok: true, skipped: true, detail: '見本が1つしか無いため回していない' }
        const { researchCompany } = await import('@/lib/shodan/research')
        const bad: string[] = []
        const lines: string[] = []
        for (const s of samples) {
          try {
            const r = await researchCompany(s.url) as unknown as Record<string, any>
            const failure = r.failure ? `${r.failure.cause ?? ''} ${Array.isArray(r.failure.actions) ? r.failure.actions.join('・') : ''}`.trim() : ''
            const name: string = r.companyName ?? ''
            const problems: string[] = []
            if (r.sourceStatus?.homepage !== 'ok') problems.push(`サイト=${r.sourceStatus?.homepage ?? '不明'}`)
            if (!name) problems.push('社名なし')
            else if (s.expectName && !name.includes(s.expectName)) problems.push(`社名「${name.slice(0, 40)}」に「${s.expectName}」が無い`)
            if (/\uFFFD/.test(name)) problems.push('社名が文字化け')
            if (s.jsRendered && r.diagnostics && r.diagnostics.jsRendered !== true) problems.push('JS で描くサイトと判定されていない')
            if (problems.length) bad.push(`${s.url}: ${problems.join('、')}${failure ? `（${failure}）` : ''}`)
            lines.push(`${s.url}: ${name || '社名なし'}`)
          } catch (e) {
            bad.push(`${s.url}: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`)
          }
        }
        return bad.length ? { ok: false, error: bad.join(' / '), detail: lines.join(' / ') } : { ok: true, detail: lines.join(' / ') }
      },
    },
    {
      id: 'paid:agent-sales-prep', area: '外部サービス', label: 'B1 商談の準備を1回通す（会社の調査・見積の案・スライドの構成）', severity: 'urgent', threshold: 1, costYen: 1.8, timeoutMs: B1_CHECK_TIMEOUT_MS,
      hints: ['落ちた ToDo の札（cause と actions）を見る。会社の調査なら "[shodan/preparations] research failed" の stage・code・reason を見る', '402 ならテスト用の会社のドヤパワーが足りない。429 なら同時に動かす数の上限', 'テスト用のユーザーが UI_PREVIEW_EMAILS に入っているか（旗が preview のとき）を見る'],
      run: async (): Promise<CheckOutcome> => {
        const url = (await sampleCompanies())[0]?.url
        if (!url) return { ok: true, skipped: true, detail: '見本の URL が無いため回していない' }
        // テスト用のアカウントが決まるまでは回さない（毎日「未設定」で知らせない。費用にも数えない）
        const testUserId = process.env.SYSTEM_WATCH_TEST_USER_ID
        if (!testUserId) return { ok: true, skipped: true, detail: 'テスト用のアカウント（SYSTEM_WATCH_TEST_USER_ID）が未設定のため回していない' }
        // 本人の会社に印の無い物を作らないよう、エージェントの側が「【自動点検】」に対応するまでは回さない
        const routes = await import('@/lib/agent-orchestration/routes.server') as Record<string, unknown>
        if (routes.SYSTEM_WATCH_MARKER_SUPPORTED !== true) return { ok: true, skipped: true, detail: 'エージェントの側が「【自動点検】」の印にまだ対応していないため回していない（routes.server の SYSTEM_WATCH_MARKER_SUPPORTED）' }
        // 本人の作業に足りなくならないよう、ドヤパワーの残りが少ないときは回さない
        const left = await powerLeftFor(testUserId)
        if (left !== null && left < MIN_POWER_FOR_B1) return { ok: true, skipped: true, detail: `ドヤパワーの残りが ${left} で、${MIN_POWER_FOR_B1} を切っているため回していない` }
        // 合図は本人（SYSTEM_WATCH_TEST_USER_ID）と今日の日付に結び付く（watch-gate.ts）。日付の変わり目をまたがないよう、送る直前に作る
        if (!systemWatchTokenFor(testUserId)) return { ok: true, skipped: true, detail: 'CRON_SECRET が無いため、自動点検の合図を作れず回していない' }
        const answers = { url, offer: 'web', budget: 'u50', stage: 'first' }
        const before = await markedFor(testUserId)
        const outcomes = await withTestUserSession(async cookie => Promise.all((['research', 'quote', 'slides'] as const).map(async (taskId): Promise<TaskOutcome> => {
          try {
            const res = await fetch(base + '/api/agent/tasks', {
              method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(B1_TASK_TIMEOUT_MS),
              headers: { 'content-type': 'application/json', cookie, origin: base, [SYSTEM_WATCH_HEADER]: systemWatchTokenFor(testUserId) ?? '' },
              body: JSON.stringify({ recipeId: 'sales-prep', taskId, answers }),
            })
            const text = await res.text().catch(() => '')
            let j: Record<string, any> = {}
            try { j = JSON.parse(text) } catch { /* 下で本文の先頭を使う */ }
            if (res.ok && j.result) return { taskId, status: res.status, ok: true, message: 'できました' }
            return { taskId, status: res.status, ok: false, message: j.error ? `${j.error}（kind=${j.kind ?? '?'}）` : bodySnippet(text, 160) }
          } catch (e) {
            return { taskId, status: 0, ok: false, message: describeFetchError(e, B1_TASK_TIMEOUT_MS) }
          }
        })))
        // 作った記録は、前後の自動点検の記録の ID の差で知る（応答が時間内に届かなくても分かる）
        const after = await markedFor(testUserId)
        const created = Object.fromEntries((Object.keys(TASK_RECORD_KIND) as SalesPrepTask[]).map(k => [k, after[k].filter(id => !before[k].includes(id))])) as Record<SalesPrepTask, string[]>
        const { createdIds: _ids, ...judged } = judgeSalesPrep(outcomes, created)
        return { ...judged, url: base + '/api/agent/tasks' }
      },
    },
  ]
}
