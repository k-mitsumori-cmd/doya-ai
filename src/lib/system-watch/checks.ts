// ドヤAIの常時確認の一覧（有料の API を使わない分）。
// すべて読むだけ: GET の取得、DB の SELECT、外部サービスの「一覧・状態を読む」API だけを使う。
// 本番の利用者のデータを作ったり変えたりしない。生成・送信・課金の発生する呼び出しはしない。
import { prisma } from '@/lib/prisma'
import { SERVICES, RETIRED_SERVICE_IDS } from '@/lib/services'
import { doyaPowerRollout } from '@/lib/doya-power/flag'
import { httpCheck, jsonBody } from './http'
import type { CheckDef, CheckOutcome } from './types'

const HOUR = 3_600_000
const ok = (detail?: string, extra: Partial<CheckOutcome> = {}): CheckOutcome => ({ ok: true, detail, ...extra })
const ng = (error: string, extra: Partial<CheckOutcome> = {}): CheckOutcome => ({ ok: false, error, ...extra })

export function siteBase(): string {
  return (process.env.SYSTEM_WATCH_BASE_URL || 'https://doya-ai.surisuta.jp').replace(/\/$/, '')
}

const PAGE_HINTS = [
  'Vercel の最新のデプロイが Ready か、Runtime Logs に同じ URL のエラーが出ていないかを見る',
  '直前のコミットでこの画面のファイル（src/app/(shell)/<ツール>/）を変えていないかを見る',
  'DB の確認も失敗しているなら、先に DB（Supabase）の状態を見る',
]

/** 画面: トップ・料金・サインインと、公開中（status=active）のツールの入口。新しいツールは services.ts から自動で増える。 */
export function pageChecks(base = siteBase()): CheckDef[] {
  const fixed = [
    { path: '/', label: 'トップ', severity: 'urgent' as const },
    { path: '/pricing', label: '料金ページ', severity: 'urgent' as const },
    { path: '/auth/signin', label: 'サインイン', severity: 'urgent' as const },
  ]
  const tools = SERVICES
    .filter(s => s.status === 'active' && !RETIRED_SERVICE_IDS.has(s.id) && s.href?.startsWith('/'))
    .map(s => ({ path: s.href, label: s.name, severity: 'action' as const }))
  const seen = new Set<string>()
  return [...fixed, ...tools].filter(p => !seen.has(p.path) && seen.add(p.path)).map(p => ({
    id: `page:${p.path}`,
    area: '画面' as const,
    label: `${p.label}（${p.path}）`,
    severity: p.severity,
    threshold: 2,
    hints: PAGE_HINTS,
    run: () => httpCheck(base + p.path, { page: true, allowRedirect: true }),
  }))
}

/** 認証なしで読める API。どれも副作用が無い。 */
export function apiChecks(base = siteBase()): CheckDef[] {
  return [
    {
      id: 'api:health', area: 'API', label: 'ヘルスチェック（/api/health）', severity: 'urgent', threshold: 2,
      hints: ['database が connected でなければ Supabase の状態と DATABASE_URL を見る', 'Vercel の関数が起動しているか（Runtime Logs）を見る'],
      run: () => httpCheck(base + '/api/health', { body: jsonBody(j => (j.status === 'ok' && j.database === 'connected') || `status=${j.status} database=${j.database}`) }),
    },
    {
      id: 'api:auth-providers', area: 'API', label: 'ログインの入口（/api/auth/providers）', severity: 'urgent', threshold: 2,
      hints: ['NEXTAUTH_URL・NEXTAUTH_SECRET・GOOGLE_CLIENT_ID が本番に入っているかを見る', 'src/lib/auth.ts の providers を最近変えていないかを見る'],
      run: () => httpCheck(base + '/api/auth/providers', { body: jsonBody(j => (j.google?.callbackUrl?.startsWith(base) ? true : `Google の入口が無いか、戻り先が違います: ${j.google?.callbackUrl ?? 'なし'}`)) }),
    },
    {
      id: 'api:auth-session', area: 'API', label: 'セッションの読み取り（/api/auth/session）', severity: 'urgent', threshold: 2,
      hints: ['NEXTAUTH_SECRET を変えていないか、DB のセッションの表が読めるかを見る'],
      run: () => httpCheck(base + '/api/auth/session', { body: jsonBody(j => (typeof j === 'object' && j !== null) || 'セッションの応答が JSON の object ではありません') }),
    },
    {
      id: 'api:trial-eligibility', area: 'API', label: '初月無料の判定（/api/stripe/trial-eligibility）', severity: 'action', threshold: 2,
      hints: ['src/lib/trial.ts と Stripe の API キーを見る（判定に失敗すると「初月無料」の表示が消える）'],
      run: () => httpCheck(base + '/api/stripe/trial-eligibility', { body: jsonBody(j => typeof j.eligible === 'boolean' || `eligible が真偽値ではありません: ${JSON.stringify(j).slice(0, 80)}`) }),
    },
    {
      id: 'api:stripe-webhook-route', area: 'API', label: 'Stripe Webhook の受け口（/api/stripe/webhook）', severity: 'urgent', threshold: 2,
      hints: ['GET に 405 を返すのが正常。404 なら受け口のファイルが消えた、500 なら起動時のエラー'],
      run: () => httpCheck(base + '/api/stripe/webhook', { status: 405 }),
    },
    {
      id: 'api:cron-guard', area: 'API', label: 'cron の鍵の確認（認証なしで 401 になるか）', severity: 'urgent', threshold: 2,
      hints: ['200 を返したなら CRON_SECRET の確認が外れている。src/app/api/cron/health-alert/route.ts の先頭を見る'],
      run: () => httpCheck(base + '/api/cron/health-alert', { status: 401 }),
    },
  ]
}

/** DB と台帳。SELECT だけ。 */
export function dbChecks(): CheckDef[] {
  return [
    {
      id: 'db:connect', area: 'DB', label: 'DB の接続と応答時間', severity: 'urgent', threshold: 2,
      hints: ['Supabase のダッシュボードで障害・接続数の上限を見る', 'DATABASE_URL（pgbouncer）を変えていないかを見る'],
      run: async () => {
        const t = Date.now()
        await prisma.$queryRaw`SELECT 1`
        const ms = Date.now() - t
        return ms > 3000 ? ng(`DB の応答が遅すぎます（${ms}ms、上限 3000ms）`, { detail: `${ms}ms` }) : ok(`${ms}ms`)
      },
    },
    {
      id: 'db:stripe-webhook-events', area: 'DB', label: 'Stripe Webhook の処理（直近24時間の失敗・止まり）', severity: 'urgent', threshold: 1,
      hints: ['Stripe のダッシュボードの Webhook の配信履歴で同じイベントのエラーを見る', 'src/app/api/stripe/webhook/route.ts の updateUserSubscription のログを見る', 'reference/11-billing-spec.md の障害ランブックに沿って、User.plan を確かめる'],
      run: async () => {
        const failed = await prisma.stripeWebhookEvent.findMany({ where: { status: 'failed', lastReceivedAt: { gte: new Date(Date.now() - 24 * HOUR) } }, select: { id: true, type: true, attempts: true }, take: 5 })
        const stuck = await prisma.stripeWebhookEvent.findMany({ where: { status: 'processing', lastReceivedAt: { lt: new Date(Date.now() - HOUR) } }, select: { id: true, type: true }, take: 5 })
        if (failed.length || stuck.length) return ng(`失敗 ${failed.length}件、処理中のまま1時間超 ${stuck.length}件`, { detail: [...failed.map(f => `${f.type}（${f.id}、${f.attempts}回）`), ...stuck.map(s => `処理中: ${s.type}（${s.id}）`)].join(' / ') })
        return ok('失敗 0件')
      },
    },
    {
      id: 'db:stripe-notifications', area: 'DB', label: 'Stripe の運営通知の送り残し', severity: 'action', threshold: 1,
      hints: ['/api/cron/stripe-notifications が動いているか、Slack の送り先（slack_webhook）が生きているかを見る'],
      run: async () => {
        const n = await prisma.stripeWebhookNotification.count({ where: { status: { in: ['pending', 'sending'] }, createdAt: { lt: new Date(Date.now() - HOUR) } } })
        return n ? ng(`1時間以上送れていない通知が ${n}件あります`) : ok('0件')
      },
    },
    {
      id: 'db:drip-failures', area: 'DB', label: 'ドリップメールの送信の失敗（直近24時間）', severity: 'action', threshold: 1,
      hints: ['Resend のダッシュボードの Logs でエラーの理由（宛先・ドメイン・上限）を見る', '/api/cron/drip-sender の Runtime Logs を見る'],
      run: async () => {
        const since = new Date(Date.now() - 24 * HOUR)
        const [failed, bounced, sent] = await Promise.all([
          prisma.dripEmailLog.count({ where: { status: 'failed', sentAt: { gte: since } } }),
          prisma.dripEmailLog.count({ where: { status: 'bounced', sentAt: { gte: since } } }),
          prisma.dripEmailLog.count({ where: { sentAt: { gte: since } } }),
        ])
        // 宛先の不達（bounced）は一定数あり得るので、送信の失敗（failed）だけを失敗として扱う
        return failed ? ng(`送信の失敗 ${failed}件（全 ${sent}件中）`, { detail: `不達 ${bounced}件` }) : ok(`送信 ${sent}件、失敗 0件、不達 ${bounced}件`)
      },
    },
    {
      id: 'db:tables', area: 'DB', label: '旗の内側で使う表がそろっているか', severity: 'urgent', threshold: 1,
      hints: ['表が無いまま旗を on にすると、その機能の API が 500/503 になる。doya-db-push の手順でスキーマを本番に反映する'],
      run: async () => {
        const need: [string, string][] = [['account_companies', '会社の登録（常に使う）']]
        if (doyaPowerRollout() !== 'off') need.push(['doya_power_accounts', 'ドヤパワー'], ['doya_power_grants', 'ドヤパワー'], ['doya_power_transactions', 'ドヤパワー'])
        if (process.env.AGENT_RUNS_STORE === 'db' && (process.env.AGENT_ORCHESTRATION_ROLLOUT ?? 'off') !== 'off') need.push(['home_agent_runs', 'エージェント'], ['home_agent_tasks', 'エージェント'])
        const rows = await prisma.$queryRaw<{ name: string; ok: boolean }[]>`SELECT t AS name, to_regclass(t) IS NOT NULL AS ok FROM unnest(${need.map(n => n[0])}::text[]) AS t`
        const missing = rows.filter(r => !r.ok).map(r => `${r.name}（${need.find(n => n[0] === r.name)?.[1]}）`)
        return missing.length ? ng(`表がありません: ${missing.join(', ')}`) : ok(`${need.length}表あり`)
      },
    },
    {
      id: 'ledger:doya-power', area: '台帳', label: 'ドヤパワーの台帳の整合', severity: 'urgent', threshold: 1,
      hints: ['ずれた口座の doya_power_transactions を時刻順に見て、最後に正しかった記録を探す', 'src/lib/doya-power/ledger.ts の consume / refund / grant を最近変えていないかを見る'],
      run: async () => {
        if (doyaPowerRollout() === 'off') return ok('旗が off のため確認しない（台帳を使っていない）')
        // 不変条件1: 残高の写し = 付与の残りの合計（期限切れは次の読み書きで 0 になるので、残りは全部足す）
        const balance = await prisma.$queryRaw<{ id: string; balance: number; remaining: bigint }[]>`
          SELECT a.id, a.balance, COALESCE(SUM(g.remaining), 0)::bigint AS remaining
          FROM doya_power_accounts a LEFT JOIN doya_power_grants g ON g."accountId" = a.id
          GROUP BY a.id, a.balance HAVING a.balance <> COALESCE(SUM(g.remaining), 0)`
        // 不変条件2: 増減の記録の合計 = 付与の残りの合計
        const tx = await prisma.$queryRaw<{ id: string }[]>`
          SELECT a.id FROM doya_power_accounts a
          WHERE COALESCE((SELECT SUM(t.amount) FROM doya_power_transactions t WHERE t."accountId" = a.id), 0)
             <> COALESCE((SELECT SUM(g.remaining) FROM doya_power_grants g WHERE g."accountId" = a.id), 0)`
        // 不変条件3: 残りは 0 以上、付与量以下
        const bad = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM doya_power_grants WHERE remaining < 0 OR remaining > amount`
        const n = Number(bad[0]?.n ?? 0)
        const accounts = Number((await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM doya_power_accounts`)[0]?.n ?? 0)
        if (balance.length || tx.length || n) {
          return ng(`写しのずれ ${balance.length}口座、記録の合計のずれ ${tx.length}口座、範囲外の付与 ${n}件`, { detail: [...balance.slice(0, 3).map(b => `口座 ${b.id}: 写し ${b.balance} / 残り ${b.remaining}`), ...tx.slice(0, 3).map(t => `口座 ${t.id}: 記録の合計が合わない`)].join(' / ') })
        }
        return ok(`${accounts}口座で一致`)
      },
    },
  ]
}

/** cron が予定どおり動いているか（各 cron が DB に残す完了の記録を見る）。 */
export function cronChecks(): CheckDef[] {
  const ops: [string, number, string][] = [
    ['watch', 1, '日報の未着の見張り（15分ごと）'],
    ['reviews', 6, 'ストアのレビューの取得（4時間ごと）'],
    ['daily', 26, '運用の日次集計（毎日 6:50）'],
    ['cost', 26, '費用の確認（毎日 7:30）'],
    ['weekly', 8 * 24, '週次のまとめ（毎週月曜）'],
  ]
  return ops.map(([mode, hours, label]) => ({
    id: `cron:ops-${mode}`, area: 'cron' as const, label, severity: 'action' as const, threshold: 1,
    hints: [`Vercel の Cron Jobs で /api/cron/service-operations-${mode} の最近の実行結果を見る`, 'vercel.json にパスが残っているか（クエリ付きのパスは定時に動かない）を見る', '運用の Slack に「運用ジョブの失敗」が来ていないかを見る'],
    run: async () => {
      const rows = await prisma.systemSetting.findMany({ where: { key: { startsWith: `ops:v1:done:job:${mode}` } }, select: { value: true } })
      let latest = ''
      for (const r of rows) { try { const at = JSON.parse(r.value).at as string; if (at > latest) latest = at } catch { /* 壊れた値は数えない */ } }
      if (!latest) return ng('完了の記録がありません')
      const ageH = (Date.now() - Date.parse(latest)) / HOUR
      return ageH > hours ? ng(`最後の完了から ${ageH.toFixed(1)}時間たっています（上限 ${hours}時間）`, { detail: `最後の完了 ${latest}` }) : ok(`最後の完了 ${latest}`)
    },
  })).concat([{
    id: 'cron:ops-locks', area: 'cron', label: '運用 cron のロックの取り残し', severity: 'action', threshold: 1,
    hints: ['期限の切れたロック（SystemSetting の ops:v1:lock:*）があると、その処理が止まる。処理が落ちた原因を Runtime Logs で見る'],
    run: async () => {
      const locks = await prisma.systemSetting.findMany({ where: { key: { startsWith: 'ops:v1:lock:' } }, select: { key: true, value: true } })
      const stale = locks.filter(l => Number(l.value) < Date.now() - HOUR)
      return stale.length ? ng(`1時間以上前に期限の切れたロックが ${stale.length}件`, { detail: stale.slice(0, 5).map(l => l.key.replace('ops:v1:lock:', '')).join(', ') }) : ok(`ロック ${locks.length}件`)
    },
  }])
}

function geminiKey(): string | undefined {
  return process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined
}

/** コードで使っている AI のモデルID。廃止されると、そのツールが静かに止まる（2026-08 に30か所の実績）。 */
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-pro-latest', 'gemini-3-flash-preview', 'gemini-3-pro-image', 'gemini-3-pro-image-preview', 'nano-banana-pro-preview']
// gpt-realtime は面接官・AI商談の音声、gpt-image-1 は画像の編集の予備
export const OPENAI_MODELS = ['gpt-image-2', 'gpt-image-1', 'gpt-4o', 'gpt-4o-mini', 'gpt-4o-transcribe', 'gpt-realtime']
// AIO（claude-sonnet-4-6）・記事作成と展開とミツボシ（claude-haiku-4-5-20251001）が使う
export const ANTHROPIC_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001']

/** 非公開でなければならない保存先（env で名前を変えていれば、その名前）。無いものは、そのツールが初めて保存するときに非公開で作る */
export const PRIVATE_BUCKETS = [
  process.env.INTERVIEW_STORAGE_BUCKET || 'interview-materials',
  'doyaslide',
  'persona-private-images',
  process.env.HR_PHOTO_STORAGE_BUCKET || 'hr-photos-private',
  process.env.SHODAN_STORAGE_BUCKET || 'shodan',
  process.env.MENSETSU_STORAGE_BUCKET || 'mensetsu',
  'adimage',
  'adbanner',
  process.env.POPUP_STORAGE_BUCKET || 'popup',
  process.env.SEO_STORAGE_BUCKET || 'seo-generated-images',
]
/** 公開でよいと分かっている保存先（banner-templates はテンプレートの見本、hr-photos は移行前の古い HR の写真） */
export const KNOWN_PUBLIC_BUCKETS = ['banner-templates', 'hr-photos']

/** 外部サービス。どれも「読む」API（モデルの情報・価格・バケットの一覧・ドメインの状態）だけで、料金はかからない。 */
export function externalChecks(): CheckDef[] {
  const list: CheckDef[] = [
    {
      id: 'ext:outbound', area: '外部サービス', label: '外のサイトの取得（URL を読むツールの前提）', severity: 'action', threshold: 2,
      hints: ['Vercel 側の外向きの通信の障害かもしれない。https://www.vercel-status.com を見る', 'AIO・質問リンク・広告画像AI の URL の読み込みが失敗していないかを見る'],
      run: () => httpCheck('https://example.com/', { body: t => /Example Domain/.test(t) || '想定の本文ではありません' }),
    },
    {
      id: 'ext:google-oauth', area: '外部サービス', label: 'Google のログイン（OpenID の設定）', severity: 'urgent', threshold: 2,
      hints: ['Google 側の障害なら待つしかない。https://www.google.com/appsstatus を見る'],
      run: () => httpCheck('https://accounts.google.com/.well-known/openid-configuration', { body: jsonBody(j => !!j.authorization_endpoint || 'authorization_endpoint がありません') }),
    },
  ]
  for (const model of GEMINI_MODELS) {
    list.push({
      id: `ext:gemini:${model}`, area: '外部サービス', label: `Gemini のモデル ${model}`, severity: 'urgent', threshold: 2,
      hints: ['404 ならモデルが廃止された。CLAUDE.md の「AIモデルIDは腐る」に沿って、エイリアス（gemini-flash-latest / gemini-pro-latest）へ置き換える', '400/403 なら GOOGLE_GENAI_API_KEY の制限（Gemini 用の AQ. 形式か）を見る'],
      run: async () => {
        const key = geminiKey()
        if (!key) return ng('Gemini の API キー（GOOGLE_GENAI_API_KEY）が本番に設定されていません')
        return httpCheck(`https://generativelanguage.googleapis.com/v1beta/models/${model}`, { headers: { 'x-goog-api-key': key }, body: jsonBody(j => !!j.name || 'モデルの情報がありません') })
      },
    })
  }
  for (const model of OPENAI_MODELS) {
    list.push({
      id: `ext:openai:${model}`, area: '外部サービス', label: `OpenAI のモデル ${model}`, severity: 'action', threshold: 2,
      hints: ['401 なら OPENAI_API_KEY が無効、404 ならモデルが使えなくなった。src/lib/image-generator.ts のフォールバック（nano-banana-pro-preview）が動くかを見る'],
      run: async () => {
        if (!process.env.OPENAI_API_KEY) return ng('OPENAI_API_KEY が本番に設定されていません')
        return httpCheck(`https://api.openai.com/v1/models/${model}`, { headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` } })
      },
    })
  }
  list.push(
    {
      id: 'ext:stripe-price', area: '外部サービス', label: 'Stripe のプロの価格（¥9,980・月額）', severity: 'urgent', threshold: 2,
      hints: ['active が false なら Stripe のダッシュボードで価格が無効になっていないかを見る', 'STRIPE_PRICE_BANNER_PRO_MONTHLY と STRIPE_SECRET_KEY（本番用の sk_live）を見る'],
      run: async () => {
        const id = process.env.STRIPE_PRICE_BANNER_PRO_MONTHLY
        if (!id || !process.env.STRIPE_SECRET_KEY) return ng('STRIPE_PRICE_BANNER_PRO_MONTHLY または STRIPE_SECRET_KEY が本番に設定されていません')
        return httpCheck(`https://api.stripe.com/v1/prices/${encodeURIComponent(id)}`, {
          headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
          body: jsonBody(j => (j.active === true && j.unit_amount === 9980 && j.currency === 'jpy' && j.recurring?.interval === 'month') || `active=${j.active} 金額=${j.unit_amount} ${j.currency} ${j.recurring?.interval ?? ''}`),
        })
      },
    },
    {
      id: 'ext:stripe-webhook-endpoint', area: '外部サービス', label: 'Stripe に登録された Webhook の宛先', severity: 'urgent', threshold: 2,
      hints: ['宛先が無い・無効だと、支払いが済んでも User.plan が PRO にならない。Stripe のダッシュボードの Developers → Webhooks を見る', 'reference/11-billing-spec.md の反映4経路を確かめる'],
      run: async () => {
        if (!process.env.STRIPE_SECRET_KEY) return ng('STRIPE_SECRET_KEY が本番に設定されていません')
        const expected = process.env.STRIPE_WEBHOOK_EXPECTED_URL || `${siteBase()}/api/stripe/webhook`
        return httpCheck('https://api.stripe.com/v1/webhook_endpoints?limit=100', {
          headers: { authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
          body: jsonBody(j => {
            const ep = (j.data ?? []).find((e: { url: string }) => e.url === expected)
            if (!ep) return `宛先 ${expected} が Stripe に登録されていません`
            if (ep.status !== 'enabled') return `宛先 ${expected} の状態が ${ep.status} です`
            const need = ['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted']
            const events: string[] = ep.enabled_events ?? []
            const lack = events.includes('*') ? [] : need.filter(n => !events.includes(n))
            return lack.length ? `受け取るイベントが足りません: ${lack.join(', ')}` : true
          }),
        })
      },
    },
    {
      id: 'ext:supabase-storage', area: '外部サービス', label: 'Supabase Storage（保存先が読めて、非公開のままか）', severity: 'urgent', threshold: 2,
      hints: ['公開になっていたら、Supabase の Storage でそのバケットを Private に戻し、公開 URL が外に出ていないかを確かめる', '一覧が読めないなら、Supabase の Storage の障害と SUPABASE_URL・SUPABASE_SERVICE_ROLE_KEY を見る'],
      run: async () => {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !key) return ng('SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が本番に設定されていません')
        return httpCheck(`${url.replace(/\/$/, '')}/storage/v1/bucket`, {
          headers: { authorization: `Bearer ${key}`, apikey: key },
          body: jsonBody(j => {
            if (!Array.isArray(j)) return 'バケットの一覧が読めません'
            const buckets = j as { name: string; public: boolean }[]
            const leaked = buckets.filter(b => b.public && PRIVATE_BUCKETS.includes(b.name)).map(b => b.name)
            const unknownPublic = buckets.filter(b => b.public && !PRIVATE_BUCKETS.includes(b.name) && !KNOWN_PUBLIC_BUCKETS.includes(b.name)).map(b => b.name)
            if (leaked.length) return `非公開のはずの保存先が公開になっています: ${leaked.join(', ')}（利用者のファイルが URL で誰でも見られる）`
            if (unknownPublic.length) return `知らない公開の保存先があります: ${unknownPublic.join(', ')}`
            return true
          }),
        })
      },
    },
    {
      id: 'ext:resend-domain', area: '外部サービス', label: 'Resend の送信ドメイン（ドリップ・通知メール）', severity: 'action', threshold: 2,
      hints: ['Resend のダッシュボードでドメインの DNS（SPF/DKIM）が verified かを見る', 'RESEND_API_KEY と RESEND_FROM_EMAIL を見る'],
      run: async () => {
        const key = process.env.RESEND_API_KEY
        const from = process.env.RESEND_FROM_EMAIL ?? ''
        if (!key) return ng('RESEND_API_KEY が本番に設定されていません')
        const domain = from.replace(/^.*<|>.*$/g, '').split('@')[1]?.toLowerCase()
        return httpCheck('https://api.resend.com/domains', {
          headers: { authorization: `Bearer ${key}` },
          body: jsonBody(j => {
            const d = (j.data ?? []).find((x: { name: string }) => x.name.toLowerCase() === domain)
            return d ? (d.status === 'verified' || `ドメイン ${domain} の状態が ${d.status} です`) : `送信元のドメイン ${domain ?? '（RESEND_FROM_EMAIL が無い）'} が Resend にありません`
          }),
        })
      },
    },
    {
      id: 'ext:assemblyai', area: '外部サービス', label: 'AssemblyAI（文字起こし）', severity: 'action', threshold: 2,
      hints: ['401 なら ASSEMBLYAI_API_KEY が無効。AssemblyAI のダッシュボードで残高とキーを見る'],
      run: async () => {
        if (!process.env.ASSEMBLYAI_API_KEY) return ng('ASSEMBLYAI_API_KEY が本番に設定されていません')
        return httpCheck('https://api.assemblyai.com/v2/transcript?limit=1', { headers: { authorization: process.env.ASSEMBLYAI_API_KEY } })
      },
    },
  )
  for (const model of ANTHROPIC_MODELS) {
    list.push({
      id: `ext:anthropic:${model}`, area: '外部サービス', label: `Claude のモデル ${model}`, severity: 'action', threshold: 2,
      hints: ['404 ならモデルが廃止された。src/lib/aio/engines.ts・seo/lib/gemini.ts・src/lib/mitsuboshi/_shared/constants.ts の既定のモデルを置き換える', '401 なら ANTHROPIC_API_KEY が無効。クレジット切れはこの確認では分からないので、有料の確認（1日1回）で見る'],
      run: async () => {
        if (!process.env.ANTHROPIC_API_KEY) return ng('ANTHROPIC_API_KEY が本番に設定されていません')
        return httpCheck(`https://api.anthropic.com/v1/models/${model}`, { headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } })
      },
    })
  }
  return list
}

/** 動くのに要る環境変数（名前だけを見る。値は出さない）。 */
export const REQUIRED_ENV = [
  'DATABASE_URL', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_BANNER_PRO_MONTHLY',
  'GOOGLE_GENAI_API_KEY', 'OPENAI_API_KEY', 'CRON_SECRET', 'RESEND_API_KEY', 'RESEND_FROM_EMAIL',
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ASSEMBLYAI_API_KEY',
]

/** 無くても動くが、一部の機能が静かに止まる環境変数（名前と使い道） */
export const OPTIONAL_ENV: [string, string][] = [
  ['ANTHROPIC_API_KEY', '記事作成などの文章生成の第一候補'],
  ['SERPER_API_KEY', '記事作成・スライド・AIO の検索'],
  ['PERPLEXITY_API_KEY', 'AIO の Perplexity'],
  ['GBIZINFO_API_TOKEN', 'ドヤリストの gBizINFO'],
  ['CORPORATE_NUMBER_API_KEY', 'ドヤリストの国税庁の法人番号'],
]

export function configChecks(base = siteBase()): CheckDef[] {
  return [
    {
      id: 'config:env', area: '設定', label: '必要な環境変数', severity: 'urgent', threshold: 1,
      hints: ['vercel env ls production で名前を確かめ、足りないものを足してから再デプロイする（変更は再デプロイまで反映されない）'],
      run: async () => {
        const missing = REQUIRED_ENV.filter(n => !process.env[n])
        return missing.length ? ng(`未設定: ${missing.join(', ')}`) : ok(`${REQUIRED_ENV.length}件すべて設定済み`)
      },
    },
    {
      id: 'config:nextauth-url', area: '設定', label: 'NEXTAUTH_URL が本番のドメインか', severity: 'urgent', threshold: 1,
      hints: ['vercel.app の URL だとログイン後の戻り先とメールのリンクが壊れる。https://doya-ai.surisuta.jp にする'],
      run: async () => {
        const v = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')
        return v === base ? ok(v) : ng(`NEXTAUTH_URL が ${v || '未設定'} です（期待 ${base}）`)
      },
    },
    {
      id: 'config:limits-off', area: '設定', label: '利用回数の上限が外れていないか（DOYA_DISABLE_LIMITS）', severity: 'urgent', threshold: 1,
      hints: ['本番で上限を外すと、無料の人も AI を使い放題になり費用が増える。Vercel の環境変数から消して再デプロイする'],
      run: async () => {
        const on = Object.keys(process.env).filter(k => /(^|_)DISABLE_LIMITS$/.test(k) && process.env[k] && !['0', 'false'].includes(String(process.env[k]).toLowerCase()))
        return on.length ? ng(`上限を外す設定が入っています: ${on.join(', ')}`) : ok('上限を外す設定なし')
      },
    },
    {
      id: 'config:slack-webhook', area: '設定', label: '運用チャンネルの Slack の送り先（SystemSetting slack_webhook）', severity: 'urgent', threshold: 1,
      hints: ['行が無いと、登録・決済・エラーの通知がどこにも届かない。管理画面の設定から Slack の Incoming Webhook を登録する'],
      run: async () => {
        const row = await prisma.systemSetting.findUnique({ where: { key: 'slack_webhook' }, select: { value: true } })
        if (!row?.value) return ng('slack_webhook の行がありません')
        return row.value.startsWith('https://hooks.slack.com/') ? ok('設定あり') : ng('slack_webhook が Slack の Incoming Webhook の形ではありません')
      },
    },
    {
      id: 'config:optional-env', area: '設定', label: '一部のツールが使う環境変数', severity: 'action', threshold: 1, repeatMs: 24 * HOUR,
      hints: ['無いと、そのツールの一部が静かに空の結果を返す。各サービスの鍵を取り、Vercel に足して再デプロイする'],
      run: async () => {
        const missing = OPTIONAL_ENV.filter(([n]) => !process.env[n]).map(([n, use]) => `${n}（${use}）`)
        return missing.length ? ng(`未設定: ${missing.join(', ')}`) : ok(`${OPTIONAL_ENV.length}件すべて設定済み`)
      },
    },
    {
      id: 'flag:agent', area: '旗', label: '旗「エージェント」（AGENT_ORCHESTRATION_ROLLOUT / AGENT_RUNS_STORE）', severity: 'action', threshold: 1,
      hints: ['意図しない変更なら Vercel の環境変数を戻して再デプロイする'],
      run: async () => {
        const v = `${(process.env.AGENT_ORCHESTRATION_ROLLOUT ?? 'off').trim() || 'off'} / store=${process.env.AGENT_RUNS_STORE ?? 'memory'}`
        return ok(v, { observed: v })
      },
    },
    {
      id: 'flag:guide-popups', area: '旗', label: '旗「案内のポップアップ」（GUIDE_POPUPS_ROLLOUT）', severity: 'action', threshold: 1,
      hints: ['意図しない変更なら Vercel の環境変数を戻して再デプロイする'],
      run: async () => {
        const v = (process.env.GUIDE_POPUPS_ROLLOUT ?? 'off').trim() || 'off'
        return ok(v, { observed: v })
      },
    },
    {
      id: 'flag:doya-power', area: '旗', label: '旗「ドヤパワー」（DOYA_POWER_ROLLOUT）', severity: 'action', threshold: 1,
      hints: ['意図しない変更なら Vercel の環境変数を戻して再デプロイする'],
      run: async () => {
        const raw = (process.env.DOYA_POWER_ROLLOUT ?? '').trim()
        const value = doyaPowerRollout()
        if (raw && raw.toLowerCase() !== value) return ng(`知らない値 "${raw}" のため off として扱われています`, { observed: value })
        return ok(value, { observed: value })
      },
    },
  ]
}

/** 有料の API を使わない確認のすべて（10分ごと）。 */
export function freeChecks(): CheckDef[] {
  return [...pageChecks(), ...apiChecks(), ...dbChecks(), ...cronChecks(), ...externalChecks(), ...configChecks()]
}
