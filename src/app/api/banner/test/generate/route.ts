import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getBannerMonthlyLimitByUserPlan,
  shouldResetMonthlyUsage,
} from '@/lib/pricing'
import { generateBanners } from '@/lib/nanobanner'

export const runtime = 'nodejs'
export const maxDuration = 300

type TestGenerateRequest = {
  template?: string
  size?: string
  industry?: string
  mainTitle?: string
  subTitle?: string
  accentText?: string
  count?: number
  basePrompt?: string // テンプレートのベースプロンプト
  templateImageUrl?: string // 元のテンプレート画像URL（スタイル参照用）
  templateDisplayTitle?: string // テンプレートの表示名
  logoBase64?: string // ロゴ画像（Base64）
  personBase64?: string // 人物画像（Base64）
  customPrompt?: string // エンタープライズ限定：カスタムプロンプト
  mainColor?: string // メインカラー
  subColor?: string // サブカラー
}

// テンプレート別のプロンプト生成（ユーザー例を参考に拡張可能）
function buildTestBannerPrompt(params: {
  template?: string
  size: string
  industry: string
  mainTitle: string
  subTitle?: string
  accentText?: string
  variationIndex: number
  basePrompt?: string // テンプレートのベースプロンプト
  templateDisplayTitle?: string // テンプレートの表示名
  customPrompt?: string // エンタープライズ限定：カスタムプロンプト
}): string {
  const { template, size, industry, mainTitle, subTitle, accentText, variationIndex, basePrompt, templateDisplayTitle, customPrompt } = params
  const [width, height] = size.split('x')
  
  // basePromptがある場合は、それをベースにカスタマイズ（スタイルを維持）
  if (basePrompt && basePrompt.length > 50) {
    // 元のプロンプトをそのまま使用し、テキストのみ差し替え
    // 元のプロンプトが英語の場合はそのまま使用
    
    // 元のプロンプトからテキスト指示を除去し、新しいテキストを追加
    // 元のプロンプトの構造を維持しつつ、テキスト内容のみ変更
    
    // カスタムプロンプトがある場合は追加指示として含める
    const customInstructions = customPrompt ? `

=== ADDITIONAL CUSTOM INSTRUCTIONS (ENTERPRISE) ===
The following custom modifications should be applied to the design:
${customPrompt}

Please incorporate these custom instructions while maintaining the overall style and quality.
` : ''
    
    return `
${basePrompt}

=== TEXT REPLACEMENT ===
Replace any placeholder text or sample text in the design with:
- Main headline: "${mainTitle}"
${subTitle ? `- Subheadline: "${subTitle}"` : ''}
${accentText ? `- Accent text: "${accentText}"` : ''}
${customInstructions}
=== CRITICAL INSTRUCTIONS ===
1. KEEP the exact same visual style, colors, layout, and composition as described above${customPrompt ? ' (unless modified by custom instructions)' : ''}
2. ONLY change the text content to the new Japanese text provided
3. Maintain the same typography style (font weight, size, color, position)
4. Keep all decorative elements, backgrounds, and visual effects identical${customPrompt ? ' (unless modified by custom instructions)' : ''}
5. The Japanese text "${mainTitle}" must be clearly readable and properly positioned

=== CRITICAL OUTPUT SPECIFICATIONS (MUST FOLLOW) ===
**EXACT OUTPUT SIZE: ${width}x${height} pixels**
- The output image MUST be EXACTLY ${width} pixels wide and ${height} pixels tall.
- DO NOT change the aspect ratio under any circumstances.
- Fill the ENTIRE canvas edge-to-edge with content.
- NO letterboxing, NO empty bars at top/bottom/sides, NO padding, NO borders.
- Japanese text must be legible with clean typography.
- Return ONE PNG image at EXACTLY ${width}x${height} pixels.
`.trim()
  }

  // テンプレート別のスタイル調整
  const templateStyles: Record<string, { tone: string; colors: string; elements: string }> = {
    'dark-tech': {
      tone: 'ダークトーン（黒〜ダークグレー基調）',
      colors: 'ダークグレー、黒、ネオンイエロー（アクセント）',
      elements: 'Webページ、管理画面、スライドのUIが並んでいるモザイク・グリッド表現',
    },
    'minimal-clean': {
      tone: 'ミニマル、清潔感',
      colors: '白、グレー、アクセントカラー',
      elements: 'シンプルな形状、余白重視',
    },
    'gradient-modern': {
      tone: 'グラデーション、モダン',
      colors: 'グラデーションカラー、ビビッドカラー',
      elements: 'グラデーション背景、モダンなアイコン',
    },
  }

  const style = template ? templateStyles[template] || templateStyles['dark-tech'] : templateStyles['dark-tech']

  // バリエーションごとに異なるプロンプトを生成
  const variationHints = [
    'Layout: split-screen with large headline on left, visual elements on right. Dark background with UI mosaics.',
    'Layout: centered composition with large title at center-top, gradient background with subtle UI patterns.',
    'Layout: diagonal dynamic composition with headline angled, vibrant accent colors, modern tech aesthetic.',
    'Layout: minimal with lots of whitespace, headline in upper-left, subtle background textures.',
    'Layout: grid pattern with multiple small UI elements, large headline overlaid on top.',
    'Layout: hero section style with massive title, dark gradient background, clean UI elements.',
    'Layout: card-based with rounded corners, headline in card, modern shadow effects.',
    'Layout: asymmetric with headline offset to left, visual balance with accent elements on right.',
    'Layout: full-width banner with title spanning entire width, dark background with subtle patterns.',
    'Layout: magazine-style with clear hierarchy, headline in bold, subheading below, premium feel.',
  ]

  const variationHint = variationHints[variationIndex % variationHints.length] || variationHints[0]

  const prompt = `
目的：
「${mainTitle}」
${subTitle ? `+ 「${subTitle}」` : ''}
${accentText ? `+ 「${accentText}」` : ''}
という記事・特集ページ用のアイキャッチ兼バナー画像を制作したい。

参考イメージ：
・全体は${style.tone}
・背景に${style.elements}
・情報量が多いが、整理されていて"知的・プロ向け"な印象
・WEBディレクター / マーケター向けのクリエイティブナレッジ感

デザインテイスト：
・クール / 知的 / 信頼感 / 最新トレンド
・「情報を網羅的に比較・整理している」雰囲気
・広告っぽすぎず、メディア・ホワイトペーパー寄り
・2026年感のあるモダンなデザイン

構図：
・横長バナー（${width}×${height}想定）
・左〜中央に大きなタイトル文字
・右側または背景に、AIツール・文章・UI・比較表を想起させるビジュアル
・奥行き感（軽いボケ・レイヤー重なり）
${variationHint}

入れたいテキスト（日本語）：
${accentText ? `・上部またはアクセントとして小さく：「${accentText}」` : ''}
・メインタイトル（最重要）：「${mainTitle}」
${subTitle ? `・サブタイトル：「${subTitle}」` : ''}

文字表現：
・太めのゴシック体、日本語可読性重視
・メインタイトルは白文字
・一部キーワードは黄色 or ネオン系アクセントカラーで強調
・文字はボックスや下線で囲ってもOK

ビジュアル要素：
・PC画面、Webページ、文章、ダッシュボード、カードUIなどを想起させる背景
・「比較」「分析」「網羅」「ランキング」が伝わる
・人物は不要（入れる場合もシルエット程度）

避けたい点：
・ポップすぎる / かわいすぎる
・BtoC感が強いデザイン
・イラスト感が強すぎる表現

全体の印象：
「SEOやコンテンツマーケに本気な人がクリックしたくなる、"保存版・決定版"感のあるAIツール比較バナー」

=== 出力サイズ（必須） ===
**正確に ${width}×${height} ピクセル**
・出力画像は必ず幅${width}px、高さ${height}pxで生成すること
・アスペクト比を絶対に変更しないこと
・キャンバス全体をコンテンツで埋める（レターボックス、余白、パディング、ボーダーなし）
・日本語テキストは必ず可読性を確保
・1枚のPNG画像を ${width}×${height} ピクセルで返すこと
`.trim()

  return prompt
}

export async function POST(request: NextRequest) {
  // ⚠️ このルートは名前に反して**一般利用者の導線**（/banner/dashboard の
  //    「選んで生成」）から呼ばれる。同じ名前空間の templates/* が保守APIなので
  //    2026-09-02 に requireBannerAdmin を付けたが、それは誤りで、
  //    一般利用者全員が「この操作には管理者権限が必要です」で止まった。
  //    管理者ガードではなく、本家 /api/banner/generate と同じ
  //    「ログイン必須 ＋ 月次の枚数上限」で守る。
  // ⚠️ 1回で最大10枚の画像を生成する（＝そのまま従量課金）。無認証には戻さないこと。
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) {
    return NextResponse.json(
      { error: 'バナーの生成にはログインが必要です。無料で登録いただけます。', code: 'LOGIN_REQUIRED' },
      { status: 401 }
    )
  }

  try {
    const body = (await request.json()) as TestGenerateRequest
    const {
      template,
      size = '1200x628',
      industry = '',
      mainTitle = '',
      subTitle = '',
      accentText = '',
      count = 10,
      basePrompt,
      templateImageUrl,
      templateDisplayTitle,
      logoBase64,
      personBase64,
      customPrompt, // エンタープライズ限定：カスタムプロンプト
      mainColor,
      subColor,
    } = body

    if (!mainTitle.trim()) {
      return NextResponse.json({ error: 'メインタイトルは必須です' }, { status: 400 })
    }

    // カテゴリを業種から推測（簡易版）
    let category = 'it'
    if (industry.includes('美容') || industry.includes('コスメ')) category = 'beauty'
    else if (industry.includes('EC') || industry.includes('セール')) category = 'ec'
    else if (industry.includes('採用') || industry.includes('人材')) category = 'recruit'
    else if (industry.includes('教育') || industry.includes('スクール')) category = 'education'

    const targetCount = Math.max(1, Math.min(10, Math.floor(count || 10)))

    // ⚠️ 枚数の枠は**生成を始める前に**見る。走らせてから弾くと課金だけ発生する。
    //    枠は本家 /api/banner/generate と同じ（serviceId='banner' の月次）を共有する。
    //    別枠にすると、こちらから回すだけで上限を二重に使えてしまう。
    const disableLimits =
      process.env.DOYA_DISABLE_LIMITS === '1' || process.env.BANNER_DISABLE_LIMITS === '1'
    let sub = await prisma.userServiceSubscription.findUnique({
      where: { userId_serviceId: { userId, serviceId: 'banner' } },
    })
    if (!sub) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } })
      sub = await prisma.userServiceSubscription.create({
        data: { userId, serviceId: 'banner', plan: u?.plan || 'FREE' },
      })
    }
    // ⚠️ リセットは「次に生成したとき」に行う遅延方式。月をまたいだ直後は
    //    古い数字が残っているので、ここで0に均してから数える。
    const monthlyUsed = shouldResetMonthlyUsage(sub.lastUsageReset) ? 0 : sub.monthlyUsage || 0
    const monthlyLimit = getBannerMonthlyLimitByUserPlan(sub.plan)

    if (!disableLimits && monthlyLimit !== -1 && monthlyUsed + targetCount > monthlyLimit) {
      return NextResponse.json(
        {
          error: `今月の生成枚数の上限（${monthlyLimit}枚）に達しました。`,
          code: 'MONTHLY_LIMIT_REACHED',
          usage: {
            monthlyLimit,
            monthlyUsed,
            monthlyRemaining: Math.max(0, monthlyLimit - monthlyUsed),
          },
          upgradeUrl: '/banner/pricing',
        },
        { status: 429 }
      )
    }

    // 複数のバリエーションを生成（同じ入力でも異なるプロンプト）
    const banners: string[] = []
    const prompts: string[] = []

    // 並列生成のため、先に全プロンプトを生成
    for (let i = 0; i < targetCount; i++) {
      const prompt = buildTestBannerPrompt({
        template,
        size,
        industry,
        mainTitle,
        subTitle,
        accentText,
        variationIndex: i,
        basePrompt,
        templateDisplayTitle,
        customPrompt, // エンタープライズ限定：カスタムプロンプト
      })
      prompts.push(prompt)
    }

    // 各バリエーションを順次生成（Gemini 3.0で画像生成）
    for (let i = 0; i < targetCount; i++) {
      try {
        const prompt = prompts[i]
        const result = await generateBanners(
          category,
          mainTitle,
          size,
          {
            headlineText: mainTitle,
            subheadText: subTitle || undefined,
            customImagePrompt: prompt,
            // variationMode を指定しない（customImagePrompt使用時は共通プロンプトを追加しない）
            // ロゴ・人物画像を渡す
            logoImage: logoBase64 || undefined,
            personImages: personBase64 ? [personBase64] : undefined,
            // カラー指定
            brandColors: [mainColor, subColor].filter(Boolean) as string[],
          },
          1 // 1枚ずつ生成
        )

        if (result.banners && result.banners.length > 0) {
          banners.push(result.banners[0])
        } else if (result.error) {
          console.error(`Banner ${i + 1} generation error:`, result.error)
          // エラーでも続行（部分的な成功を許容）
        }
      } catch (err: any) {
        console.error(`Banner ${i + 1} generation failed:`, err)
        // エラーでも続行
      }
    }

    if (banners.length === 0) {
      return NextResponse.json({ error: 'バナーの生成に失敗しました' }, { status: 500 })
    }

    // ⚠️ 成功したぶんだけ加算する。失敗した枚数まで枠を消費させない。
    //    ここを忘れると、こちらの導線から回した生成が枠に載らず、
    //    上限がまるごと素通りになる。
    if (!disableLimits) {
      try {
        await prisma.userServiceSubscription.update({
          where: { userId_serviceId: { userId, serviceId: 'banner' } },
          data: shouldResetMonthlyUsage(sub.lastUsageReset)
            ? { monthlyUsage: banners.length, lastUsageReset: new Date() }
            : { monthlyUsage: { increment: banners.length } },
        })
      } catch (e) {
        console.error('[banner/test/generate] 使用回数の加算に失敗', e)
        // 加算に失敗しても生成自体は成功しているので落とさない
      }
    }

    return NextResponse.json({
      banners,
      prompts,
      count: banners.length,
    })
  } catch (err: any) {
    console.error('Test banner generation error:', err)
    return NextResponse.json({ error: err.message || '生成に失敗しました' }, { status: 500 })
  }
}
