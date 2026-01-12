// ============================================
// Step 2: LP構成生成フェーズ
// ============================================

import { generateTextWithGemini } from '@/lib/gemini-text'
import { ProductInfo, LpSection } from './types'
import { enhancePromptWithArchive } from './prompt-templates'

/**
 * LP構成を生成
 */
export async function generateLpStructure(productInfo: ProductInfo): Promise<LpSection[]> {
  let prompt = `以下の商品情報を基に、効果的なLP構成を生成してください。

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
- CTAボタンは「cta」タイプのセクションにのみ含めてください
- hero、problem、solution、benefitなどのセクションにはCTAボタンを含めないでください
- CTAセクションは通常、LPの最後に1つだけ配置してください

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

  // LPアーカイブの学習データを基にプロンプトを強化
  prompt = enhancePromptWithArchive(prompt, productInfo)

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
        section_id: 'stats',
        section_type: 'stats',
        purpose: '実績・数値訴求',
        headline: '多くの企業に選ばれています',
        sub_headline: '導入実績や効果を数値で示す',
        text_volume: 200,
        image_required: true,
      },
      {
        section_id: 'problem',
        section_type: 'problem',
        purpose: '課題を明確化',
        headline: 'こんな課題ありませんか？',
        sub_headline: productInfo.problem || '業務効率化に悩んでいませんか？',
        text_volume: 300,
        image_required: false,
      },
      {
        section_id: 'solution',
        section_type: 'solution',
        purpose: 'ソリューション提示',
        headline: `${productInfo.product_name}が解決します`,
        sub_headline: productInfo.solution,
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'features',
        section_type: 'features',
        purpose: '機能紹介',
        headline: '主な機能',
        sub_headline: '充実した機能で業務を効率化',
        text_volume: 500,
        image_required: true,
      },
      {
        section_id: 'benefit',
        section_type: 'benefit',
        purpose: 'ベネフィット訴求',
        headline: '導入することで得られるメリット',
        sub_headline: productInfo.benefit || '業務効率化とコスト削減を実現',
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'case_study',
        section_type: 'case_study',
        purpose: '導入事例',
        headline: '導入事例',
        sub_headline: '実際の導入事例をご紹介',
        text_volume: 500,
        image_required: true,
      },
      {
        section_id: 'trust',
        section_type: 'trust',
        purpose: '信頼訴求・選ばれる理由',
        headline: '選ばれる理由',
        sub_headline: productInfo.differentiation || '他社との違い',
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'pricing',
        section_type: 'pricing',
        purpose: '料金提示',
        headline: '料金プラン',
        sub_headline: 'シンプルでわかりやすい料金体系',
        text_volume: 300,
        image_required: false,
      },
      {
        section_id: 'testimonial',
        section_type: 'testimonial',
        purpose: 'お客様の声',
        headline: 'お客様の声',
        sub_headline: '導入企業様からの評価',
        text_volume: 400,
        image_required: false,
      },
      {
        section_id: 'faq',
        section_type: 'faq',
        purpose: 'よくある質問',
        headline: 'よくある質問',
        sub_headline: '導入前に知っておきたいポイント',
        text_volume: 500,
        image_required: false,
      },
      {
        section_id: 'cta',
        section_type: 'cta',
        purpose: '行動喚起',
        headline: productInfo.cta || '今すぐ始める',
        sub_headline: '無料でお試しいただけます',
        text_volume: 50,
        image_required: false,
      }
    )
  } else if (productInfo.lp_type === 'ec') {
    base.push(
      {
        section_id: 'visual_appeal',
        section_type: 'visual_appeal',
        purpose: '商品ビジュアル訴求',
        headline: '商品の魅力',
        sub_headline: '高品質な商品をお届けします',
        text_volume: 200,
        image_required: true,
      },
      {
        section_id: 'problem',
        section_type: 'problem',
        purpose: '課題提示',
        headline: productInfo.problem || 'こんなお悩みありませんか？',
        text_volume: 300,
        image_required: false,
      },
      {
        section_id: 'benefit',
        section_type: 'benefit',
        purpose: 'ベネフィット訴求',
        headline: productInfo.benefit || '商品の特徴',
        sub_headline: '選ばれる理由',
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'mechanism',
        section_type: 'mechanism',
        purpose: '仕組み・成分説明',
        headline: '商品の仕組み',
        sub_headline: '品質へのこだわり',
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'usage',
        section_type: 'usage',
        purpose: '使用イメージ',
        headline: '使用イメージ',
        sub_headline: '実際の使用シーン',
        text_volume: 300,
        image_required: true,
      },
      {
        section_id: 'testimonial',
        section_type: 'testimonial',
        purpose: 'お客様の声',
        headline: 'お客様の声',
        sub_headline: '実際にお使いいただいたお客様の評価',
        text_volume: 400,
        image_required: false,
      },
      {
        section_id: 'comparison',
        section_type: 'comparison',
        purpose: '比較表',
        headline: '他社との比較',
        sub_headline: '選ばれる理由',
        text_volume: 300,
        image_required: false,
      },
      {
        section_id: 'pricing',
        section_type: 'pricing',
        purpose: '料金・価格',
        headline: '商品情報',
        sub_headline: '価格と特典',
        text_volume: 300,
        image_required: false,
      },
      {
        section_id: 'guarantee',
        section_type: 'guarantee',
        purpose: '保証・特典',
        headline: '安心の保証',
        sub_headline: '返金保証・特典',
        text_volume: 300,
        image_required: false,
      },
      {
        section_id: 'trust',
        section_type: 'trust',
        purpose: '信頼訴求',
        headline: '信頼できる品質',
        sub_headline: productInfo.differentiation || '選ばれる理由',
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'cta',
        section_type: 'cta',
        purpose: '行動喚起',
        headline: productInfo.cta || '今すぐ購入',
        sub_headline: 'お得なキャンペーン実施中',
        text_volume: 50,
        image_required: false,
      }
    )
  } else if (productInfo.lp_type === 'service') {
    base.push(
      {
        section_id: 'stats',
        section_type: 'stats',
        purpose: '実績・数値訴求',
        headline: '実績と信頼',
        sub_headline: '多くのお客様にご利用いただいています',
        text_volume: 200,
        image_required: true,
      },
      {
        section_id: 'problem',
        section_type: 'problem',
        purpose: '課題提示',
        headline: productInfo.problem || 'こんな課題ありませんか？',
        text_volume: 300,
        image_required: false,
      },
      {
        section_id: 'solution',
        section_type: 'solution',
        purpose: 'ソリューション提示',
        headline: 'サービス内容',
        sub_headline: productInfo.solution,
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'benefit',
        section_type: 'benefit',
        purpose: 'ベネフィット訴求',
        headline: productInfo.benefit || 'サービスで得られるメリット',
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'usage',
        section_type: 'usage',
        purpose: '利用イメージ',
        headline: '利用イメージ',
        sub_headline: 'サービスの使い方',
        text_volume: 300,
        image_required: true,
      },
      {
        section_id: 'case_study',
        section_type: 'case_study',
        purpose: '導入事例',
        headline: '導入事例',
        sub_headline: '実際の導入事例',
        text_volume: 500,
        image_required: true,
      },
      {
        section_id: 'trust',
        section_type: 'trust',
        purpose: '信頼訴求',
        headline: '選ばれる理由',
        sub_headline: productInfo.differentiation || '他社との違い',
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'process',
        section_type: 'process',
        purpose: '導入プロセス',
        headline: '導入の流れ',
        sub_headline: '簡単な導入ステップ',
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'pricing',
        section_type: 'pricing',
        purpose: '料金',
        headline: '料金プラン',
        sub_headline: 'シンプルな料金体系',
        text_volume: 300,
        image_required: false,
      },
      {
        section_id: 'faq',
        section_type: 'faq',
        purpose: 'よくある質問',
        headline: 'よくある質問',
        sub_headline: '導入前に知っておきたいポイント',
        text_volume: 500,
        image_required: false,
      },
      {
        section_id: 'cta',
        section_type: 'cta',
        purpose: '行動喚起',
        headline: productInfo.cta || 'お問い合わせ',
        sub_headline: 'お気軽にご相談ください',
        text_volume: 50,
        image_required: false,
      }
    )
  } else {
    // recruit
    base.push(
      {
        section_id: 'problem',
        section_type: 'problem',
        purpose: '課題提示',
        headline: 'こんな経験ありませんか？',
        text_volume: 300,
        image_required: false,
      },
      {
        section_id: 'solution',
        section_type: 'solution',
        purpose: 'ソリューション提示',
        headline: '私たちと一緒に成長しませんか？',
        sub_headline: productInfo.solution,
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'benefit',
        section_type: 'benefit',
        purpose: 'メリット訴求',
        headline: '選ばれる理由',
        sub_headline: productInfo.benefit || '充実した働き環境',
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'process',
        section_type: 'process',
        purpose: '採用プロセス',
        headline: '採用プロセス',
        sub_headline: '応募から入社まで',
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'testimonial',
        section_type: 'testimonial',
        purpose: '社員の声',
        headline: '社員の声',
        sub_headline: '実際に働く社員からのメッセージ',
        text_volume: 400,
        image_required: false,
      },
      {
        section_id: 'trust',
        section_type: 'trust',
        purpose: '会社情報・信頼訴求',
        headline: '会社情報',
        sub_headline: productInfo.differentiation || '私たちについて',
        text_volume: 400,
        image_required: true,
      },
      {
        section_id: 'faq',
        section_type: 'faq',
        purpose: 'よくある質問',
        headline: 'よくある質問',
        sub_headline: '応募前に知っておきたいポイント',
        text_volume: 500,
        image_required: false,
      },
      {
        section_id: 'cta',
        section_type: 'cta',
        purpose: '行動喚起',
        headline: productInfo.cta || '応募する',
        sub_headline: 'エントリーをお待ちしています',
        text_volume: 50,
        image_required: false,
      }
    )
  }

  return base
}

