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
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { assertQuota, ensureGuestId, getIdentity, GUEST_COOKIE, ownerWhere, requireUser } from '@/lib/adimage/access'
import type { CompositionKey } from '@/lib/adimage/placements'
import { recordServiceUsage } from '@/lib/service-usage'
import { DEFAULT_PLACEMENT_KEYS, findPlacement, groupByGenSize } from '@/lib/adimage/placements'
import { extractRefPalette } from '@/lib/adimage/ref-palette'
import { exportToSize, generateBaked } from '@/lib/adimage/generate'
import { DEFAULT_LOGO_CONFIG, type LogoConfig } from '@/lib/adimage/logo'
import { normalizeCopy } from '@/lib/adimage/copy'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
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


/**
 * テンプレートの見た目を、生成に使える形で取り出す。
 *
 * ⚠️ **prompt から取ってはいけない。** テンプレートの prompt はサムネイルを
 *    説明していない。構造化テンプレ150枚の Style は10種類の定型文の使い回しで、
 *    「写真を使っているか」すら実物と合わない。
 *    実例: 女性2人の写真が主役のテンプレに `typography as image`（文字が主役）と
 *    `porcelain stock-model face を避けよ`（人物写真を避けよ）が入っていた。
 *    これを渡していたため、写真が消えて巨大な文字だけの絵になっていた（2026-09-02）。
 *
 * → scripts/analyze-banner-templates.ts が**画像そのものを見て**読み取った結果を
 *   DBに保存してあるので、それを使う。
 */
function buildDesignRef(t: {
  derivedStyle: string | null
  derivedComposition: string | null
  derivedUsesPhoto: boolean | null
}): { style: string; composition: CompositionKey | null } {
  if (!t.derivedStyle) return { style: '', composition: null }

  const VALID: CompositionKey[] = [
    'photo-overlay',
    'panel-side',
    'editorial-vertical',
    'type-hero',
    'hero-center',
  ]
  const composition = VALID.includes((t.derivedComposition || '') as CompositionKey)
    ? (t.derivedComposition as CompositionKey)
    : null

  // ⚠️ 写真の有無は必ず明示する。ここが抜けると、写真主体の見本を選んだのに
  //    図形と文字だけの絵が出る（実機で発生）。
  const photoLine =
    t.derivedUsesPhoto === true
      ? '写真: 実写の写真を主要な要素として使うこと。イラストや図形で代用しない。'
      : t.derivedUsesPhoto === false
        ? '写真: 実写の写真は使わず、図形・イラスト・文字で構成すること。'
        : ''

  return {
    style: [`作風: ${t.derivedStyle}`, photoLine].filter(Boolean).join('\n'),
    composition,
  }
}

export async function POST(req: NextRequest) {
  const base = await getIdentity(req)
  // ⚠️ ログイン必須。未ログインは識別子が無く、以降のスコープ条件が成立しない
  const auth = requireUser(base)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })
  const { identity, newGuestId } = ensureGuestId(base)
  const where = ownerWhere(identity)
  if (!where) return NextResponse.json({ error: '利用者を識別できませんでした' }, { status: 400 })

  const body = await req.json().catch(() => ({}))

  // ⚠️ 枚数の枠は**生成を始める前に**見る。走らせてから弾くと課金だけ発生する。
  const requestedVariations = Math.max(1, Math.min(3, Number(body?.variations) || 1))
  const requestedImages =
    (Array.isArray(body?.placements) ? body.placements.length : 1) * requestedVariations
  const quota = await assertQuota(identity, requestedImages)
  if (!quota.ok) return NextResponse.json({ error: quota.reason }, { status: 429 })

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

  // ⚠️ 同じサイズで見比べたいという要望に応えるための「3パターン」。
  //    構図を変えて同じサイズを複数回作る。枚数の枠もそのぶん消費する。
  const variations = Math.max(1, Math.min(3, Number(body?.variations) || 1))
  // 利用者が自分で書いたプロンプト（上級者向け）。空なら自動組み立て
  const customPrompt = String(body?.customPrompt || '').slice(0, 4000)

  // 見た目の参考に選ばれたデザイン（ドヤバナーAIのテンプレート）
  // ⚠️ テンプレートのプロンプトは「デザイン要素のみ」で、商材や文言は含まない。
  //    そのまま混ぜても、こちらのコピーが上書きされる心配は無い。
  let designRefPrompt = ''
  // ⚠️ 構図を渡さないと、色だけ合っていて配置が毎回変わる絵になる
  let designRefComposition: CompositionKey | null = null
  /** 見本の画像から実測した配色。⚠️ 文章だけでは色が決まらず、見本が反映されない */
  let designRefColors: string[] = []
  const designRefId = String(body?.designRefId || '')
  if (designRefId) {
    const t = await prisma.bannerTemplate.findUnique({
      where: { templateId: designRefId },
      select: {
        isActive: true,
        imageUrl: true,
        previewUrl: true,
        derivedStyle: true,
        derivedComposition: true,
        derivedUsesPhoto: true,
      },
    })
    if (t?.isActive) {
      const ex = buildDesignRef(t)
      designRefPrompt = ex.style
      designRefComposition = ex.composition
      if (!ex.style) {
        // ⚠️ 未解析のテンプレートは参考にしない。prompt から取ると実物と違う指示になる
        console.warn('[adimage] 未解析のテンプレートが選ばれました', designRefId)
      }

      // ⚠️ 参照画像は**生成時には渡さない**。編集APIは3サイズしか受けず、
      //    ストーリーズ(9:16)では比率差18.5%の帯が残る（実測）。
      //    画像は事前解析（analyze-banner-templates.ts）で読み取り済みで、
      //    その結果を上の文章として渡す方が崩れず結果も良かった。
      // ⚠️ ただし配色だけは文章では決まらない（「鮮烈な赤」が何色か特定できない）。
      //    画像から直接数えて16進で渡す。追加のAPIは使わないので費用は出ない。
      const refUrl = t.previewUrl || t.imageUrl
      if (refUrl) designRefColors = await extractRefPalette(refUrl)
    }
  }

  const baseGroups = groupByGenSize(placementKeys)
  // 3パターンは構図を変えて作る。同じ構図で回しても似た絵しか出ない
  const VARIATION_COMPOSITIONS: CompositionKey[] = ['hero-center', 'split-left', 'vertical-stack']
  const groups =
    variations === 1
      ? baseGroups
      : baseGroups.flatMap((g) =>
          Array.from({ length: variations }, (_, i) => ({
            ...g,
            genKey: `${g.genKey}#${i + 1}`,
            composition: VARIATION_COMPOSITIONS[i % VARIATION_COMPOSITIONS.length],
          }))
        )
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

  // ⚠️ グループは**並列**で回す。
  //    順番に回すと1枚あたり約40秒 × グループ数となり、3パターンを選んだだけで
  //    検査の再生成を挟むと maxDuration(300秒) を超えて 504 になる
  //    （画面は「仕上げ中…」のまま止まる。2026-09-02 に実際に発生）。
  //    グループ同士に依存は無いので、待ち時間は最も遅い1枚ぶんで済む。
  // ⚠️ グループ単位で捕まえる。1つのサイズが失敗しても残りは作り切り、
  //    どの配置が作れなかったかを必ず利用者へ返す（黙って短い結果を返さない）。
  const settled = await Promise.all(
    groups.map(async (group) => {
      try {
        // 生成サイズを代表する配置でプロンプトを組む
        const rep = group.placements[0]
        const result = await generateBaked({
          brand,
          copy,
          tone,
          placement: rep,
          // ⚠️ テンプレートから読み取れた構図を優先する。
          //    配置ごとの既定（placements.ts）は「サイズに対する無難な型」でしかなく、
          //    選んだ見本の構図を反映しないと、色だけ合って配置が別物になる。
          // ⚠️ ただし「3パターン」を選んだときは、構図を変えることが目的なので
          //    見本の構図で上書きしない（作風は designRefPrompt 側で効かせる）。
          //    上書きしていたため、見本を選ぶと3枚ともほぼ同じ絵になっていた。
          composition: variations > 1 ? group.composition : designRefComposition || group.composition,
          pathPrefix,
          customPrompt: customPrompt || undefined,
          designRefPrompt: designRefPrompt || undefined,
          designRefColors: designRefColors.length ? designRefColors : undefined,
        })

        // 同じ生成サイズを共有する配置は、同じ原本から書き出す
        const rows: typeof creativeRows = []
        for (const p of group.placements) {
          // ⚠️ 3パターン時は配置キーが同じなので、パターン識別子を渡さないと
          //    同じパスへ上書きされ最後の1枚しか残らない
          const variantKey = variations > 1 ? group.composition : undefined
          const { imagePath } = await exportToSize(result.buffer, p, pathPrefix, logo, variantKey)
          rows.push({
            placementKey: p.key,
            size: `${p.w}x${p.h}`,
            genSize: result.genSize,
            compositionKey: group.composition,
            imagePath,
            verify: result.verify as any,
          })
        }
        return { group, result, rows }
      } catch (err) {
        console.error('[adimage] generate failed', group.genKey, err instanceof Error ? err.message : err)
        return { group, result: null, rows: [] }
      }
    })
  )

  // ⚠️ 結果は groups の順に取り込む。並列でも並び順が入れ替わらないようにする
  for (const r of settled) {
    if (!r.result) {
      for (const fp of r.group.placements) failedPlacements.push(fp.name)
      continue
    }
    genPaths[r.group.genKey] = r.result.genPath
    if (!visualPrompt) {
      visualPrompt = r.result.prompt
      model = r.result.model
    }
    creativeRows.push(...r.rows)
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
      // ⚠️ 改善（refine）で引き継ぐために必ず保存する。
      //    保存しないと改善のたびに作風と構図が失われ、別物の絵になる。
      designRefId: designRefId || null,
      designRefStyle: designRefPrompt || null,
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
