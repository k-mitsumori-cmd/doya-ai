export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/mensetsu/templates — テンプレート一覧
// POST /api/mensetsu/templates — 質問セット＋ルーブリックを生成して保存（F3-4）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertFreeLimit, FREE_LIMITS } from '@/lib/plan-limit'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'
import { generateTemplate } from '@/lib/mensetsu/template'
import type { MensetsuLevel } from '@/lib/mensetsu/types'

const LEVELS: MensetsuLevel[] = ['newgrad', 'mid', 'manager']
const PENDING_STATUS = 'generating'
const STALE_RESERVATION_MS = 10 * 60 * 1000

async function releaseReservation(id: string) {
  try {
    await prisma.mensetsuTemplate.deleteMany({ where: { id, status: PENDING_STATUS } })
  } catch {
    console.error('[mensetsu/templates] reservation cleanup failed')
  }
}

export async function GET(req: NextRequest) {
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const templates = await prisma.mensetsuTemplate.findMany({
    where: { organizationId: ctx.organizationId, status: { not: PENDING_STATUS } },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { questions: true, criteria: true, sessions: true } },
      // ⚠️ 一覧でも質問と評価軸の中身を返す。件数だけだと「編集」を開かないと
      //    何を聞く面接なのか分からず、送る前に内容を確かめられなかった。
      //    本文は長いので、一覧では text と評価軸名だけに絞って返す。
      questions: { orderBy: { ord: 'asc' }, select: { id: true, ord: true, text: true, targetMin: true } },
      criteria: { orderBy: { ord: 'asc' }, select: { id: true, name: true } },
    },
  })
  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  try {
    await prisma.mensetsuTemplate.deleteMany({
      where: { organizationId: ctx.organizationId, status: PENDING_STATUS, createdAt: { lt: new Date(Date.now() - STALE_RESERVATION_MS) } },
    })
  } catch {
    console.error('[mensetsu/templates] stale reservation cleanup failed')
    return NextResponse.json({ error: '質問セットの生成状況を確認できませんでした。再試行してください。' }, { status: 503 })
  }

  const processingMessage = 'この組織では質問セットを生成中です。完了を待ってからもう一度お試しください。'
  if (await prisma.mensetsuTemplate.findFirst({ where: { organizationId: ctx.organizationId, status: PENDING_STATUS }, select: { id: true } })) {
    return NextResponse.json({ error: processingMessage, code: 'GENERATION_IN_PROGRESS' }, { status: 409 })
  }

  // 無料枠の上限（services.ts の宣言を実際に効かせる）。AI呼び出し前に確認する。
  const checkQuota = () => assertFreeLimit('mensetsuTemplates', () =>
    prisma.mensetsuTemplate.count({ where: { organizationId: ctx.organizationId } })
  )
  const quotaResponse = (checked: Awaited<ReturnType<typeof checkQuota>>) => NextResponse.json({
    error: checked.reason,
    code: 'LIMIT_REACHED',
    used: checked.used,
    limit: checked.limit,
    ...(checked.limit === FREE_LIMITS.mensetsuTemplates ? { upgradeUrl: '/mensetsu/pricing' } : {}),
  }, { status: 402 })
  const quota = await checkQuota()
  if (!quota.ok) return quotaResponse(quota)

  const body = await req.json().catch(() => ({}))
  const profileId = String(body?.profileId || '').trim()
  const jobTitle = String(body?.jobTitle || '').trim()
  const level = (LEVELS.includes(body?.level) ? body.level : 'mid') as MensetsuLevel
  // ⚠️ 既定は10分。20分は受ける側の負担が大きく、最後まで持たないという声を受けて短くした（2026-08-31）
  // ⚠️ 面接は10分固定（2026-08-31）。何を渡されても10分にする
  const durationMin = 10
  const focus = String(body?.focus || '').trim() || undefined

  if (!jobTitle) return NextResponse.json({ error: '職種を入力してください' }, { status: 400 })

  // 他組織のプロフィールを参照させない（二重条件）
  const profile = profileId
    ? await prisma.mensetsuCompanyProfile.findFirst({
        where: { id: profileId, organizationId: ctx.organizationId },
      })
    : null
  if (profileId && !profile) {
    return NextResponse.json({ error: '企業プロフィールが見つかりません' }, { status: 404 })
  }

  let admission: { kind: 'reserved'; id: string } | { kind: 'processing' } | { kind: 'limit' } | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      admission = await prisma.$transaction(async (tx) => {
        const pending = await tx.mensetsuTemplate.findFirst({
          where: { organizationId: ctx.organizationId, status: PENDING_STATUS }, select: { id: true },
        })
        if (pending) return { kind: 'processing' } as const
        if (quota.limit !== undefined) {
          const used = await tx.mensetsuTemplate.count({ where: { organizationId: ctx.organizationId } })
          if (used >= quota.limit) return { kind: 'limit' } as const
        }
        const reserved = await tx.mensetsuTemplate.create({
          data: {
            organizationId: ctx.organizationId,
            profileId: profile?.id || null,
            name: jobTitle,
            jobTitle,
            level,
            durationMin,
            status: PENDING_STATUS,
          },
          select: { id: true },
        })
        return { kind: 'reserved', id: reserved.id } as const
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
      break
    } catch (error: any) {
      if (error?.code === 'P2034' && attempt < 4) continue
      console.error('[mensetsu/templates] reservation failed', error?.code || 'unknown')
      return NextResponse.json({ error: '質問セットの生成を開始できませんでした。再試行してください。' }, { status: 503 })
    }
  }
  if (admission?.kind === 'processing') return NextResponse.json({ error: processingMessage, code: 'GENERATION_IN_PROGRESS' }, { status: 409 })
  if (admission?.kind === 'limit') {
    const latestQuota = await checkQuota()
    if (latestQuota.ok) return NextResponse.json({ error: 'プラン情報が更新されました。再読み込みしてからもう一度お試しください。' }, { status: 409 })
    return quotaResponse(latestQuota)
  }
  if (!admission) return NextResponse.json({ error: '質問セットの生成を開始できませんでした。再試行してください。' }, { status: 503 })
  const templateId = admission.id

  try {
    const { template, removed } = await generateTemplate({
      profile: {
        companyName: profile?.companyName || undefined,
        business: profile?.business || undefined,
        valueProp: profile?.valueProp || undefined,
        culture: profile?.culture || undefined,
        idealProfile: profile?.idealProfile || undefined,
      },
      jobTitle,
      level,
      durationMin,
      focus,
    })

    if (template.questions.length === 0) {
      await releaseReservation(templateId)
      return NextResponse.json(
        { error: '有効な質問を生成できませんでした。職種や見たい点を具体的にして再実行してください。' },
        { status: 502 }
      )
    }

    const created = await prisma.mensetsuTemplate.update({
      where: { id: templateId },
      data: {
        intro: template.intro || null,
        closing: template.closing || null,
        status: 'draft',
        criteria: {
          create: template.criteria.map((c, i) => ({
            key: c.key,
            name: c.name,
            description: c.description || null,
            rubric: c.rubric as any,
            weight: c.weight,
            ord: i,
          })),
        },
        questions: {
          create: template.questions.map((q, i) => ({
            ord: i,
            text: q.text,
            followUpHint: q.followUpHint || null,
            targetMin: q.targetMin,
            criterionKeys: q.criterionKeys,
            branches: {
              create: (q.branches || []).map((b, bi) => ({
                ord: bi,
                label: b.label,
                matchHint: b.matchHint,
                text: b.text || null,
                // 生成側は1始まりで返す。内部は0始まりのordに揃える
                skipToOrd:
                  b.skipTo && Number.isFinite(Number(b.skipTo)) ? Math.max(0, Number(b.skipTo) - 1) : null,
              })),
            },
          })),
        },
      },
      include: {
        questions: { orderBy: { ord: 'asc' }, include: { branches: { orderBy: { ord: 'asc' } } } },
        criteria: { orderBy: { ord: 'asc' } },
      },
    })

    return NextResponse.json({
      template: created,
      // ガードレールで除去した質問は隠さず返す（担当者が把握できるように）
      removedByGuardrail: removed,
    })
  } catch (e: any) {
    console.error('[mensetsu/templates] generation failed', e?.code || 'unknown')
    await releaseReservation(templateId)
    return NextResponse.json({ error: '質問セットの生成または保存に失敗しました。時間をおいて再試行してください。' }, { status: 502 })
  }
}
