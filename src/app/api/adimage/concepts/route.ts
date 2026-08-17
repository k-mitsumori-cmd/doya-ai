export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET  /api/adimage/concepts — 生成済みコンセプト一覧
// POST /api/adimage/concepts — コピーを確定して広告画像セットを生成（中核）
//
// 処理の流れ:
//   生成サイズ単位でグルーピング（同じ生成サイズの配置は1回の生成を使い回す）
//     → 各生成サイズでテキスト込みの一枚絵を生成 → 自動検査 → 不合格なら再生成
//     → 各配置の目標サイズへ純粋な縮小のみで書き出し
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertQuota, ensureGuestId, getIdentity, GUEST_COOKIE, ownerWhere, requireUser } from '@/lib/adimage/access'
import { recordServiceUsage } from '@/lib/service-usage'
import { DEFAULT_PLACEMENT_KEYS, findPlacement, groupByGenSize } from '@/lib/adimage/placements'
import { exportToSize, generateBaked } from '@/lib/adimage/generate'
import { DEFAULT_LOGO_CONFIG, type LogoConfig } from '@/lib/adimage/logo'
import { normalizeCopy } from '@/lib/adimage/copy'
import { downloadBuffer, signedUrl } from '@/lib/adimage/storage'
import type { AdCopy, BrandProfile } from '@/lib/adimage/types'

export async function GET(req: NextRequest) {
  const identity = await getIdentity(req)
  // ⚠️ ログイン必須。未ログインは識別子が無く、以降のスコープ条件が成立しない
  const auth = requireUser(identity)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })
  const where = ownerWhere(identity)
  if (!where) return NextResponse.json({ concepts: [] })

  const concepts = await prisma.adImageConcept.findMany({
    where: { campaign: where },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      creatives: { select: { id: true, placementKey: true, size: true, imagePath: true, verify: true } },
      campaign: { select: { id: true, name: true, brand: { select: { name: true } } } },
    },
  })

  // 署名URLは都度発行する（保存しない）
  const withUrls = await Promise.all(
    concepts.map(async (c) => ({
      id: c.id,
      label: c.label,
      copy: c.copy,
      generation: c.generation,
      createdAt: c.createdAt,
      campaignName: c.campaign.name,
      brandName: c.campaign.brand.name,
      creatives: await Promise.all(
        c.creatives.map(async (cr) => ({
          id: cr.id,
          placementKey: cr.placementKey,
          placementName: findPlacement(cr.placementKey)?.name ?? cr.placementKey,
          media: findPlacement(cr.placementKey)?.media ?? '',
          size: cr.size,
          verify: cr.verify,
          url: await signedUrl(cr.imagePath),
        }))
      ),
    }))
  )

  return NextResponse.json({ concepts: withUrls })
}

export async function POST(req: NextRequest) {
  const base = await getIdentity(req)
  // ⚠️ ログイン必須。未ログインは識別子が無く、以降のスコープ条件が成立しない
  const auth = requireUser(base)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })
  const { identity, newGuestId } = ensureGuestId(base)
  const where = ownerWhere(identity)
  if (!where) return NextResponse.json({ error: '利用者を識別できませんでした' }, { status: 400 })

  const quota = await assertQuota(identity)
  if (!quota.ok) return NextResponse.json({ error: quota.reason }, { status: 429 })

  const body = await req.json().catch(() => ({}))
  const brandId = String(body?.brandId || '')
  if (!brandId) return NextResponse.json({ error: 'ブランドを指定してください' }, { status: 400 })

  // ⚠️ id だけで引かない。必ず所有者条件と併用する
  const brandRow = await prisma.adImageBrand.findFirst({ where: { id: brandId, ...where } })
  if (!brandRow) return NextResponse.json({ error: 'ブランドが見つかりません' }, { status: 404 })

  const copy: AdCopy = normalizeCopy({
    headline: String(body?.copy?.headline || ''),
    sub: String(body?.copy?.sub || ''),
    cta: String(body?.copy?.cta || ''),
  })
  if (!copy.headline || !copy.cta) {
    return NextResponse.json({ error: '大見出しとCTAは必須です' }, { status: 400 })
  }

  const requested: string[] = Array.isArray(body?.placements) && body.placements.length > 0
    ? body.placements.map((k: unknown) => String(k))
    : DEFAULT_PLACEMENT_KEYS
  // 実在する配置だけに絞る。⚠️ 生成回数が費用に直結するので上限も設ける
  const placementKeys = requested.filter((k) => findPlacement(k)).slice(0, 13)
  if (placementKeys.length === 0) {
    return NextResponse.json({ error: '配置を選択してください' }, { status: 400 })
  }

  const brand: BrandProfile = {
    name: brandRow.name,
    description: brandRow.description ?? undefined,
    valueProps: (brandRow.valueProps as string[] | null) ?? [],
    colors: (brandRow.colors as string[] | null) ?? ['#0066ff'],
    industry: brandRow.industry ?? undefined,
    tone: brandRow.tone ?? undefined,
  }
  const tone = String(body?.tone || brand.tone || '明るく信頼感がありモダン').slice(0, 120)

  const campaign = await prisma.adImageCampaign.create({
    data: {
      brandId: brandRow.id,
      ...where,
      name: String(body?.campaignName || `${brand.name} 広告`).slice(0, 200),
      objective: body?.objective ? String(body.objective).slice(0, 100) : null,
      appeal: body?.appeal ? String(body.appeal).slice(0, 1000) : null,
      placements: placementKeys as any,
    },
    select: { id: true },
  })

  // ロゴ（登録されていれば書き出し時に合成する）
  // ⚠️ 読み込みに失敗しても生成は続ける。ロゴが入らないことより画像が出ない方が困る。
  const logoBuf = brandRow.logoPath ? await downloadBuffer(brandRow.logoPath).catch(() => null) : null
  const logo = logoBuf
    ? { buffer: logoBuf, config: ((brandRow.logoConfig as LogoConfig | null) ?? DEFAULT_LOGO_CONFIG) }
    : null

  const groups = groupByGenSize(placementKeys)
  const pathPrefix = `${identity.userId || identity.guestId}/${campaign.id}`

  const genPaths: Record<string, string> = {}
  let visualPrompt = ''
  let model = ''
  /** 生成できなかった配置。⚠️ 黙って短い結果を返すと、利用者は入稿時まで欠落に気づけない */
  const failedPlacements: string[] = []
  const creativeRows: Array<{
    placementKey: string; size: string; genSize: string; compositionKey: string
    imagePath: string; verify: any
  }> = []

  // ⚠️ グループ単位で捕まえる。1つのサイズが失敗しても残りは作り切り、
  //    どの配置が作れなかったかを必ず利用者へ返す（黙って短い結果を返さない）。
  for (const group of groups) {
    try {

        // 生成サイズを代表する配置でプロンプトを組む
        const rep = group.placements[0]
        const result = await generateBaked({
          brand,
          copy,
          tone,
          placement: rep,
          composition: group.composition,
          pathPrefix,
        })
        genPaths[group.genKey] = result.genPath
        if (!visualPrompt) {
          visualPrompt = result.prompt
          model = result.model
        }

        // 同じ生成サイズを共有する配置は、同じ原本から書き出す
        for (const p of group.placements) {
          const { imagePath } = await exportToSize(result.buffer, p, pathPrefix, logo)
          creativeRows.push({
            placementKey: p.key,
            size: `${p.w}x${p.h}`,
            genSize: result.genSize,
            compositionKey: group.composition,
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
    // 1枚も作れなかった。空のキャンペーンを残さない
    await prisma.adImageCampaign.delete({ where: { id: campaign.id } }).catch(() => {})
    return NextResponse.json(
      { error: '画像の生成に失敗しました。時間をおいて再度お試しください。' },
      { status: 502 }
    )
  }

  const concept = await prisma.adImageConcept.create({
    data: {
      campaignId: campaign.id,
      label: String(body?.label || 'コンセプト').slice(0, 120),
      appealAxis: String(body?.appealAxis || 'benefit').slice(0, 40),
      tone,
      copy: copy as any,
      compositionKey: groups[0]?.composition ?? 'hero-center',
      genPaths: genPaths as any,
      visualPrompt,
      model,
      generation: 1,
      creatives: { create: creativeRows },
    },
    include: { creatives: true },
  })

  const creatives = await Promise.all(
    concept.creatives.map(async (cr) => ({
      id: cr.id,
      placementKey: cr.placementKey,
      placementName: findPlacement(cr.placementKey)?.name ?? cr.placementKey,
      media: findPlacement(cr.placementKey)?.media ?? '',
      size: cr.size,
      verify: cr.verify,
      url: await signedUrl(cr.imagePath),
    }))
  )

  // ⚠️ ゲストは userId が無いので記録されない（recordServiceUsage 側で弾かれる）
  void recordServiceUsage({
    userId: identity.userId,
    serviceId: 'adimage',
    action: '広告画像を生成',
    summary: `${brand.name} / ${copy.headline}`,
    count: creatives.length,
  })

  const res = NextResponse.json({
    conceptId: concept.id,
    campaignId: campaign.id,
    copy,
    creatives,
    // 2回リトライしても検査に通らなかったものは「要確認」として明示する。黙って出さない
    needsReview: creatives.some((c) => (c.verify as any)?.needsReview),
    // ⚠️ 作れなかった配置は必ず返す。黙って短い結果を返すと、
    //    利用者は入稿の直前まで欠落に気づけない。
    failedPlacements,
  })
  if (newGuestId) {
    res.cookies.set(GUEST_COOKIE, newGuestId, {
      httpOnly: true, sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: 60 * 60 * 24 * 180,
    })
  }
  return res
}
