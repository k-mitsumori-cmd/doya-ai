// ============================================
// Step 2: LP構成生成フェーズ
// ============================================

import { generateTextWithGemini } from '@/lib/gemini-text'
import { ProductInfo, LpSection } from './types'

/**
 * LP構成を生成
 */
export async function generateLpStructure(productInfo: ProductInfo): Promise<LpSection[]> {
  const prompt = `以下の商品情報を基に、効果的なLP構成を生成してください。

商品情報:
- 商品名: ${productInfo.product_name}
- ターゲット: ${productInfo.target}
- 課題: ${productInfo.problem}
- ソリューション: ${productInfo.solution}
- 利益: ${productInfo.benefit}
- 差別化: ${productInfo.differentiation}
- LPタイプ: ${productInfo.lp_type}
- トーン: ${productInfo.tone}

標準セクション定義（参考）:
1. ファーストビュー（FV） - 第一印象で興味を引く
2. 商品ビジュアル訴求 - 商品の魅力を視覚的に訴求
3. キャッチコピー強調 - 強力なメッセージを伝える
4. 特徴・ベネフィット - 商品の価値を説明
5. 成分・仕組み説明 - 商品の仕組みや成分を説明
6. 使用イメージ - 実際の使用シーンを提示
7. 開発者・信頼訴求 - 信頼性を高める
8. 使用方法・ワンポイント - 使い方を説明
9. 商品情報・CTA - 購入を促す

LPタイプ別の推奨構成（標準セクションを組み合わせて）:
- saas: FV → 課題提示 → ソリューション → 機能紹介 → 料金 → お客様の声 → CTA
- ec: FV → 商品ビジュアル → 特徴・ベネフィット → 使用イメージ → お客様の声 → 商品情報・CTA
- service: FV → サービス内容 → メリット → 実績 → 料金 → CTA
- recruit: FV → 会社紹介 → 募集要項 → 福利厚生 → 応募方法 → CTA

重要:
- LPタイプと商材ジャンルに応じてセクションを増減・入替してください
- 各セクションは「場所ごとの画像パーツ」として個別生成されます
- section_typeは標準セクション定義に合わせて設定してください

以下のJSON形式で返してください:
[
  {
    "section_id": "hero",
    "section_type": "hero",
    "purpose": "第一印象で興味を引く",
    "headline": "メインキャッチコピー",
    "sub_headline": "サブコピー（任意）",
    "text_volume": 100,
    "image_required": true
  },
  {
    "section_id": "problem",
    "section_type": "problem",
    "purpose": "課題を明確化",
    "headline": "セクション見出し",
    "sub_headline": "説明文",
    "text_volume": 300,
    "image_required": false
  },
  ...
]

セクションは5-8個程度で構成してください。各セクションに適切なsection_id、section_type、purpose、headline、sub_headline、text_volume、image_requiredを設定してください。`

  const result = await generateTextWithGemini(prompt, {})
  
  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const sections = JSON.parse(jsonMatch[0]) as LpSection[]
      // バリデーション
      return sections.map((s, i) => ({
        section_id: s.section_id || `section_${i}`,
        section_type: s.section_type || 'content',
        purpose: s.purpose || '',
        headline: s.headline || '',
        sub_headline: s.sub_headline,
        text_volume: s.text_volume || 200,
        image_required: s.image_required ?? true,
      }))
    }
  } catch (error) {
    console.error('LP構成パースエラー:', error)
  }

  // フォールバック: デフォルト構成
  return getDefaultStructure(productInfo)
}

/**
 * デフォルト構成（フォールバック用）
 */
function getDefaultStructure(productInfo: ProductInfo): LpSection[] {
  const base: LpSection[] = [
    {
      section_id: 'hero',
      section_type: 'hero',
      purpose: '第一印象で興味を引く',
      headline: productInfo.product_name,
      sub_headline: productInfo.solution,
      text_volume: 100,
      image_required: true,
    },
  ]

  if (productInfo.lp_type === 'saas') {
    base.push(
      {
        section_id: 'problem',
        section_type: 'problem',
        purpose: '課題を明確化',
        headline: 'こんな課題ありませんか？',
        text_volume: 300,
        image_required: false,
      },
      {
        section_id: 'solution',
        section_type: 'solution',
        purpose: 'ソリューション提示',
        headline: `${productInfo.product_name}が解決します`,
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'features',
        section_type: 'features',
        purpose: '機能紹介',
        headline: '主な機能',
        text_volume: 500,
        image_required: true,
      },
      {
        section_id: 'pricing',
        section_type: 'pricing',
        purpose: '料金提示',
        headline: '料金プラン',
        text_volume: 300,
        image_required: false,
      },
      {
        section_id: 'cta',
        section_type: 'cta',
        purpose: '行動喚起',
        headline: productInfo.cta || '今すぐ始める',
        text_volume: 50,
        image_required: false,
      }
    )
  }

  return base
}

