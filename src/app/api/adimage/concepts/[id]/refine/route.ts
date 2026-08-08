export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/adimage/concepts/[id]/refine — 改善指示を反映して次世代を作る
// ⚠️ 改善指示は文字列連結ではなく、構造化された RefineDirective を
//    プロンプトの「修正指示」セクションへ差分適用する。
//    どの指示が効いたかを世代間で追えるようにするため、適用元のfeedbackに resultId を残す。
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertQuota, getIdentity, ownerWhere } from '@/lib/adimage/access'
import { directivesToPromptLines, REFINE_CHIPS } from '@/lib/adimage/feedback'
import { exportToSize, generateBaked } from '@/lib/adimage/generate'
import { findPlacement, groupByGenSize } from '@/lib/adimage/placements'
import { signedUrl } from '@/lib/adimage/storage'
import type { AdCopy, BrandProfile, RefineDirective } from '@/lib/adimage/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const identity = await getIdentity(req)
  const where = ownerWhere(identity)
  if (!where) return NextResponse.json({ error: '利用者を識別できませんでした' }, { status: 400 })

  const quota = await assertQuota(identity)
  if (!quota.ok) return NextResponse.json({ error: quota.reason }, { status: 429 })

  const concept = await prisma.adImageConcept.findFirst({
    where: { id: p.id, campaign: where },
    include: {
      creatives: true,
      campaign: { include: { brand: true } },
      feedbacks: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  if (!concept) return NextResponse.json({ error: 'コンセプトが見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))

  // 改善指示の出どころ: 直近のフィードバック ＋ 今回押されたチップ
  const stored: RefineDirective[] = Array.isArray(concept.feedbacks[0]?.directive)
    ? (concept.feedbacks[0]!.directive as unknown as RefineDirective[])
    : []
  const chipKeys: string[] = Array.isArray(body?.chips) ? body.chips.map((c: unknown) => String(c)) : []
  const chipDirectives: RefineDirective[] = REFINE_CHIPS.filter((c) => chipKeys.includes(c.key)).map((c) => ({
    target: 'visual',
    instruction: c.request,
    reason: `ユーザーが「${c.label}」を選択`,
  }))
  const note = typeof body?.note === 'string' && body.note.trim()
    ? [{ target: 'visual' as const, instruction: body.note.trim().slice(0, 500), reason: 'ユーザーの自由記述' }]
    : []

  const directives = [...chipDirectives, ...note, ...stored].slice(0, 5)
  if (directives.length === 0) {
    return NextResponse.json({ error: '改善したい点を選択してください' }, { status: 400 })
  }

  const brandRow = concept.campaign.brand
  const brand: BrandProfile = {
    name: brandRow.name,
    description: brandRow.description ?? undefined,
    valueProps: (brandRow.valueProps as string[] | null) ?? [],
    colors: (brandRow.colors as string[] | null) ?? ['#0066ff'],
    industry: brandRow.industry ?? undefined,
    tone: brandRow.tone ?? undefined,
  }
  const copy = concept.copy as unknown as AdCopy

  const placementKeys = concept.creatives.map((c) => c.placementKey)
  const groups = groupByGenSize(placementKeys)
  // ⚠️ 世代番号だけでパスを決めると、同じ親コンセプトから2回改善したときに
  //    パスが衝突し、uploadPng(upsert:true) が**先に作った画像を上書きする**。
  //    先の世代のレコードはそのパスを指したままなので、画像だけが黙って差し替わる。
  //    世代ごとに一意な接尾辞を付けて、過去の世代を不変にする。
  const runId = randomBytes(4).toString('hex')
  const pathPrefix = `${identity.userId || identity.guestId}/${concept.campaignId}/g${concept.generation + 1}_${runId}`
  const extraDirectives = directivesToPromptLines(directives)

  const genPaths: Record<string, string> = {}
  let visualPrompt = ''
  let model = ''
  const creativeRows: Array<{
    placementKey: string; size: string; genSize: string; compositionKey: string; imagePath: string; verify: any
  }> = []

  try {
    for (const group of groups) {
      const rep = group.placements[0]
      const result = await generateBaked({
        brand, copy, tone: concept.tone,
        placement: rep, composition: group.composition,
        extraDirectives, pathPrefix,
      })
      genPaths[group.genKey] = result.genPath
      if (!visualPrompt) {
        visualPrompt = result.prompt
        model = result.model
      }
      for (const pl of group.placements) {
        const { imagePath } = await exportToSize(result.buffer, pl, pathPrefix)
        creativeRows.push({
          placementKey: pl.key,
          size: `${pl.w}x${pl.h}`,
          genSize: result.genSize,
          compositionKey: group.composition,
          imagePath,
          verify: result.verify as any,
        })
      }
    }
  } catch (err) {
    console.error('[adimage] refine failed', err instanceof Error ? err.message : err)
    if (creativeRows.length === 0) {
      return NextResponse.json({ error: '改善版の生成に失敗しました。時間をおいて再度お試しください。' }, { status: 502 })
    }
  }

  const next = await prisma.adImageConcept.create({
    data: {
      campaignId: concept.campaignId,
      label: `${concept.label}（改善${concept.generation}）`,
      appealAxis: concept.appealAxis,
      tone: concept.tone,
      copy: concept.copy as any,
      compositionKey: concept.compositionKey,
      genPaths: genPaths as any,
      visualPrompt,
      model,
      generation: concept.generation + 1,
      parentId: concept.id,
      creatives: { create: creativeRows },
    },
    include: { creatives: true },
  })

  // どの指示から生まれたかを記録する（効果を後から検証するため）
  if (concept.feedbacks[0]) {
    await prisma.adImageFeedback.update({
      where: { id: concept.feedbacks[0].id },
      data: { applied: true, resultId: next.id },
    }).catch(() => {})
  }

  const creatives = await Promise.all(
    next.creatives.map(async (cr) => ({
      id: cr.id,
      placementKey: cr.placementKey,
      placementName: findPlacement(cr.placementKey)?.name ?? cr.placementKey,
      media: findPlacement(cr.placementKey)?.media ?? '',
      size: cr.size,
      verify: cr.verify,
      url: await signedUrl(cr.imagePath),
    }))
  )

  return NextResponse.json({
    conceptId: next.id,
    generation: next.generation,
    appliedDirectives: directives,
    creatives,
    needsReview: creatives.some((c) => (c.verify as any)?.needsReview),
  })
}
