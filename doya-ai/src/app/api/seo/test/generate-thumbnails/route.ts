import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateBanners } from '@/lib/nanobanner'

export const runtime = 'nodejs'
export const maxDuration = 300

// SEO記事テンプレートのプロンプト定義（12種類）- 各テンプレートに個別プロンプト
const SEO_TEMPLATE_PROMPTS: Record<string, { title: string; prompt: string; category: string; headlineText: string; subheadText: string }> = {
  // 1. ChatGPTの使い方
  'chatgpt': {
    title: 'ChatGPTの使い方',
    category: 'it',
    headlineText: 'ChatGPTの使い方',
    subheadText: '初心者でも5分でわかる完全ガイド',
    prompt: `フラットイラストスタイルのブログ記事サムネイル。
背景: ソフトなライトブルー(#DBEAFE)のグラデーション
イラスト: ノートパソコンの前でAIと対話している人物のミニマルなフラットイラスト、横に小さなチャットバブルアイコン
スタイル: 日本のブログ記事バナー風、クリーンで親しみやすいデザイン
装飾: 「初心者向け」のラベルバッジ、スパークルエフェクト`,
  },

  // 2. Notionの始め方
  'notion': {
    title: 'Notionの始め方',
    category: 'it',
    headlineText: 'Notionの始め方',
    subheadText: '仕事効率が3倍になる活用術',
    prompt: `フラットイラストスタイルのブログ記事サムネイル。
背景: クリーンなオフホワイト(#F7F6F3)
イラスト: デスクでNotionを使って作業する人物のミニマルなフラットイラスト、周りにノート、チェックリスト、カレンダーアイコンが浮かぶ
スタイル: 日本のブログ記事バナー風、ミニマルでモダンなデザイン
装飾: 「効率化」のラベルバッジ、グリッドパターン背景`,
  },

  // 3. 副業の始め方
  'sidebusiness': {
    title: '副業の始め方',
    category: 'business',
    headlineText: '副業の始め方',
    subheadText: '会社員でも始められる人気の副業10選',
    prompt: `フラットイラストスタイルのブログ記事サムネイル。
背景: ソフトなミントグリーン(#D1FAE5)のグラデーション
イラスト: 自宅でラップトップを使って副業をする人物のフラットイラスト、周りにコイン、上向き矢印、成長する植物アイコンが浮かぶ
スタイル: 日本のブログ記事バナー風、希望に満ちた明るいデザイン
装飾: 「人気10選」のラベルバッジ`,
  },

  // 4. 投資信託の選び方
  'investment': {
    title: '投資信託の選び方',
    category: 'finance',
    headlineText: '投資信託の選び方',
    subheadText: '初心者向け失敗しない7つのポイント',
    prompt: `信頼性と安定感を表現したプロフェッショナルなデザイン。
チャート、グラフ、シールド（セキュリティ）などで「安心」と「成長」を表現。
メインカラー: #1E3A8A（ネイビー）
サブカラー: #3B82F6, #D97706, #FBBF24
ビジュアル要素: 上昇するチャート、コイン、シールド、計算機
雰囲気: 信頼性がある、教育的、自信を与える`,
  },

  // 5. Webデザインの基本
  'webdesign': {
    title: 'Webデザインの基本',
    category: 'design',
    headlineText: 'Webデザインの基本',
    subheadText: 'センスがなくても大丈夫！基礎から学ぶ',
    prompt: `クリエイティブでモダンなデザイン要素を配置。
カラーパレット、ブラウザウィンドウ、デザインツールのアイコンで「創造性」を表現。
メインカラー: #8B5CF6（パープル）
サブカラー: #EC4899, #3B82F6, #06B6D4
ビジュアル要素: カラーパレット、ブラウザウィンドウ、ペンツール、幾何学的形状
雰囲気: クリエイティブ、インスピレーション、アクセシブル`,
  },

  // 6. SNSマーケティング入門
  'snsmarketing': {
    title: 'SNSマーケティング入門',
    category: 'marketing',
    headlineText: 'SNSマーケティング入門',
    subheadText: 'フォロワー1万人達成の戦略とは',
    prompt: `ダイナミックでソーシャルな雰囲気のデザイン。
SNSアイコン、吹き出し、エンゲージメント指標などで「つながり」と「拡散」を表現。
メインカラー: #E1306C（ピンク/インスタ系）
サブカラー: #833AB4, #F77737, #FCAF45
ビジュアル要素: SNSアイコン群、吹き出し、ハート、シェアアイコン、上向き矢印
雰囲気: エネルギッシュ、つながり、モダン`,
  },

  // 7. プロジェクト管理ツール比較
  'projecttools': {
    title: 'プロジェクト管理ツール比較',
    category: 'it',
    headlineText: 'プロジェクト管理ツール比較',
    subheadText: 'Notion vs Asana vs Trello 徹底比較',
    prompt: `整理された比較表をイメージしたクリーンなデザイン。
複数のアプリアイコン、比較チャート、チェックマークで「選択」と「最適化」を表現。
メインカラー: #2563EB（ブルー）
サブカラー: #64748B, #0EA5E9, #22C55E
ビジュアル要素: 複数アプリアイコン、比較表、チェックマーク、カンバンボード
雰囲気: 客観的、ヘルプフル、包括的`,
  },

  // 8. 動画編集ソフトおすすめ
  'videoediting': {
    title: '動画編集ソフトおすすめ',
    category: 'creative',
    headlineText: '動画編集ソフトおすすめ',
    subheadText: '初心者からプロまで使える8選',
    prompt: `ダイナミックでクリエイティブな映像制作をイメージ。
フィルムリール、タイムライン、再生ボタンなどで「動画制作」を表現。
メインカラー: #7C3AED（バイオレット）
サブカラー: #F97316, #EC4899, #06B6D4
ビジュアル要素: フィルムリール、タイムライン、再生ボタン、波形エフェクト
雰囲気: クリエイティブ、プロフェッショナル、エキサイティング`,
  },

  // 9. CRM/MAツール比較
  'crmtools': {
    title: 'CRM/MAツール比較',
    category: 'business',
    headlineText: 'CRM/MAツール比較',
    subheadText: 'Salesforce・HubSpot・Zoho完全比較',
    prompt: `コーポレートでプロフェッショナルなB2Bツール比較のイメージ。
ダッシュボード、顧客アイコン、オートメーションビジュアルで「効率化」を表現。
メインカラー: #0891B2（シアン）
サブカラー: #2563EB, #059669, #D97706
ビジュアル要素: ダッシュボード、顧客アイコン群、歯車、データフロー接続線
雰囲気: プロフェッショナル、データドリブン、効率的`,
  },

  // 10. DX推進の進め方
  'dxstrategy': {
    title: 'DX推進の進め方',
    category: 'business',
    headlineText: 'DX推進の進め方',
    subheadText: '成功企業に学ぶ5つのステップ',
    prompt: `デジタルトランスフォーメーションをイメージしたモダンで革新的なデザイン。
デジタル変革ビジュアル、矢印、接続されたノードで「変革」と「進化」を表現。
メインカラー: #1E40AF（ディープブルー）
サブカラー: #3B82F6, #06B6D4, #8B5CF6
ビジュアル要素: 変化の矢印、ネットワークノード、クラウドアイコン、上昇グラフ
雰囲気: 進歩的、戦略的、モダン`,
  },

  // 11. SEO完全ガイド
  'seoguide': {
    title: 'SEO完全ガイド',
    category: 'marketing',
    headlineText: 'SEO完全ガイド',
    subheadText: '検索順位1位を獲得する方法',
    prompt: `デジタルマーケティングとサーチエンジン最適化をイメージ。
検索アイコン、ランキング矢印、キーワードビジュアルで「上位表示」を表現。
メインカラー: #059669（グリーン）
サブカラー: #2563EB, #0EA5E9, #22C55E
ビジュアル要素: 検索アイコン、上昇するランキング矢印、キーワードタグ、ブラウザ
雰囲気: 包括的、エキスパート、結果重視`,
  },

  // 12. 新規事業立ち上げ
  'newbusiness': {
    title: '新規事業立ち上げ',
    category: 'business',
    headlineText: '新規事業立ち上げ',
    subheadText: 'アイデアから実現までの完全ロードマップ',
    prompt: `起業とイノベーションをイメージしたダイナミックなデザイン。
ロケット発射、電球、成長チャートで「スタート」と「成長」を表現。
メインカラー: #F97316（オレンジ）
サブカラー: #2563EB, #059669, #FBBF24
ビジュアル要素: ロケット、電球、成長チャート、ターゲットアイコン
雰囲気: 野心的、エキサイティング、達成可能`,
  },

  // ===== 新テンプレートID形式（Put!スタイル） =====

  // intro-1: ChatGPTの使い方
  'intro-1': {
    title: 'ChatGPTの使い方',
    category: 'it',
    headlineText: 'ChatGPTの使い方',
    subheadText: '初心者でも5分で始められる完全ガイド',
    prompt: `テキスト:
メイン: 「ChatGPTの使い方」
サブ: 「5分でわかる完全ガイド」

配色:
背景: #DBEAFE（ソフトブルー）から #EFF6FF（アイスホワイト）への横グラデーション
文字: #1E293B（ダークスレート）
アクセント: #8B5CF6（バイオレット）でチャットバブル内のスパークルを表現

フォント:
メイン: 極太の丸ゴシック体。角が丸く柔らかいウェイトで、親しみやすく読みやすい印象。
サブ: 細めのサンセリフ体。添える程度の存在感。

レイアウト:
テキスト配置: 左半分にメインとサブを縦積み、左揃え。
サイズ比率: 右半分にAIチャットウィンドウのフラットイラストを配置。チャット吹き出しが3つ浮かび、1つの吹き出しの中にスパークルアイコン。
装飾・図形: 背景全体に薄いドットグリッドパターン。

サイズ:
比率: 16:9

スタイル:
テックブログのアイキャッチ風。
フラットイラスト（線なし、面のみで構成）。
余白を活かした呼吸感のあるクリーンなデザイン。
初心者が安心してクリックできる親しみやすいトーン。`,
  },

  // template-4: SNSマーケティング成功事例
  'template-4': {
    title: 'SNSマーケティング成功事例',
    category: 'marketing',
    headlineText: 'SNSマーケティング',
    subheadText: 'フォロワー10万人達成の軌跡',
    prompt: `テキスト:
メイン: 「SNSマーケティング」
サブ: 「フォロワー10万人達成の軌跡」

アイキャッチ:
「100K」を画面右半分に巨大配置（白文字に薄いドロップシャドウ）

背景:
#EC4899（ピンク）から #8B5CF6（パープル）への斜め45度グラデーション（Instagram風）

配色:
文字: #FFFFFF（ホワイト）
アクセント: #FBBF24（イエロー）でハートアイコンとフォロワー数を強調

フォント:
メイン: 極太の角ゴシック体。SNSフィード上で映える、太く大きく力強い書体。
「100K」: 極太のディスプレイサンセリフ体。画面の右半分を占めるほど巨大に。白文字に薄い影。
サブ: 中太のサンセリフ体。メインの下に小さく配置。

レイアウト:
テキスト配置: 左側にメインとサブを縦積み。右側に「100K」を巨大配置。
サイズ比率: 下部にInstagram風フィード画面のモックアップ。周囲にハート、コメント、シェアの通知アイコンが弾けるように飛び散る。
装飾・図形: フォロワー増加を示す右肩上がりの折れ線グラフを背景に薄く。Instagram・X・TikTokの各SNSアイコンを下部に小さく横並び。

サイズ:
比率: 16:9

スタイル:
バイラル / SNSネイティブ風。
Instagram風グラデーションでSNS感を直感的に伝える。
「10万人」の数字インパクトでクリックを誘う。
ソーシャルメディアラボ的なエネルギッシュで華やかなトーン。`,
  },
}

// テンプレート画像を生成（nanobanner.ts の generateBanners 経由 → Nano Banana Pro 固定）
async function generateTemplateImage(
  templateId: string,
  prompt: string,
  category: string,
  headlineText: string,
  subheadText: string
): Promise<string> {
  console.log(`[SEO Template Gen] Using nanobanner.ts (Nano Banana Pro) for ${templateId}`)

  const result = await generateBanners(
    category,
    headlineText,
    '1200x628',
    {
      customImagePrompt: prompt,
      headlineText,
      subheadText,
      purpose: 'article_banner',
    },
    1
  )

  if (result.error && result.banners.length === 0) {
    throw new Error(result.error)
  }

  const imageData = result.banners[0]
  if (!imageData || imageData.startsWith('https://placehold')) {
    throw new Error(result.error || 'Image generation failed')
  }

  console.log(`[SEO Template Gen] Successfully generated with model: ${result.usedModel}`)
  return imageData
}

// POST: テンプレート画像をバッチ生成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { templateIds, limit = 3 } = body as { templateIds?: string[]; limit?: number }

    // 対象テンプレートを決定
    const targetIds = templateIds || Object.keys(SEO_TEMPLATE_PROMPTS)
    const targetPrompts = targetIds
      .filter((id) => SEO_TEMPLATE_PROMPTS[id])
      .slice(0, limit)

    if (targetPrompts.length === 0) {
      return NextResponse.json({ error: 'No matching templates found' }, { status: 404 })
    }

    // 既存のテンプレートを確認
    const existingTemplates = await prisma.bannerTemplate.findMany({
      where: {
        templateId: {
          in: targetIds.map((id) => `seo-article-${id}`),
        },
      },
      select: { templateId: true },
    })
    const existingIds = new Set(existingTemplates.map((t) => t.templateId.replace('seo-article-', '')))

    // 未生成のテンプレートのみ処理
    const pendingIds = targetPrompts.filter((id) => !existingIds.has(id))

    if (pendingIds.length === 0) {
      return NextResponse.json({
        message: 'All requested templates already exist',
        existing: existingIds.size,
        total: targetIds.length,
      })
    }

    console.log(`[SEO Template Gen] Generating ${pendingIds.length} templates (Direct API)...`)

    const results: { id: string; status: 'success' | 'error'; error?: string }[] = []

    for (const templateId of pendingIds) {
      const config = SEO_TEMPLATE_PROMPTS[templateId]
      console.log(`[SEO Template Gen] Processing: ${templateId} - ${config.title}`)

      try {
        const imageData = await generateTemplateImage(
          templateId,
          config.prompt,
          config.category,
          config.headlineText,
          config.subheadText
        )
        console.log(`[SEO Template Gen] Image generated for ${templateId}`)

        // データベースに保存
        await prisma.bannerTemplate.create({
          data: {
            templateId: `seo-article-${templateId}`,
            industry: config.category,
            category: 'seo-article',
            prompt: config.prompt,
            size: '1200x628',
            imageUrl: imageData,
            previewUrl: imageData,
            isFeatured: false,
            isActive: true,
          },
        })

        results.push({ id: templateId, status: 'success' })

        // レート制限対策: 3秒待機
        await new Promise((resolve) => setTimeout(resolve, 3000))
      } catch (error: any) {
        console.error(`[SEO Template Gen] Error for ${templateId}:`, error.message)
        results.push({ id: templateId, status: 'error', error: error.message })

        // エラー時は5秒待機
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length
    const errorCount = results.filter((r) => r.status === 'error').length

    return NextResponse.json({
      message: `Generated ${successCount} templates, ${errorCount} errors`,
      results,
      successCount,
      errorCount,
      remaining: targetIds.length - existingIds.size - pendingIds.length,
    })
  } catch (error: any) {
    console.error('[SEO Template Gen] Unexpected error:', error.message)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// GET: 生成済みテンプレート一覧を取得
export async function GET() {
  try {
    const templates = await prisma.bannerTemplate.findMany({
      where: {
        templateId: {
          startsWith: 'seo-article-',
        },
        isActive: true,
      },
      select: {
        templateId: true,
        industry: true,
        previewUrl: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const templateMap: Record<string, string> = {}
    for (const t of templates) {
      const id = t.templateId.replace('seo-article-', '')
      templateMap[id] = t.previewUrl || ''
    }

    return NextResponse.json({
      count: templates.length,
      templates: templateMap,
      allIds: Object.keys(SEO_TEMPLATE_PROMPTS),
      missingIds: Object.keys(SEO_TEMPLATE_PROMPTS).filter((id) => !templateMap[id]),
    })
  } catch (error: any) {
    console.error('[SEO Template Gen] GET error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: 生成済みテンプレート画像を全て削除
export async function DELETE() {
  try {
    // seo-article-で始まるテンプレートを全て削除
    const result = await prisma.bannerTemplate.deleteMany({
      where: {
        templateId: {
          startsWith: 'seo-article-',
        },
      },
    })

    console.log(`[SEO Template Gen] Deleted ${result.count} templates`)

    return NextResponse.json({
      message: `Deleted ${result.count} templates`,
      deletedCount: result.count,
    })
  } catch (error: any) {
    console.error('[SEO Template Gen] DELETE error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
