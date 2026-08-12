export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/mensetsu/samples — 模範回答ライブラリ（F4-3）
// POST /api/mensetsu/samples — 応募者の回答に「この基準ではOK/NG」とラベルを付ける
//
// ⚠️ ここで貯めた例は、次回以降の採点プロンプトに few-shot として入る
//    （evaluate.ts:「自社の採点例」）。貯まるほど自社の基準に寄っていく。
// ⚠️ ラベル付けは選考基準そのものを形づくる。就職差別につながる観点を
//    基準として登録させないため、評価軸はテンプレートに実在するキーだけを許す。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, hasMinRole, orgSlugFrom } from '@/lib/mensetsu/access'
import { findViolations } from '@/lib/mensetsu/guardrails'

export async function GET(req: NextRequest) {
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const criterionKey = new URL(req.url).searchParams.get('criterionKey') || undefined

  const samples = await prisma.mensetsuAnswerSample.findMany({
    where: { organizationId: ctx.organizationId, ...(criterionKey ? { criterionKey } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ samples })
}

export async function POST(req: NextRequest) {
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  // ⚠️ 採点基準に効くので、担当者（manager以上）に限る
  if (!hasMinRole(ctx.role, 'manager')) {
    return NextResponse.json({ error: 'ラベルを付ける権限がありません' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const criterionKey = String(body?.criterionKey || '').trim()
  const questionText = String(body?.questionText || '').trim()
  const answerText = String(body?.answerText || '').trim()
  const label = body?.label === 'bad' ? 'bad' : 'good'
  const note = body?.note ? String(body.note).slice(0, 1000) : null

  if (!criterionKey || !answerText) {
    return NextResponse.json({ error: '評価軸と回答が必要です' }, { status: 400 })
  }

  // ⚠️ 自組織のテンプレートに実在する評価軸のみ。
  //    任意のキーを許すと、採点例が参照されない死にデータになるうえ、
  //    基準に無い観点を後から紛れ込ませられる。
  const criterion = await prisma.mensetsuCriterion.findFirst({
    where: { key: criterionKey, template: { organizationId: ctx.organizationId } },
    select: { id: true, name: true },
  })
  if (!criterion) {
    return NextResponse.json({ error: '評価軸が見つかりません' }, { status: 404 })
  }

  // ⚠️ 就職差別につながる観点を採点例として蓄積させない。
  //    ここを素通しすると、その後の全ての面接の採点に効いてしまう。
  const violations = findViolations([questionText, answerText, note || ''])
  if (violations.length > 0) {
    return NextResponse.json(
      {
        error: `採点例に使えない内容が含まれています（${Array.from(new Set(violations.map((v) => v.label))).join(' / ')}）。選考に用いてはいけない観点です。`,
      },
      { status: 400 }
    )
  }

  const sample = await prisma.mensetsuAnswerSample.create({
    data: {
      organizationId: ctx.organizationId,
      criterionKey,
      questionText: questionText.slice(0, 2000),
      answerText: answerText.slice(0, 4000),
      label,
      note,
    },
  })
  return NextResponse.json({ sample, criterionName: criterion.name })
}
