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
import { assertQuota, getIdentity, ownerWhere, requireUser } from '@/lib/adimage/access'
import { directivesToPromptLines, REFINE_CHIPS } from '@/lib/adimage/feedback'
import { exportToSize, generateBaked } from '@/lib/adimage/generate'
import { DEFAULT_LOGO_CONFIG, type LogoConfig } from '@/lib/adimage/logo'
import { findPlacement, groupByGenSize } from '@/lib/adimage/placements'
import { downloadBuffer, signedUrl } from '@/lib/adimage/storage'
import type { AdCopy, BrandProfile, RefineDirective } from '@/lib/adimage/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const identity = await getIdentity(req)
  // ⚠️ ログイン必須。未ログインは識別子が無く、以降のスコープ条件が成立しない
  const auth = requireUser(identity)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })
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
  // ロゴ（登録されていれば書き出し時に合成する）
  // ⚠️ 読み込みに失敗しても生成は続ける。ロゴが入らないことより画像が出ない方が困る。
  const logoBuf = brandRow.logoPath ? await downloadBuffer(brandRow.logoPath).catch(() => null) : null
  const logo = logoBuf
    ? { buffer: logoBuf, config: ((brandRow.logoConfig as LogoConfig | null) ?? DEFAULT_LOGO_CONFIG) }
    : null

  const groups = groupByGenSize(placementKeys)
  // ⚠️ 世代番号だけでパスを決めると、同じ親コンセプトから2回改善したときに
  //    パスが衝突し、uploadPng(upsert:true) が**先に作った画像を上書きする**。
  //    先の世代のレコードはそのパスを指したままなので、画像だけが黙って差し替わる。
  //    世代ごとに一意な接尾辞を付けて、過去の世代を不変にする。
  const runId = randomBytes(4).toString('hex')
  const pathPrefix = `${identity.userId || identity.guestId}/${concept.campaignId}/g${concept.generation + 1}_${runId}`
  // ⚠️ 「改善」であって「作り直し」ではない。この一言が無いと、
  //    修正指示を口実に構図も配色も総取り替えした別物が返ってくる（2026-09-02）。
  const KEEP_BASE = [
    'これは前回作った画像の**改善**です。作り直しではありません。',
    '前回の構図・配色・写真の使い方・全体の雰囲気は**そのまま保つ**こと。',
    '下の指摘に関係する部分だけを直し、それ以外は変えないこと。',
  ]
  const extraDirectives = [...KEEP_BASE, ...directivesToPromptLines(directives)]

  const genPaths: Record<string, string> = {}
  let visualPrompt = ''
  let model = ''
  /** 生成できなかった配置。⚠️ 黙って短い結果を返すと、利用者は入稿時まで欠落に気づけない */
  const failedPlacements: string[] = []
  const creativeRows: Array<{
    placementKey: string; size: string; genSize: string; compositionKey: string; imagePath: string; verify: any
  }> = []

  // ⚠️ グループ単位で捕まえる。1つのサイズが失敗しても残りは作り切り、
  //    どの配置が作れなかったかを必ず利用者へ返す（黙って短い結果を返さない）。
  for (const group of groups) {
    try {

        const rep = group.placements[0]
        // ⚠️ **元の作風と構図を必ず引き継ぐこと。**
        //    以前は extraDirectives（修正指示の文章）だけを渡し、
        //    構図は配置ごとの既定に戻り、デザイン参考は渡していなかった。
        //    そのため「改善」を押すと元と似ても似つかない絵が出ていた（2026-09-02）。
        const result = await generateBaked({
          brand, copy, tone: concept.tone,
          placement: rep,
          composition: (concept.compositionKey as any) || group.composition,
          designRefPrompt: concept.designRefStyle || undefined,
          extraDirectives, pathPrefix,
        })
        genPaths[group.genKey] = result.genPath
        if (!visualPrompt) {
          visualPrompt = result.prompt
          model = result.model
        }
        for (const pl of group.placements) {
          const { imagePath } = await exportToSize(result.buffer, pl, pathPrefix, logo)
          creativeRows.push({
            placementKey: pl.key,
            size: `${pl.w}x${pl.h}`,
            genSize: result.genSize,
            // ⚠️ 実際に使った構図を記録する。group.composition（サイズ既定）を
            //    書くと、次の改善でまた別の構図に戻ってしまう
            compositionKey: (concept.compositionKey as string) || group.composition,
            imagePath,
            verify: result.verify as any,
          })
        }
    } catch (err) {
      console.error('[adimage] generate failed', group.genKey, err instanceof Error ? err.message : err)
      for (const fp of group.placements) failedPlacements.push(fp.name)
    }
  }

  if (creativeRows.length === 0) {
    return NextResponse.json(
      { error: '改善版の生成に失敗しました。時間をおいて再度お試しください。' },
      { status: 502 }
    )
  }

  const next = await prisma.adImageConcept.create({
    data: {
      campaignId: concept.campaignId,
      label: `${concept.label}（改善${concept.generation}）`,
      appealAxis: concept.appealAxis,
      tone: concept.tone,
      copy: concept.copy as any,
      compositionKey: concept.compositionKey,
      // ⚠️ 次の改善でも失わないよう引き継ぐ
      designRefId: concept.designRefId,
      designRefStyle: concept.designRefStyle,
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

  // ⚠️ 改善前の画像も返す。返さないと画面から元が消えてしまい、
  //    良くなったのか悪くなったのかを判断できない（2026-09-02の指摘）。
  const previousCreatives = await Promise.all(
    (concept.creatives || []).map(async (cr: any) => ({
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
    previousCreatives,
    previousGeneration: concept.generation,
    needsReview: creatives.some((c) => (c.verify as any)?.needsReview),
    failedPlacements,
  })
}
