export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/adimage/concepts/[id]/feedback — 実画像を見て採点し、構造化された改善指示を作る
// ⚠️ 前身 /adbanner はプロンプト文字列だけを見て採点していた（画像を見ていなかった）。
//    ここでは必ず生成済みの画像そのものを渡す。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getIdentity, ownerWhere } from '@/lib/adimage/access'
import { evaluateCreative, REFINE_CHIPS } from '@/lib/adimage/feedback'
import { downloadBuffer } from '@/lib/adimage/storage'
import { findPlacement } from '@/lib/adimage/placements'
import type { AdCopy } from '@/lib/adimage/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const identity = await getIdentity(req)
  const where = ownerWhere(identity)
  if (!where) return NextResponse.json({ error: '利用者を識別できませんでした' }, { status: 400 })

  const concept = await prisma.adImageConcept.findFirst({
    where: { id: p.id, campaign: where },
    include: {
      creatives: { orderBy: { createdAt: 'asc' } },
      campaign: { select: { brand: { select: { name: true } } } },
    },
  })
  if (!concept) return NextResponse.json({ error: 'コンセプトが見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))

  // 採点対象。指定が無ければ最初のクリエイティブを見る
  const target = body?.creativeId
    ? concept.creatives.find((c) => c.id === String(body.creativeId))
    : concept.creatives[0]
  if (!target) return NextResponse.json({ error: '対象の画像がありません' }, { status: 404 })

  const buf = await downloadBuffer(target.imagePath)
  if (!buf) return NextResponse.json({ error: '画像を読み込めませんでした' }, { status: 502 })

  // ユーザーが押したチップを要望として渡す
  const chipKeys: string[] = Array.isArray(body?.chips) ? body.chips.map((c: unknown) => String(c)) : []
  const userRequests = REFINE_CHIPS.filter((c) => chipKeys.includes(c.key)).map((c) => c.request)
  if (typeof body?.note === 'string' && body.note.trim()) {
    userRequests.push(body.note.trim().slice(0, 500))
  }

  try {
    const result = await evaluateCreative({
      pngBase64: buf.toString('base64'),
      copy: concept.copy as unknown as AdCopy,
      brandName: concept.campaign.brand.name,
      placementName: findPlacement(target.placementKey)?.name ?? target.placementKey,
      userRequests,
    })

    const feedback = await prisma.adImageFeedback.create({
      data: {
        conceptId: concept.id,
        creativeId: target.id,
        source: userRequests.length > 0 ? 'user_chip' : 'ai_vision',
        scores: result.scores as any,
        advice: result.advice,
        // ⚠️ 構造化して保存する。文字列連結だと何を指示したか後から追えない
        directive: result.directives as any,
      },
      select: { id: true },
    })

    return NextResponse.json({
      feedbackId: feedback.id,
      scores: result.scores,
      advice: result.advice,
      directives: result.directives,
    })
  } catch (err) {
    console.error('[adimage] feedback failed', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: '採点に失敗しました。時間をおいて再度お試しください。' }, { status: 502 })
  }
}
