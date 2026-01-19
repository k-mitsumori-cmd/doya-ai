import { NextRequest, NextResponse } from 'next/server'
import { generateBanners } from '@/lib/nanobanner'

export const runtime = 'nodejs'
export const maxDuration = 300

// 大量のプロンプトパターンを定義
const BANNER_TEMPLATE_PROMPTS = [
  // 業種: Web / IT / スクール / 教育
  {
    id: 'it-001',
    industry: 'Web / IT / スクール / 教育',
    category: 'it',
    prompt: 'AIライティングツール おすすめ30選 - SEO重視の選び方と徹底比較。ダークトーン、技術系UI、モダンなデザイン。',
    size: '1200x628',
  },
  {
    id: 'it-002',
    industry: 'Web / IT / スクール / 教育',
    category: 'it',
    prompt: 'プログラミングスクール 徹底比較 - 転職成功率・カリキュラム・料金を完全分析。クリーンで信頼感のあるデザイン。',
    size: '1200x628',
  },
  {
    id: 'it-003',
    industry: 'Web / IT / スクール / 教育',
    category: 'it',
    prompt: 'Web制作ツール 完全ガイド - 初心者からプロまで使えるおすすめツール50選。グラデーション背景、モダンなUI。',
    size: '1200x628',
  },
  // 業種: 転職・採用・人材
  {
    id: 'recruit-001',
    industry: '転職・採用・人材',
    category: 'recruit',
    prompt: 'エンジニア転職 成功の秘訣 - 年収アップ・キャリアチェンジの完全ガイド。プロフェッショナルな印象のデザイン。',
    size: '1200x628',
  },
  {
    id: 'recruit-002',
    industry: '転職・採用・人材',
    category: 'recruit',
    prompt: 'IT企業の採用基準 徹底解説 - 面接対策・ポートフォリオ作成のコツ。信頼感のあるビジネスデザイン。',
    size: '1200x628',
  },
  // 業種: EC / セール / キャンペーン
  {
    id: 'ec-001',
    industry: 'EC / セール / キャンペーン',
    category: 'ec',
    prompt: '期間限定セール開催中 - 最大50%OFF！お得な商品が勢揃い。ビビッドなカラー、目を引くデザイン。',
    size: '1200x628',
  },
  {
    id: 'ec-002',
    industry: 'EC / セール / キャンペーン',
    category: 'ec',
    prompt: '新商品入荷 - 今だけ初回限定特価。プレミアム感のあるデザイン、高級感のある配色。',
    size: '1200x628',
  },
  // 業種: 美容 / コスメ / 健康 / 食品
  {
    id: 'beauty-001',
    industry: '美容 / コスメ / 健康 / 食品',
    category: 'beauty',
    prompt: 'スキンケア 完全ガイド - 効果的なスキンケア方法とおすすめ商品。エレガントで上品なデザイン。',
    size: '1200x628',
  },
  {
    id: 'beauty-002',
    industry: '美容 / コスメ / 健康 / 食品',
    category: 'beauty',
    prompt: '健康食品 選び方ガイド - 栄養バランスと効果を徹底解説。ナチュラルで健康的な印象のデザイン。',
    size: '1200x628',
  },
  // 業種: SaaS / BtoBサービス
  {
    id: 'saas-001',
    industry: 'SaaS / BtoBサービス',
    category: 'it',
    prompt: 'プロジェクト管理ツール 比較 - チーム効率化のための選び方。ビジネス向け、信頼感のあるデザイン。',
    size: '1200x628',
  },
  {
    id: 'saas-002',
    industry: 'SaaS / BtoBサービス',
    category: 'it',
    prompt: 'CRMシステム 導入ガイド - 売上アップのための選び方と比較。プロフェッショナルな印象のデザイン。',
    size: '1200x628',
  },
  // 業種: 情報商材 / ノウハウ / AIツール
  {
    id: 'info-001',
    industry: '情報商材 / ノウハウ / AIツール',
    category: 'it',
    prompt: 'AIツール 完全ガイド - 業務効率化のための選び方と比較。モダンでテクノロジー感のあるデザイン。',
    size: '1200x628',
  },
  {
    id: 'info-002',
    industry: '情報商材 / ノウハウ / AIツール',
    category: 'it',
    prompt: 'マーケティングノウハウ 公開 - 売上を上げるための実践的な方法。知的で信頼感のあるデザイン。',
    size: '1200x628',
  },
]

// さらにバリエーションを追加（合計50-100個程度）
const generateMoreVariations = () => {
  const variations: typeof BANNER_TEMPLATE_PROMPTS = []
  const industries = [
    'Web / IT / スクール / 教育',
    '転職・採用・人材',
    'EC / セール / キャンペーン',
    '美容 / コスメ / 健康 / 食品',
    'SaaS / BtoBサービス',
    '情報商材 / ノウハウ / AIツール',
  ]
  const categories = ['it', 'recruit', 'ec', 'beauty', 'it', 'it']
  const titles = [
    'おすすめツール 完全ガイド',
    '徹底比較 決定版',
    '選び方と比較',
    '成功の秘訣',
    '導入ガイド',
    '完全解説',
  ]

  for (let i = 0; i < 50; i++) {
    const industryIndex = i % industries.length
    variations.push({
      id: `template-${String(i + 10).padStart(3, '0')}`,
      industry: industries[industryIndex],
      category: categories[industryIndex],
      prompt: `${titles[i % titles.length]} - ${industries[industryIndex]}向けの最新情報。モダンで洗練されたデザイン。`,
      size: '1200x628',
    })
  }
  return variations
}

// GET: テンプレート一覧を取得
export async function GET(request: NextRequest) {
  try {
    const allTemplates = [...BANNER_TEMPLATE_PROMPTS, ...generateMoreVariations()]
    
    // 実際の画像URLを取得（既に生成済みの場合）
    // TODO: データベースから取得する実装に変更
    
    return NextResponse.json({
      templates: allTemplates.map((t) => ({
        ...t,
        imageUrl: null, // 後で実装
        previewUrl: null,
      })),
      count: allTemplates.length,
    })
  } catch (err: any) {
    console.error('Get templates error:', err)
    return NextResponse.json({ error: err.message || '取得に失敗しました' }, { status: 500 })
  }
}

// POST: テンプレートのバナーを生成（初期データ生成用）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateIds, generateAll = false } = body

    const templatesToGenerate = generateAll
      ? [...BANNER_TEMPLATE_PROMPTS, ...generateMoreVariations()]
      : BANNER_TEMPLATE_PROMPTS.filter((t) => templateIds?.includes(t.id))

    const results = []

    for (const template of templatesToGenerate) {
      try {
        const [width, height] = template.size.split('x')
        const result = await generateBanners(
          template.category as any,
          template.prompt,
          template.size,
          {
            headlineText: template.prompt.split(' - ')[0] || template.prompt,
            customImagePrompt: template.prompt,
            variationMode: 'diverse',
          },
          1
        )

        if (result.banners && result.banners.length > 0) {
          results.push({
            templateId: template.id,
            imageUrl: result.banners[0],
            prompt: template.prompt,
            industry: template.industry,
            category: template.category,
            size: template.size,
          })
        }
      } catch (err: any) {
        console.error(`Template ${template.id} generation failed:`, err)
        // エラーでも続行
      }
    }

    return NextResponse.json({
      generated: results,
      count: results.length,
    })
  } catch (err: any) {
    console.error('Generate templates error:', err)
    return NextResponse.json({ error: err.message || '生成に失敗しました' }, { status: 500 })
  }
}
