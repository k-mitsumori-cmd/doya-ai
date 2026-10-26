export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShodanContext, orgSlugFrom } from '@/lib/shodan/access'
import { researchCompany, researchFailureMessage } from '@/lib/shodan/research'
import { isCompanyResearch } from '@/lib/shodan/research-response'
import { effectivePrepStatus, PREP_STALE_MS, SHODAN_MONTHLY_LIMIT } from '@/lib/shodan/types'
import { jstStartOfMonthUtc } from '@/lib/plan-limit'
import { getShodanBilling } from '@/lib/shodan/billing'
import { isPaidPlan } from '@/lib/unified-plan'

// ⚠️ 上限の正本は lib/shodan/types.ts。ここに数字を書かない
//    （サイドバーの表示も同じ定義を読む）

function normalizeUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  let s = input.trim()
  if (!s || s.length > 8192) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return null
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.username || u.password || u.href.length > 8192) return null
    return u.toString()
  } catch {
    return null
  }
}

// GET /api/shodan/preparations — 一覧（成果物本文は含めず軽量に）
export async function GET(req: NextRequest) {
  try { return await listPreparations(req) }
  catch {
    console.error('[shodan/preparations/list] unavailable')
    return NextResponse.json({ error: '商談準備一覧を読み込めませんでした。時間をおいて再度お試しください。' }, { status: 503, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  }
}
async function listPreparations(req: NextRequest) {
  const ctx = await getShodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  const { searchParams } = new URL(req.url)
  const select = { id: true, targetUrl: true, targetName: true, status: true, createdAt: true, updatedAt: true } as const
  const where = { organizationId: ctx.organizationId, status: { not: 'deleted' } }
  const watch = searchParams.get('watch')
  if (searchParams.has('watch')) {
    const ids = watch?.split(',') || []
    if (!ids.length || ids.length > 100 || ids.some((id) => !id || id.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(id))) {
      return NextResponse.json({ error: '更新対象が正しくありません' }, { status: 400, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
    }
    const rows = await prisma.shodanPreparation.findMany({ where: { ...where, id: { in: ids } }, select })
    const items = rows.map((row) => ({ ...row, status: effectivePrepStatus(row.status, row.updatedAt) }))
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  }
  const cursor = searchParams.get('cursor')
  if (searchParams.has('cursor') && (!cursor || cursor.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  }
  if (cursor && !await prisma.shodanPreparation.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  }
  const [rows, total] = await Promise.all([
    prisma.shodanPreparation.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select,
      take: 101,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.shodanPreparation.count({ where }),
  ])
  const items = rows.slice(0, 100).map((row) => ({ ...row, status: effectivePrepStatus(row.status, row.updatedAt) }))
  return NextResponse.json({
    items,
    total,
    nextCursor: rows.length > 100 ? items[items.length - 1].id : null,
  }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
}

// POST /api/shodan/preparations — URLを起点に「リサーチ→分析→提案」を一括実行
export async function POST(req: NextRequest) {
  const ctx = await getShodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const targetUrl = normalizeUrl(body?.url)
  if (!targetUrl) return NextResponse.json({ error: '有効なURLを入力してください' }, { status: 400 })
  // 会社名（任意）。サイトが読めないときに、会社名で調べ直すために使う（FAILURE-CHECKLIST.md S21）
  if (body?.companyName != null && (typeof body.companyName !== 'string' || body.companyName.length > 100)) {
    return NextResponse.json({ error: '会社名は100文字以内で入力してください' }, { status: 400 })
  }
  const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() || undefined : undefined
  // 記録の名前の先頭の印。システム点検の自動の確認（経営ホームのエージェント経由）のときだけ、この値ちょうどが届く。
  // 本人の物と見分けるための印なので、ほかの値は受け付けない（値は src/lib/system-watch/marker.ts の SYSTEM_WATCH_PREFIX と同じ）
  const labelPrefix = body?.labelPrefix === '【自動点検】' ? '【自動点検】' : ''

  // プラン制限（組織単位・月次）
  // ⚠️ 有料プランにも上限を置く。1件ごとにサイト巡回とAI呼び出しの実費が出るため、
  //    無制限にすると月額を上回る使われ方を止められない。
  const sc = ctx
  let reservation: Awaited<ReturnType<typeof reserve>>
  try { reservation = await reserve() }
  catch {
    console.error('[shodan/preparations] reservation failed')
    return NextResponse.json({ error: '商談準備を開始できませんでした。時間をおいて再度お試しください。', code: 'UNAVAILABLE' }, { status: 503 })
  }
  async function reserve() { return await prisma.$transaction(async (tx) => {
    // 組織ごとに予約を直列化する。件数確認と作成を分けると同時POSTで上限を超える。
    const organizations = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM shodan_organizations WHERE id = ${sc.organizationId} FOR NO KEY UPDATE
    `
    if (!organizations.length) return { kind: 'missing' } as const
    const billing = await getShodanBilling(tx, sc.organizationId)
    if (!billing) return { kind: 'billing' } as const
    const limit = isPaidPlan(billing.plan)
      ? billing.plan.toUpperCase() === 'ENTERPRISE'
        ? SHODAN_MONTHLY_LIMIT.ENTERPRISE
        : SHODAN_MONTHLY_LIMIT.PRO
      : SHODAN_MONTHLY_LIMIT.FREE
    // ⚠️ 月の区切りは JST。サーバのローカル時刻（Vercelでは UTC）で数えると、
    //    毎月1日の 0:00〜9:00 JST に実行したぶんが前月に計上され、
    //    サイドバーの表示（JST基準）と食い違う。
    const since = jstStartOfMonthUtc()
    // done（成功）＋ 実行中(processing で stale でないもの) を数える。
    // - 同時POSTでも作成直後から枠を占有し抜け道を塞ぐ
    // - failed は非消費／タイムアウトで詰まった stale processing も除外（GETされず放置されても無料枠を恒久消費しない）
    const staleBefore = new Date(Date.now() - PREP_STALE_MS)
    const usedThisMonth = await tx.shodanPreparation.count({
      where: {
        organizationId: sc.organizationId,
        createdAt: { gte: since },
        OR: [
          { status: 'done' },
          { status: 'researched' },
          { status: 'deleted' },
          { status: 'processing', updatedAt: { gte: staleBefore } },
        ],
      },
    })
    if (usedThisMonth >= limit) {
      return { kind: 'limit', limit, billing } as const
    }
    const prep = await tx.shodanPreparation.create({
      data: { organizationId: sc.organizationId, createdByMemberId: sc.memberId, targetUrl: targetUrl as string, status: 'processing' },
    })
    return { kind: 'created', prep } as const
  }) }

  if (reservation.kind === 'missing') {
    return NextResponse.json({ error: '組織が見つかりません' }, { status: 404 })
  }
  if (reservation.kind === 'billing') {
    return NextResponse.json({ error: '組織の契約情報を確認できませんでした。時間をおいて再度お試しください。' }, { status: 503 })
  }
  if (reservation.kind === 'limit') {
    // ⚠️ 既に支払っている方に「プロにご登録を」と返さないこと
    const paid = isPaidPlan(reservation.billing.plan)
    const canManageBilling = ctx.role === 'owner' && ctx.userId === reservation.billing.ownerUserId
    const reason = !canManageBilling
      ? `この組織の今月の上限（${reservation.limit}件）に達しました。利用枠について組織オーナーにご相談ください。`
      : paid
        ? `今月の上限（${reservation.limit}件）に達しました。来月1日に枠が戻ります。追加をご希望の場合はお問い合わせよりご相談ください。`
        : `無料プランは月${reservation.limit}件までです。プロプランにご登録いただくと上限が広がります。`
    return NextResponse.json({
      error: reason,
      code: 'LIMIT',
      canManageBilling,
      ...(canManageBilling ? paid
        ? { contactUrl: 'https://doyamarke.surisuta.jp/contact' }
        : { upgradeUrl: `/shodan/pricing?org=${encodeURIComponent(ctx.organizationSlug)}` } : {}),
    }, { status: 402 })
  }

  // 外部調査は組織ロックを解放してから実行する。
  const prep = reservation.prep
  let stage: 'research' | 'save' = 'research'
  let noFacts: Awaited<ReturnType<typeof researchCompany>> | null = null

  try {
    // フェーズ1: 深掘りリサーチのみ（提案生成は /[id]/generate で実行）。
    // リサーチ結果を即返すことで、画面に「実際に調べた内容」を表示できる。
    stage = 'research'
    const research = await researchCompany(targetUrl, { companyName })
    // 不正な調査結果を保存すると、成功表示と月次枠の両方が誤って確定する。
    if (!isCompanyResearch(research)) throw new Error('invalid company research response')
    // 企業情報を一切取得できなかった調査は成功扱いにせず、月次枠を消費しない。
    // 何が原因で、どうすればよいか（会社名で調べ直す など）を、診断から具体的に返す。
    // ⚠️ 枠を減らさない失敗は、サイトを読めなかったとき（AI を呼んでいない）だけ。サイトが読めて AI を呼んだのに
    //    何も分からなかったときは、今までどおり成功として保存し枠を数える（失敗を繰り返して AI を無料で呼べないように）
    if (research.sourceStatus?.homepage === 'failed' && !research.companyName && !research.description) {
      noFacts = research
      throw new Error('company research yielded no usable facts')
    }
    stage = 'save'
    await prisma.shodanPreparation.update({
      where: { id: prep.id },
      data: { research: research as any, targetName: research.companyName ? `${labelPrefix}${research.companyName}`.slice(0, 200) : labelPrefix || null, status: 'researched' },
    })
    return NextResponse.json({ id: prep.id, status: 'researched', research })
  } catch (e) {
    // 原因を後で追えるよう、例外の名前とコード（Prisma の P2xxx・Postgres の 22P05 など）と段階を残す。URL や本文は残さない
    const err = e as { name?: string; code?: string; meta?: { code?: string } }
    console.error('[shodan/preparations] research failed', { stage, name: err?.name, code: err?.code ?? err?.meta?.code, reason: noFacts?.diagnostics?.homepage && !noFacts.diagnostics.homepage.ok ? noFacts.diagnostics.homepage.reason : undefined })
    const message = noFacts
      ? researchFailureMessage(noFacts.diagnostics)
      : stage === 'save'
        ? '調査の結果を保存できませんでした。時間をおいてやり直してください。今月の利用枠は減っていません。'
        : '企業調査に失敗しました。URLを確認して、もう一度お試しください。今月の利用枠は減っていません。'
    await prisma.shodanPreparation.update({
      where: { id: prep.id },
      data: { status: 'failed', errorMessage: message.slice(0, 500) },
    }).catch(() => {})
    // 調査の失敗は「結果が確定した失敗」。failed は月次枠に数えない（上の usedThisMonth を参照）ので、
    // 枠は消費されず、そのままやり直せる。5xx にすると画面が「結果不明」とみなして止まるため 422 で返す。
    const d = noFacts?.diagnostics
    const reason = d ? (d.homepage.ok ? (d.jsRendered ? 'js_rendered' : 'no_facts') : d.homepage.reason) : stage === 'save' ? 'save' : 'unknown'
    return NextResponse.json({ id: prep.id, status: 'failed', code: 'RESEARCH_FAILED', reason, retryable: true, error: message }, { status: 422 })
  }
}
