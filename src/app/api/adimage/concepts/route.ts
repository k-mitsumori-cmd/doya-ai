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
 * テンプレートのプロンプトから「作風」だけを取り出す。
 *
 * ⚠️ テンプレートには**2つの形式が混在している**（実測: 構造化150枚 / 平文348枚）。
 *   A) 構造化: Concept/Style/Composition/Typography/Avoid の行区切り
 *   B) 平文  : 英語の説明文が1〜2段落（Style行は無い）
 *
 * ⚠️ どちらも**丸ごと渡してはいけない**。題材（何を描くか）と、
 *    Aでは比率（Wide 1.91:1 banner）まで書かれており、
 *    渡すと「テンプレートの題材が描かれる」「比率が衝突する」事故になる。
 *
 * ⚠️ Aだけを想定した抽出にすると、Bの348枚では空文字になり
 *    **デザイン指定が丸ごと無視される**（2026-09-01にこれで作風が全く効かなかった）。
 *    そのためBはLLMで作風だけに言い換える。失敗時は空にする（誤った指定を渡さない）。
 */
async function extractStyleOnly(
  prompt: string
): Promise<{ style: string; composition: CompositionKey | null }> {
  const pick = (label: string) => {
    const m = prompt.match(new RegExp(`^${label}:\\s*(.+)$`, 'mi'))
    return m?.[1]?.trim() || ''
  }
  const style = pick('Style')
  const avoid = pick('Avoid')

  // A) 構造化形式。作風はそのまま使えるが、構図は書かれていないので推定に回す
  if (style) {
    return {
      style: [`作風: ${style}`, avoid ? `避けること: ${avoid}` : ''].filter(Boolean).join('\n'),
      composition: null,
    }
  }

  // B) 平文形式。題材が混ざっているので、作風だけに言い換えてもらう
  try {
    const r = await geminiGenerateJson<{ style?: string; composition?: string }>(
      {
        prompt: [
          '次は広告バナーの生成指示です。ここから「作風」と「構図の型」を読み取ってください。',
          '',
          '【style に入れるもの】配色・色調・光・質感・余白の取り方・文字の組み方の傾向・全体の雰囲気',
          '【style に入れないもの】描かれている題材（人物・物・場所・業種）、具体的な文言、画面比率',
          '⚠️ 題材を一切含めないこと。「女性が」「オフィスで」のような描写は捨てる。',
          '⚠️ 60〜120字程度の日本語1文にまとめる。',
          '',
          '【composition】次から**最も近いものを1つ**選ぶ:',
          '  photo-overlay      … 写真を全面に敷き、その上に文字を重ねている',
          '  panel-side         … 片側が単色パネルで文字、もう片側が写真',
          '  editorial-vertical … 雑誌の誌面のように余白が大きく、写真と文字を重ねない',
          '  type-hero          … 文字が主役で、背景は控えめ',
          '  hero-center        … 中央に文字を集めた素直な構成',
          '⚠️ 写真を使っているかどうかを必ず見ること。ここを外すと全く違う絵になる。',
          '',
          '出力するJSON: { "style": "作風の説明", "composition": "上のいずれか" }',
          '',
          '【元の指示】',
          prompt.slice(0, 1500),
        ].join('\n'),
        model: GEMINI_TEXT_MODEL_DEFAULT,
      },
      'AdImageStyle'
    )
    const derived = String(r?.style || '').trim()
    const VALID: CompositionKey[] = ['photo-overlay', 'panel-side', 'editorial-vertical', 'type-hero', 'hero-center']
    const comp = VALID.includes(String(r?.composition || '') as CompositionKey)
      ? (String(r?.composition) as CompositionKey)
      : null
    return { style: derived ? `作風: ${derived.slice(0, 300)}` : '', composition: comp }
  } catch (e) {
    // ⚠️ 失敗したら空を返す。中途半端な文字列を渡すと題材が混ざる
    console.error('[adimage] 作風の抽出に失敗', e instanceof Error ? e.message : e)
    return { style: '', composition: null }
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
  let designRefImage: { mimeType: string; base64: string } | undefined
  // ⚠️ 構図を渡さないと、色だけ合っていて配置が毎回変わる絵になる
  let designRefComposition: CompositionKey | null = null
  const designRefId = String(body?.designRefId || '')
  if (designRefId) {
    const t = await prisma.bannerTemplate.findUnique({
      where: { templateId: designRefId },
      select: { prompt: true, isActive: true, imageUrl: true, previewUrl: true },
    })
    if (t?.isActive) {
      const ex = await extractStyleOnly(t.prompt || '')
      designRefPrompt = ex.style
      designRefComposition = ex.composition

      // ⚠️ **画像そのものを渡すのが本命。** 文章だけでは写真の有無・配置・
      //    文字の質感が伝わらず、選んだ見本と全く違う絵になる（2026-09-01に実機で確認）。
      //    ドヤバナーAI(nanobanner.ts:970)が同じ方式で運用できている。
      const refUrl = t.imageUrl || t.previewUrl
      if (refUrl) {
        try {
          const res = await fetch(refUrl)
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer())
            // ⚠️ 参照画像は縮小して渡す。原寸だとリクエストが重く、
            //    作風の伝達に解像度は要らない
            const small = await sharp(buf)
              .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
              .png()
              .toBuffer()
            designRefImage = { mimeType: 'image/png', base64: small.toString('base64') }
          } else {
            console.error('[adimage] 参照画像を取得できません', res.status, refUrl)
          }
        } catch (e) {
          // 取れなくても作風の文章だけで生成は続行する
          console.error('[adimage] 参照画像の取得に失敗', e instanceof Error ? e.message : e)
        }
      }
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
          // ⚠️ テンプレートから読み取れた構図を優先する。
          //    配置ごとの既定（placements.ts）は「サイズに対する無難な型」でしかなく、
          //    選んだ見本の構図を反映しないと、色だけ合って配置が別物になる。
          composition: designRefComposition || group.composition,
          pathPrefix,
          customPrompt: customPrompt || undefined,
          designRefPrompt: designRefPrompt || undefined,
          designRefImage,
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
