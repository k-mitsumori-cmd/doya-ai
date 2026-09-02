export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET    /api/mensetsu/templates/[id] — テンプレート取得
// PATCH  /api/mensetsu/templates/[id] — 質問・評価軸の編集（F3-5）
// DELETE /api/mensetsu/templates/[id] — 質問セットの削除
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
      questions: { orderBy: { ord: 'asc' }, include: { branches: { orderBy: { ord: 'asc' } } } },
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
    // ⚠️ 幹だけでなく枝の質問も検査する。分岐で尋ねる内容も面接での質問であり、
    //    ここを見逃すと差別的な質問が枝から入り込む。
    const texts: string[] = []
    for (const q of body.questions) {
      texts.push(String(q?.text || ''))
      for (const b of Array.isArray(q?.branches) ? q.branches : []) {
        if (b?.text) texts.push(String(b.text))
      }
    }
    const violations = findViolations(texts)
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

  // ⚠️ 検査は書き込みより前に済ませる。
  //    以前は基本情報を先に update してから 409 を返していたため、
  //    UIが「保存に失敗」と出しているのに durationMin や status だけ変わって残った。
  if (Array.isArray(body?.questions)) {
    const liveCount = await prisma.mensetsuSession.count({
      where: { templateId: id, status: { in: ['live', 'consented'] } },
    })
    if (liveCount > 0) {
      return NextResponse.json(
        {
          error: `実施中・準備中の面接が${liveCount}件あるため、質問を変更できません。終了後にお試しください。`,
          liveCount,
        },
        { status: 409 }
      )
    }
    // 想定時間は Postgres の integer 列に入る。極端な値を弾かないと
    // deleteMany 済みの状態で createMany が落ち、質問が全消失する。
    const bad = body.questions.find((q: any) => {
      const n = Number(q?.targetMin)
      return q?.targetMin != null && (!Number.isFinite(n) || n < 1 || n > 600)
    })
    if (bad) {
      return NextResponse.json(
        { error: '想定時間は1〜600分の範囲で入力してください' },
        { status: 400 }
      )
    }
  }

  const data: any = {}
  if (typeof body?.name === 'string') data.name = body.name.trim()
  if (typeof body?.jobTitle === 'string') data.jobTitle = body.jobTitle.trim()
  // ⚠️ 面接は10分固定。20分・30分は受ける側が最後まで持たないため受け付けない。
  //    画面から消しても、APIが受けたままだと古いクライアントや直叩きで戻ってしまう。
  if (Number(body?.durationMin) === 10) data.durationMin = 10
  if (typeof body?.intro === 'string') data.intro = body.intro
  if (typeof body?.closing === 'string') data.closing = body.closing
  if (['draft', 'active', 'archived'].includes(body?.status)) data.status = body.status

  await prisma.mensetsuTemplate.update({ where: { id }, data })

  // 質問の全置換（順序の入れ替え・削除を素直に扱うため）
  if (Array.isArray(body?.questions)) {
    // 削除と再作成は必ず1つのトランザクションで。
    // 分けると createMany の失敗時に質問が0件のまま残り、復元手段が無い。
    await prisma.$transaction([
      prisma.mensetsuQuestion.deleteMany({ where: { templateId: id } }),
      // ⚠️ createMany では入れ子を作れないため、分岐を持つ質問は個別に create する。
      //    一括で置き換えると、AIが作った分岐が保存のたびに消えてしまう。
      ...body.questions.map((q: any, i: number) =>
        prisma.mensetsuQuestion.create({
          data: {
            templateId: id,
            ord: i,
            text: String(q?.text || ''),
            followUpHint: q?.followUpHint ? String(q.followUpHint) : null,
            targetMin: Number.isFinite(Number(q?.targetMin))
              ? Math.min(600, Math.max(1, Math.round(Number(q.targetMin))))
              : 3,
            criterionKeys: Array.isArray(q?.criterionKeys) ? q.criterionKeys.map(String) : [],
            branches: {
              create: (Array.isArray(q?.branches) ? q.branches : [])
                // 名前と条件が揃っていない枝は保存しない。
                // 条件が空だと分類器が判断できず、枝に入らないか誤って入るため。
                .filter((b: any) => b && String(b.label || '').trim() && String(b.matchHint || '').trim())
                .map((b: any, bi: number) => ({
                  ord: bi,
                  label: String(b.label),
                  matchHint: String(b.matchHint),
                  text: b.text ? String(b.text) : null,
                  skipToOrd: Number.isFinite(Number(b.skipToOrd)) ? Number(b.skipToOrd) : null,
                })),
            },
          },
        })
      ),
    ])
  }

  const template = await prisma.mensetsuTemplate.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { ord: 'asc' }, include: { branches: { orderBy: { ord: 'asc' } } } },
      criteria: { orderBy: { ord: 'asc' } },
    },
  })
  return NextResponse.json({ template })
}

/**
 * 質問セットを削除する。
 * ⚠️ **道連れが大きい。** onDelete: Cascade により、質問・評価軸だけでなく
 *    この質問セットで実施した**面接の記録（逐語ログ・評価）まで消える**。
 *    復旧手段は無いので、管理者以上に限り、件数を返して画面で必ず確認させる。
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id } = await paramsOf(ctx)
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'admin')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  // ⚠️ id だけで引かない。必ず所有者条件と併用する（他組織のものを消させない）
  const t = await prisma.mensetsuTemplate.findFirst({
    where: { id, organizationId: c.organizationId },
    select: { id: true, _count: { select: { sessions: true } } },
  })
  if (!t) return NextResponse.json({ error: '質問セットが見つかりません' }, { status: 404 })

  await prisma.mensetsuTemplate.delete({ where: { id: t.id } })
  return NextResponse.json({ ok: true, deletedSessions: t._count.sessions })
}
