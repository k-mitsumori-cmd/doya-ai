export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/mensetsu/templates — テンプレート一覧
// POST /api/mensetsu/templates — 質問セット＋ルーブリックを生成して保存（F3-4）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertFreeLimit } from '@/lib/plan-limit'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'
import { generateTemplate } from '@/lib/mensetsu/template'
import type { MensetsuLevel } from '@/lib/mensetsu/types'

const LEVELS: MensetsuLevel[] = ['newgrad', 'mid', 'manager']

export async function GET(req: NextRequest) {
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const templates = await prisma.mensetsuTemplate.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { questions: true, criteria: true, sessions: true } },
    },
  })
  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // 無料枠の上限（services.ts の宣言を実際に効かせる）
  const quota = await assertFreeLimit('mensetsuTemplates', () =>
    prisma.mensetsuTemplate.count({ where: { organizationId: ctx.organizationId } })
  )
  if (!quota.ok) return NextResponse.json({ error: quota.reason }, { status: 402 })

  const body = await req.json().catch(() => ({}))
  const profileId = String(body?.profileId || '').trim()
  const jobTitle = String(body?.jobTitle || '').trim()
  const level = (LEVELS.includes(body?.level) ? body.level : 'mid') as MensetsuLevel
  const durationMin = [10, 20, 30].includes(Number(body?.durationMin)) ? Number(body.durationMin) : 20
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
      return NextResponse.json(
        { error: '有効な質問を生成できませんでした。職種や見たい点を具体的にして再実行してください。' },
        { status: 502 }
      )
    }

    const created = await prisma.mensetsuTemplate.create({
      data: {
        organizationId: ctx.organizationId,
        profileId: profile?.id || null,
        name: `${jobTitle}（${durationMin}分）`,
        jobTitle,
        level,
        durationMin,
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
    return NextResponse.json({ error: e?.message || '質問セットの生成に失敗しました' }, { status: 502 })
  }
}
