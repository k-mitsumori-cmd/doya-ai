export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET   /api/mensetsu/templates/[id] — テンプレート取得
// PATCH /api/mensetsu/templates/[id] — 質問・評価軸の編集（F3-5）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, hasMinRole, orgSlugFrom } from '@/lib/mensetsu/access'
import { findViolations } from '@/lib/mensetsu/guardrails'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function paramsOf(ctx: Ctx) {
  return 'then' in ctx.params ? await ctx.params : ctx.params
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await paramsOf(ctx)
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // id だけでは他組織のテンプレートに到達できないよう二重条件
  const template = await prisma.mensetsuTemplate.findFirst({
    where: { id, organizationId: c.organizationId },
    include: {
      questions: { orderBy: { ord: 'asc' } },
      criteria: { orderBy: { ord: 'asc' } },
      profile: true,
    },
  })
  if (!template) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  return NextResponse.json({ template })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await paramsOf(ctx)
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'manager')) {
    return NextResponse.json({ error: '編集する権限がありません' }, { status: 403 })
  }

  const existing = await prisma.mensetsuTemplate.findFirst({
    where: { id, organizationId: c.organizationId },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))

  // 担当者が手で追加した質問も差別的でないか検査する（生成物だけでなく編集後も守る）
  if (Array.isArray(body?.questions)) {
    const violations = findViolations(body.questions.map((q: any) => String(q?.text || '')))
    if (violations.length > 0) {
      return NextResponse.json(
        {
          error: '就職差別につながる可能性のある質問が含まれています。',
          violations,
        },
        { status: 400 }
      )
    }
  }

  const data: any = {}
  if (typeof body?.name === 'string') data.name = body.name.trim()
  if (typeof body?.jobTitle === 'string') data.jobTitle = body.jobTitle.trim()
  if ([10, 20, 30].includes(Number(body?.durationMin))) data.durationMin = Number(body.durationMin)
  if (typeof body?.intro === 'string') data.intro = body.intro
  if (typeof body?.closing === 'string') data.closing = body.closing
  if (['draft', 'active', 'archived'].includes(body?.status)) data.status = body.status

  await prisma.mensetsuTemplate.update({ where: { id }, data })

  // 質問の全置換（順序の入れ替え・削除を素直に扱うため）
  if (Array.isArray(body?.questions)) {
    await prisma.mensetsuQuestion.deleteMany({ where: { templateId: id } })
    await prisma.mensetsuQuestion.createMany({
      data: body.questions.map((q: any, i: number) => ({
        templateId: id,
        ord: i,
        text: String(q?.text || ''),
        followUpHint: q?.followUpHint ? String(q.followUpHint) : null,
        targetMin: Number.isFinite(Number(q?.targetMin)) ? Number(q.targetMin) : 3,
        criterionKeys: Array.isArray(q?.criterionKeys) ? q.criterionKeys.map(String) : [],
      })),
    })
  }

  const template = await prisma.mensetsuTemplate.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { ord: 'asc' } },
      criteria: { orderBy: { ord: 'asc' } },
    },
  })
  return NextResponse.json({ template })
}
