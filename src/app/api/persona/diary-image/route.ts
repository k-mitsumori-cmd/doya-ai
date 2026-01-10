// ========================================
// ドヤペルソナAI - 日記イメージ生成API（Nano Banana Pro）
// ========================================
import { NextRequest, NextResponse } from 'next/server'
import { generateBanners } from '@/lib/nanobanner'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isWithinFreeHour } from '@/lib/pricing'

export async function POST(req: NextRequest) {
  try {
    // ========================================
    // 機能制限（persona専用）
    // - ゲスト: スケジュール/日記画像はブラインド（生成不可）
    // - ログイン: 初回ログイン後1時間のみ解放
    // - PRO/ENTERPRISE: 常に解放
    // ※ 他サービスには影響させない
    // ========================================
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: '画像生成はログインが必要です（ゲストはブラインド表示）',
          code: 'FEATURE_LOCKED',
          upgradeUrl: '/pricing',
        },
        { status: 403 }
      )
    }

    let planRaw = String((session?.user as any)?.plan || 'FREE').toUpperCase()
    let firstLoginAtIso = (session?.user as any)?.firstLoginAt as string | null | undefined
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, firstLoginAt: true },
      })
      if (dbUser?.plan) planRaw = String(dbUser.plan).toUpperCase()
      if (dbUser?.firstLoginAt) firstLoginAtIso = dbUser.firstLoginAt.toISOString()
    } catch {
      // セッション値で続行
    }

    const isPro = planRaw === 'PRO' || planRaw === 'BUNDLE' || planRaw === 'BASIC' || planRaw === 'STARTER' || planRaw === 'BUSINESS'
    const isEnt = planRaw === 'ENTERPRISE'
    const freeHour = isWithinFreeHour(firstLoginAtIso || null)

    if (!isPro && !isEnt && !freeHour) {
      return NextResponse.json(
        {
          success: false,
          error: '画像生成はPRO/ENTERPRISEまたは初回ログイン後1時間のみ利用できます',
          code: 'FEATURE_LOCKED',
          upgradeUrl: '/pricing',
        },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { diaryText, captionText, keywords, size, gender } = body || {}

    const diary = String(diaryText || '').trim()
    const caption = String(captionText || '').trim()
    const kw = Array.isArray(keywords) ? keywords.map(String).filter(Boolean).slice(0, 12) : []
    const genderRaw = String(gender || '').trim()
    const genderHint =
      /女/.test(genderRaw) ? 'Japanese adult woman' : /男/.test(genderRaw) ? 'Japanese adult man' : ''

    if (!diary) {
      return NextResponse.json({ error: '日記テキストが必要です' }, { status: 400 })
    }

    const sz = String(size || '1200x628')

    // Nano Banana Pro（nanobanner.ts）に「画像内テキスト描画」を強制する
    const customImagePrompt = [
      'Create a premium editorial illustration/photo-like image for a Japanese persona diary.',
      'It must feel realistic and specific to the diary.',
      '',
      genderHint
        ? `If a person appears in the scene, depict ONE ${genderHint} as the main subject (no gender mismatch).`
        : 'If a person appears in the scene, depict ONE Japanese adult as the main subject.',
      '',
      '=== DIARY (JP) ===',
      diary,
      '',
      kw.length ? `Keywords: ${kw.join(', ')}` : '',
      '',
      '=== TEXT TO RENDER IN IMAGE (MUST BE EXACT, 1-2 lines) ===',
      caption ? caption : 'ある日の記録',
      '',
      '=== STYLE ===',
      '- Japanese modern editorial, clean, premium, warm, human.',
      '- No advertisement, no CTA button, no logos.',
      '- Put the text on a solid/gradient panel for readability.',
      '- Avoid clutter. Make the scene match the diary: location, time, mood.',
      '',
      `Output size must be EXACTLY ${sz} px, edge-to-edge (no letterboxing).`,
    ]
      .filter(Boolean)
      .join('\n')

    const result = await generateBanners(
      'other',
      // keyword は画像内テキスト強制に使われる。caption を優先。
      caption || 'ある日の記録',
      sz,
      {
        purpose: 'article_banner',
        customImagePrompt,
        // バナーとは違い“広告”にしないため、CTA等は入れない
        headlineText: caption || 'ある日の記録',
        subheadText: '',
        ctaText: '',
        variationMode: 'similar',
      },
      1
    )

    const img = result?.banners?.[0]
    if (!img || typeof img !== 'string' || !img.startsWith('data:image/')) {
      return NextResponse.json(
        { error: result?.error || '日記イメージの生成に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      image: img,
      usedModel: result.usedModel || null,
    })
  } catch (e: any) {
    console.error('Diary image generation error:', e)
    return NextResponse.json({ error: e?.message || '日記イメージ生成に失敗しました' }, { status: 500 })
  }
}


