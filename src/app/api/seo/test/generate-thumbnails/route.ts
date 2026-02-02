import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateBanners } from '@/lib/nanobanner'

export const runtime = 'nodejs'
export const maxDuration = 300

// ドヤバナーAI風の高品質プロンプトを生成するヘルパー（テキスト込み版）
function buildSeoArticlePrompt(params: {
  headlineText: string // 画像内に描画するメインテキスト
  subheadText?: string // サブテキスト（任意）
  visualConcept: string
  mainColor: string
  subColors: string[]
  visualElements: string[]
  mood: string
  targetAudience: string
}): string {
  const { headlineText, subheadText, visualConcept, mainColor, subColors, visualElements, mood, targetAudience } = params

  return `
■ あなたは、広告代理店・デザイン制作会社・マーケターが合同で行う
「SEO記事サムネイル制作チーム」です。

以下の指示をすべて厳守し、
SEOブログ記事のサムネイル画像として
"そのまま使用できるプロ品質のバナー画像"を生成してください。

■ 最重要ルール（必ず厳守）
- 指定テキストは【一字一句変更せず】【省略せず】【誤字なく】画像内に正確に反映
- 指定テキストは最優先要素。日本語可読性を最優先
- 文字が潰れる/歪む/意味が変わる表現は禁止
- 同一文言の重複表示は禁止（同じテキストを2回以上並べない）
- 日本語は正しい文字で表示（文字化け・意味不明な文字・存在しない漢字は絶対禁止）

■ 画像内に必ず含めるテキスト
【メインタイトル（必須）】${headlineText}
${subheadText ? `【サブタイトル（任意）】${subheadText}` : ''}
※ 内容・表現・順序を一切変更しないこと
※ テキストは画像の下部または中央下部に配置し、背景とのコントラストを確保

■ 用途指定
【用途】SEO記事のサムネイル・アイキャッチ画像
- Google検索結果、SNSシェア時に表示される
- 小さいサイズでも一瞬で内容が伝わる構成
- クリックしたくなる魅力的なデザイン

■ ターゲット
${targetAudience}

■ ビジュアルコンセプト
${visualConcept}

■ カラー指定（必ず反映）
【メインカラー】${mainColor}
【サブカラー】${subColors.join(', ')}
- 指定カラーは必ずデザイン全体に反映
- 文字と背景のコントラストを十分確保（文字が読めることが最優先）
- グラデーションを効果的に使用
- 高級感とモダンさを両立

■ 含めるビジュアル要素
${visualElements.map((e) => `- ${e}`).join('\n')}

■ ムード・雰囲気
${mood}

■ デザイン要件
- 16:9のアスペクト比（1200x628px）
- ビジュアル要素は上部〜中央に配置
- テキストは下部に配置、半透明の暗いグラデーションパネルの上に白文字で表示
- テキストエリアは画像の下部20-30%を使用
- 洗練されたイラスト/グラフィック調（写真のようなリアルさは不要）
- ミニマルだがインパクトのある構図

■ 日本語テキスト品質ルール（絶対厳守）
- 日本語テキストは完全に読める状態で表示（文字化け・疑似文字は禁止）
- クリーンな日本語フォントスタイル（Noto Sans JP風）を使用
- テキストの後ろには必ずソリッド/グラデーションのパネルを配置してコントラストを確保
- メインタイトルは大きく、1〜2行以内に収める
- 絶対禁止：存在しない漢字、文字化け、意味不明な文字の組み合わせ
- 例：「夏月」（間違い→正しくは「7月」）、「お布」（間違い→正しくは「お知らせ」）

■ 禁止事項
- 指定テキストの改変・省略・誤字
- 同じ文言の繰り返し
- 読めない日本語フォント、意味不明な英語、不要な記号
- ロゴ、透かし、ウォーターマーク
- 人物の顔（プライバシー配慮）
- ゴチャゴチャした複雑な構図
- 安っぽいクリップアート調

■ ゴール
「修正したくならない」「そのまま記事に使える」プロ品質のSEO記事サムネイル画像を生成してください。
テキストが正しく日本語で表示されていることが最重要です。
`.trim()
}

// SEO記事テンプレートのプロンプト定義（12種類）
const SEO_TEMPLATE_PROMPTS: Record<string, { title: string; prompt: string; category: string }> = {
  // 1. ChatGPTの使い方（IT/AI）
  'chatgpt': {
    title: 'ChatGPTの使い方',
    category: 'it',
    prompt: buildSeoArticlePrompt({
      headlineText: 'ChatGPTの使い方',
      subheadText: '初心者でも5分でわかる完全ガイド',
      visualConcept: `AIアシスタントとの対話をイメージした、フレンドリーで親しみやすいテック系デザイン。
ChatGPTを象徴するようなAIアイコン（脳+回路、またはスマートなロボットアイコン）を中央上部に配置。
チャットバブルやスパークルで「会話」「ひらめき」を表現。`,
      mainColor: '#2563EB',
      subColors: ['#3B82F6', '#60A5FA', '#DBEAFE'],
      visualElements: [
        'モダンなAI/ロボットアイコンを上部中央に配置',
        'チャットバブル（会話を象徴）',
        'ライトバルブまたはスパークル',
        'サーキットパターン（テック感）',
      ],
      mood: '親しみやすい、教育的、ポジティブ',
      targetAudience: 'ChatGPTを初めて使う人、AI初心者',
    }),
  },

  // 2. Notionの始め方（IT/生産性）
  'notion': {
    title: 'Notionの始め方',
    category: 'it',
    prompt: buildSeoArticlePrompt({
      headlineText: 'Notionの始め方',
      subheadText: '仕事効率が3倍になる活用術',
      visualConcept: `ミニマルで整理されたワークスペースをイメージ。
Notionのブロック構造を連想させる幾何学的なデザイン。
ノートブック、チェックリスト、整理されたブロック要素を配置。`,
      mainColor: '#191919',
      subColors: ['#FFFFFF', '#F7F6F3', '#37352F'],
      visualElements: [
        'ノートブック/ドキュメントアイコン',
        'チェックリストまたはToDoアイコン',
        '整理されたブロック/グリッドパターン',
        'シンプルなワークスペースイメージ',
      ],
      mood: 'クリーン、生産的、プロフェッショナル',
      targetAudience: '仕事の効率化を目指すビジネスパーソン',
    }),
  },

  // 3. 副業の始め方（ビジネス）
  'sidebusiness': {
    title: '副業の始め方',
    category: 'business',
    prompt: buildSeoArticlePrompt({
      headlineText: '副業の始め方',
      subheadText: '会社員でも始められる人気の副業10選',
      visualConcept: `成長と収入増加をイメージした、希望に満ちたデザイン。
ラップトップ、コイン、成長する植物などの要素で「努力」と「成果」を表現。`,
      mainColor: '#059669',
      subColors: ['#10B981', '#D97706', '#FBBF24'],
      visualElements: [
        'ラップトップまたはスマートフォン',
        'コインまたは収入を示すアイコン',
        '成長する植物または上向きの矢印',
        '時計（時間の有効活用）',
      ],
      mood: 'モチベーティング、達成可能、希望に満ちた',
      targetAudience: '副収入を得たい会社員、主婦',
    }),
  },

  // 4. 投資信託の選び方（金融）
  'investment': {
    title: '投資信託の選び方',
    category: 'finance',
    prompt: buildSeoArticlePrompt({
      headlineText: '投資信託の選び方',
      subheadText: '初心者向け失敗しない7つのポイント',
      visualConcept: `信頼性と安定感を表現したプロフェッショナルなデザイン。
チャート、グラフ、シールド（セキュリティ）などで「安心」と「成長」を表現。`,
      mainColor: '#1E3A8A',
      subColors: ['#3B82F6', '#D97706', '#FBBF24'],
      visualElements: [
        '上昇するチャートまたはグラフ',
        'コインまたは資産アイコン',
        'シールド（安全性・セキュリティ）',
        '計算機または分析アイコン',
      ],
      mood: '信頼性がある、教育的、自信を与える',
      targetAudience: '投資初心者、資産運用を始めたい人',
    }),
  },

  // 5. Webデザインの基本（デザイン）
  'webdesign': {
    title: 'Webデザインの基本',
    category: 'design',
    prompt: buildSeoArticlePrompt({
      headlineText: 'Webデザインの基本',
      subheadText: 'センスがなくても大丈夫！基礎から学ぶ',
      visualConcept: `クリエイティブでモダンなデザイン要素を配置。
カラーパレット、ブラウザウィンドウ、デザインツールのアイコンで「創造性」を表現。`,
      mainColor: '#8B5CF6',
      subColors: ['#EC4899', '#3B82F6', '#06B6D4'],
      visualElements: [
        'カラーパレットまたはスウォッチ',
        'ブラウザウィンドウまたはUIフレーム',
        'ペンツールまたはデザインツールアイコン',
        '幾何学的な形状やグラデーション',
      ],
      mood: 'クリエイティブ、インスピレーション、アクセシブル',
      targetAudience: 'Webデザインを学びたい初心者、ノンデザイナー',
    }),
  },

  // 6. SNSマーケティング入門（マーケティング）
  'snsmarketing': {
    title: 'SNSマーケティング入門',
    category: 'marketing',
    prompt: buildSeoArticlePrompt({
      headlineText: 'SNSマーケティング入門',
      subheadText: 'フォロワー1万人達成の戦略とは',
      visualConcept: `ダイナミックでソーシャルな雰囲気のデザイン。
SNSアイコン、吹き出し、エンゲージメント指標などで「つながり」と「拡散」を表現。`,
      mainColor: '#E1306C',
      subColors: ['#833AB4', '#F77737', '#FCAF45'],
      visualElements: [
        'SNSプラットフォームを示すアイコン群',
        '吹き出しまたはコメントアイコン',
        'ハートやいいね、シェアアイコン',
        'フォロワー増加を示す上向き矢印',
      ],
      mood: 'エネルギッシュ、つながり、モダン',
      targetAudience: 'SNS運用を始めたい個人・企業',
    }),
  },

  // 7. プロジェクト管理ツール比較（IT/比較）
  'projecttools': {
    title: 'プロジェクト管理ツール比較',
    category: 'it',
    prompt: buildSeoArticlePrompt({
      headlineText: 'プロジェクト管理ツール比較',
      subheadText: 'Notion vs Asana vs Trello 徹底比較',
      visualConcept: `整理された比較表をイメージしたクリーンなデザイン。
複数のアプリアイコン、比較チャート、チェックマークで「選択」と「最適化」を表現。`,
      mainColor: '#2563EB',
      subColors: ['#64748B', '#0EA5E9', '#22C55E'],
      visualElements: [
        '複数のアプリ/ツールアイコン（並列配置）',
        '比較表またはグリッドレイアウト',
        'チェックマークまたは評価アイコン',
        'ダッシュボードまたはカンバンボード',
      ],
      mood: '客観的、ヘルプフル、包括的',
      targetAudience: 'チーム管理ツールを探しているビジネスパーソン',
    }),
  },

  // 8. 動画編集ソフトおすすめ（クリエイティブ）
  'videoediting': {
    title: '動画編集ソフトおすすめ',
    category: 'creative',
    prompt: buildSeoArticlePrompt({
      headlineText: '動画編集ソフトおすすめ',
      subheadText: '初心者からプロまで使える8選',
      visualConcept: `ダイナミックでクリエイティブな映像制作をイメージ。
フィルムリール、タイムライン、再生ボタンなどで「動画制作」を表現。`,
      mainColor: '#7C3AED',
      subColors: ['#F97316', '#EC4899', '#06B6D4'],
      visualElements: [
        'フィルムリールまたはビデオカメラアイコン',
        '編集タイムラインのビジュアル',
        '再生ボタンまたはプレイアイコン',
        'エフェクトやトランジションを示す波形',
      ],
      mood: 'クリエイティブ、プロフェッショナル、エキサイティング',
      targetAudience: '動画編集を始めたい人、YouTuber志望者',
    }),
  },

  // 9. CRM/MAツール比較（B2B）
  'crmtools': {
    title: 'CRM/MAツール比較',
    category: 'business',
    prompt: buildSeoArticlePrompt({
      headlineText: 'CRM/MAツール比較',
      subheadText: 'Salesforce・HubSpot・Zoho完全比較',
      visualConcept: `コーポレートでプロフェッショナルなB2Bツール比較のイメージ。
ダッシュボード、顧客アイコン、オートメーションビジュアルで「効率化」を表現。`,
      mainColor: '#0891B2',
      subColors: ['#2563EB', '#059669', '#D97706'],
      visualElements: [
        'ダッシュボードまたは分析画面',
        '顧客/ユーザーアイコン群',
        '自動化を示す歯車や矢印',
        'データフローを示す接続線',
      ],
      mood: 'プロフェッショナル、データドリブン、効率的',
      targetAudience: 'B2B企業のマーケター、営業担当者',
    }),
  },

  // 10. DX推進の進め方（ビジネス/企業）
  'dxstrategy': {
    title: 'DX推進の進め方',
    category: 'business',
    prompt: buildSeoArticlePrompt({
      headlineText: 'DX推進の進め方',
      subheadText: '成功企業に学ぶ5つのステップ',
      visualConcept: `デジタルトランスフォーメーションをイメージしたモダンで革新的なデザイン。
デジタル変革ビジュアル、矢印、接続されたノードで「変革」と「進化」を表現。`,
      mainColor: '#1E40AF',
      subColors: ['#3B82F6', '#06B6D4', '#8B5CF6'],
      visualElements: [
        'デジタルトランスフォーメーションを示す変化の矢印',
        '接続されたノードまたはネットワーク図',
        'クラウドまたはデジタルアイコン',
        '上昇するグラフまたは進捗を示すステップ',
      ],
      mood: '進歩的、戦略的、モダン',
      targetAudience: '企業の経営者、DX推進担当者',
    }),
  },

  // 11. SEO完全ガイド（マーケティング）
  'seoguide': {
    title: 'SEO完全ガイド',
    category: 'marketing',
    prompt: buildSeoArticlePrompt({
      headlineText: 'SEO完全ガイド',
      subheadText: '検索順位1位を獲得する方法',
      visualConcept: `デジタルマーケティングとサーチエンジン最適化をイメージ。
検索アイコン、ランキング矢印、キーワードビジュアルで「上位表示」を表現。`,
      mainColor: '#059669',
      subColors: ['#2563EB', '#0EA5E9', '#22C55E'],
      visualElements: [
        '検索アイコンまたは虫眼鏡',
        '上昇するランキング矢印（1位を示す）',
        'キーワードまたはタグのビジュアル',
        'ウェブサイトまたはブラウザアイコン',
      ],
      mood: '包括的、エキスパート、結果重視',
      targetAudience: 'SEOを学びたいマーケター、ブロガー',
    }),
  },

  // 12. 新規事業立ち上げ（スタートアップ）
  'newbusiness': {
    title: '新規事業立ち上げ',
    category: 'business',
    prompt: buildSeoArticlePrompt({
      headlineText: '新規事業立ち上げ',
      subheadText: 'アイデアから実現までの完全ロードマップ',
      visualConcept: `起業とイノベーションをイメージしたダイナミックなデザイン。
ロケット発射、電球、成長チャートで「スタート」と「成長」を表現。`,
      mainColor: '#F97316',
      subColors: ['#2563EB', '#059669', '#FBBF24'],
      visualElements: [
        'ロケット発射または上昇するアイコン',
        '電球またはアイデアを示すアイコン',
        '成長チャートまたは上向きグラフ',
        'ターゲットまたはゴールアイコン',
      ],
      mood: '野心的、エキサイティング、達成可能',
      targetAudience: '起業を考えている人、新規事業担当者',
    }),
  },
}

// テンプレート画像を生成（テキスト込み）
async function generateTemplateImage(
  templateId: string,
  prompt: string,
  category: string,
  title: string
): Promise<string> {
  // タイトルからメインタイトルとサブタイトルを抽出（「｜」や「|」で分割）
  const titleParts = title.split(/[｜|]/).map((s) => s.trim())
  const headlineText = titleParts[0] || title
  const subheadText = titleParts[1] || ''

  const templatePrompt = `${prompt}

=== ADDITIONAL INSTRUCTIONS ===
- Create a professional banner image suitable for an SEO article thumbnail
- Size: 1200x628px (16:9 aspect ratio)
- The Japanese text MUST be rendered clearly and legibly in the image
- Text should be placed in the lower portion of the image with a dark gradient panel behind it
- Keep the design clean and readable at small sizes
- Use modern, professional design aesthetics`

  const result = await generateBanners(
    category,
    headlineText, // キーワードとしてメインタイトルを使用
    '1200x628', // OGP推奨サイズ
    {
      headlineText: headlineText,
      subheadText: subheadText,
      customImagePrompt: templatePrompt,
      purpose: 'article_banner',
    },
    1
  )

  if (result.error) {
    throw new Error(result.error)
  }

  if (!result.banners || result.banners.length === 0) {
    throw new Error('No image generated')
  }

  return result.banners[0]
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

    console.log(`[SEO Template Gen] Generating ${pendingIds.length} templates...`)

    const results: { id: string; status: 'success' | 'error'; error?: string }[] = []

    for (const templateId of pendingIds) {
      const config = SEO_TEMPLATE_PROMPTS[templateId]
      console.log(`[SEO Template Gen] Processing: ${templateId} - ${config.title}`)

      try {
        const imageData = await generateTemplateImage(templateId, config.prompt, config.category, config.title)
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
