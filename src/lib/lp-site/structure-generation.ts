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

標準セクション定義（利用可能なセクションタイプ）:
1. hero (ファーストビュー) - 第一印象で興味を引く、メインキャッチコピー、実績数値
2. stats (実績・数値訴求) - 導入実績、効果数値、信頼指標を示す
3. problem (課題提示) - ターゲットの課題や悩みを明確化
4. solution (ソリューション) - 商品・サービスが課題を解決することを提示
5. features (機能紹介) - 主要機能や特徴を詳しく説明
6. benefit (ベネフィット) - 顧客が得られる利益や価値を強調
7. visual_appeal (商品ビジュアル訴求) - 商品の魅力を視覚的に訴求（EC用）
8. mechanism (仕組み説明) - 商品の仕組み、成分、技術を説明
9. usage (使用イメージ) - 実際の使用シーン、導入事例を提示
10. case_study (導入事例) - 具体的な導入事例、成功事例を紹介
11. trust (信頼訴求) - 選ばれる理由、差別化ポイント、会社情報
12. testimonial (お客様の声) - 顧客の評価、レビュー、推薦
13. comparison (比較表) - 競合との比較、プラン比較
14. pricing (料金) - 料金プラン、価格、特典
15. faq (よくある質問) - FAQ、疑問点への回答
16. process (導入プロセス) - 導入の流れ、利用方法
17. guarantee (保証・特典) - 返金保証、特典、キャンペーン
18. cta (行動喚起) - 購入、問い合わせ、資料請求を促す

LPタイプ別の推奨構成（8-12セクションで構成）:
- saas: hero → stats → problem → solution → features → benefit → case_study → trust → pricing → faq → testimonial → cta
- ec: hero → visual_appeal → problem → benefit → mechanism → usage → testimonial → comparison → pricing → guarantee → trust → cta
- service: hero → stats → problem → solution → benefit → usage → case_study → trust → process → pricing → faq → cta
- recruit: hero → problem → solution → benefit → process → testimonial → trust → faq → cta

重要:
- 参考: https://rdlp.jp/archives/otherdesign/lp/226318 のような長めのLP構成を参考にしてください
- LPタイプと商材ジャンルに応じて、8-12個のセクションで構成してください
- 各セクションは「場所ごとの画像パーツ」として個別生成されます
- section_typeは上記の標準セクション定義から選択してください
- セクションが多いほど、詳細な情報を伝えられ、コンバージョン率が向上します
- 実績数値、導入事例、お客様の声などは信頼性を高める重要なセクションです

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

セクションは8-12個で構成してください。長めのLPで、詳しい情報を伝える構成にしてください。
各セクションに適切なsection_id、section_type、purpose、headline、sub_headline、text_volume、image_requiredを設定してください。
特に、実績数値、導入事例、お客様の声、FAQなどのセクションを含めることで、信頼性が高まります。`

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

