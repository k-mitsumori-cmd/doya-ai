// ========================================
// AIバナーコーチ - 独自の付加価値機能
// ========================================
// Geminiの画像生成を超える価値を提供
// 1. バナー品質スコアリング
// 2. 改善提案AI
// 3. A/Bテスト予測
// 4. 業界ベンチマーク比較
// 5. コピーライティング最適化

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ========================================
// バナー品質スコア
// ========================================
export interface BannerScore {
  overall: number // 総合スコア 0-100
  breakdown: {
    visualImpact: number      // 視覚的インパクト
    messageClarity: number    // メッセージの明確さ
    ctaEffectiveness: number  // CTAの効果
    brandConsistency: number  // ブランド一貫性
    targetRelevance: number   // ターゲット適合性
  }
  strengths: string[]         // 強み
  improvements: string[]      // 改善点
  predictedCTR: string        // 予測CTR範囲
}

export async function analyzeBannerQuality(
  keyword: string,
  category: string,
  useCase: string,
  targetAudience?: string
): Promise<BannerScore> {
  try {
    const prompt = `あなたは広告バナーの専門家です。以下のバナー設定を分析し、品質スコアと改善提案を提供してください。

【バナー設定】
- キーワード/コピー: ${keyword}
- 業種カテゴリ: ${category}
- 用途: ${useCase}
- ターゲット: ${targetAudience || '一般'}

以下のJSON形式で回答してください:
{
  "overall": 75,
  "breakdown": {
    "visualImpact": 80,
    "messageClarity": 70,
    "ctaEffectiveness": 75,
    "brandConsistency": 80,
    "targetRelevance": 70
  },
  "strengths": ["強み1", "強み2"],
  "improvements": ["改善点1", "改善点2", "改善点3"],
  "predictedCTR": "0.8% - 1.2%"
}

各スコアは0-100で評価。具体的で実用的なフィードバックを提供してください。`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    return result as BannerScore

  } catch (error) {
    console.error('Banner analysis error:', error)
    // フォールバック
    return {
      overall: 70,
      breakdown: {
        visualImpact: 70,
        messageClarity: 70,
        ctaEffectiveness: 70,
        brandConsistency: 70,
        targetRelevance: 70,
      },
      strengths: ['キーワードが明確', 'ターゲットに適合'],
      improvements: ['より具体的な数字を追加', 'CTAを強調', '緊急性を追加'],
      predictedCTR: '0.5% - 1.0%',
    }
  }
}

// ========================================
// コピー改善AI
// ========================================
export interface CopyVariations {
  original: string
  variations: {
    type: string      // 'benefit' | 'urgency' | 'social_proof' | 'question' | 'emotional'
    copy: string
    reason: string
    expectedLift: string
  }[]
  bestPick: {
    copy: string
    reason: string
  }
}

export async function generateCopyVariations(
  originalCopy: string,
  category: string,
  useCase: string
): Promise<CopyVariations> {
  try {
    const prompt = `あなたは広告コピーライターの専門家です。以下のコピーを分析し、5つの異なるアプローチで改善案を提案してください。

【元のコピー】
${originalCopy}

【業種】${category}
【用途】${useCase}

以下のJSON形式で回答:
{
  "original": "${originalCopy}",
  "variations": [
    {
      "type": "benefit",
      "copy": "ベネフィット訴求のコピー",
      "reason": "なぜこれが効果的か",
      "expectedLift": "+15%"
    },
    {
      "type": "urgency",
      "copy": "緊急性訴求のコピー",
      "reason": "なぜこれが効果的か",
      "expectedLift": "+20%"
    },
    {
      "type": "social_proof",
      "copy": "社会的証明のコピー",
      "reason": "なぜこれが効果的か",
      "expectedLift": "+10%"
    },
    {
      "type": "question",
      "copy": "質問形式のコピー",
      "reason": "なぜこれが効果的か",
      "expectedLift": "+12%"
    },
    {
      "type": "emotional",
      "copy": "感情訴求のコピー",
      "reason": "なぜこれが効果的か",
      "expectedLift": "+18%"
    }
  ],
  "bestPick": {
    "copy": "最も効果的と思われるコピー",
    "reason": "選んだ理由"
  }
}

日本語で、実際に使える具体的なコピーを提案してください。`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    })

    return JSON.parse(response.choices[0].message.content || '{}') as CopyVariations

  } catch (error) {
    console.error('Copy variations error:', error)
    return {
      original: originalCopy,
      variations: [
        { type: 'benefit', copy: `${originalCopy}で成果UP`, reason: 'ベネフィットを明確に', expectedLift: '+15%' },
        { type: 'urgency', copy: `【本日限定】${originalCopy}`, reason: '緊急性を追加', expectedLift: '+20%' },
        { type: 'social_proof', copy: `10,000社が選んだ${originalCopy}`, reason: '信頼性を追加', expectedLift: '+10%' },
        { type: 'question', copy: `まだ${originalCopy}してないの？`, reason: '問いかけで関心を引く', expectedLift: '+12%' },
        { type: 'emotional', copy: `もう悩まない。${originalCopy}`, reason: '感情に訴える', expectedLift: '+18%' },
      ],
      bestPick: {
        copy: `【本日限定】${originalCopy}`,
        reason: '緊急性が最もCTRを高める傾向',
      },
    }
  }
}

// ========================================
// 業界ベンチマーク
// ========================================
export interface IndustryBenchmark {
  category: string
  averageCTR: string
  topPerformerCTR: string
  commonPatterns: string[]
  avoidPatterns: string[]
  seasonalTrends: {
    month: string
    trend: string
  }[]
  colorRecommendations: {
    primary: string
    accent: string
    reason: string
  }
}

export const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
  telecom: {
    category: '通信・モバイル',
    averageCTR: '0.8%',
    topPerformerCTR: '2.5%',
    commonPatterns: [
      '料金の明確な表示（月額○○円〜）',
      '速度・容量の数値訴求',
      'キャンペーン期間の明示',
      '乗り換えメリットの強調',
    ],
    avoidPatterns: [
      '複雑な料金体系の詰め込み',
      '小さすぎる注釈',
      '競合への直接的な攻撃',
    ],
    seasonalTrends: [
      { month: '3-4月', trend: '新生活キャンペーンが効果的' },
      { month: '9月', trend: '新iPhone発売に合わせた訴求' },
      { month: '12月', trend: '年末商戦・ボーナス訴求' },
    ],
    colorRecommendations: {
      primary: '#3B82F6 (ブルー)',
      accent: '#06B6D4 (シアン)',
      reason: '信頼性と先進性を表現',
    },
  },
  marketing: {
    category: 'マーケティング・BtoB',
    averageCTR: '0.5%',
    topPerformerCTR: '1.8%',
    commonPatterns: [
      '具体的な成果数値（売上○○%UP）',
      '無料トライアル・資料請求CTA',
      '導入企業ロゴの掲載',
      'ホワイトペーパー訴求',
    ],
    avoidPatterns: [
      '抽象的な表現のみ',
      '専門用語の多用',
      'CTAが不明確',
    ],
    seasonalTrends: [
      { month: '1-2月', trend: '新年度予算獲得に向けた訴求' },
      { month: '6月', trend: '上半期振り返り・改善提案' },
      { month: '10-11月', trend: '来期予算確保に向けた訴求' },
    ],
    colorRecommendations: {
      primary: '#8B5CF6 (パープル)',
      accent: '#EC4899 (ピンク)',
      reason: '革新性と専門性を表現',
    },
  },
  ec: {
    category: 'EC・通販',
    averageCTR: '1.2%',
    topPerformerCTR: '3.5%',
    commonPatterns: [
      '割引率の大きな表示（MAX○○%OFF）',
      '期間限定の緊急性',
      '送料無料の訴求',
      '商品画像の魅力的な見せ方',
    ],
    avoidPatterns: [
      '割引率が小さすぎる',
      '商品が見えにくい',
      '信頼性要素の欠如',
    ],
    seasonalTrends: [
      { month: '11月', trend: 'ブラックフライデー・サイバーマンデー' },
      { month: '12月', trend: '年末商戦・クリスマス' },
      { month: '7月', trend: '夏のセール・お中元' },
    ],
    colorRecommendations: {
      primary: '#EF4444 (レッド)',
      accent: '#F97316 (オレンジ)',
      reason: '購買意欲と緊急性を刺激',
    },
  },
  recruit: {
    category: '採用・人材',
    averageCTR: '0.6%',
    topPerformerCTR: '2.0%',
    commonPatterns: [
      '給与・待遇の明確な表示',
      '働く人の写真・声',
      '成長機会の訴求',
      'カジュアル面談への誘導',
    ],
    avoidPatterns: [
      '条件が不明確',
      'ストックフォト感',
      '堅すぎる表現',
    ],
    seasonalTrends: [
      { month: '1-3月', trend: '新卒採用ピーク' },
      { month: '9-10月', trend: '中途採用活性化' },
      { month: '6月', trend: 'インターン募集' },
    ],
    colorRecommendations: {
      primary: '#22C55E (グリーン)',
      accent: '#3B82F6 (ブルー)',
      reason: '成長と安定を表現',
    },
  },
  beauty: {
    category: '美容・コスメ',
    averageCTR: '1.0%',
    topPerformerCTR: '3.0%',
    commonPatterns: [
      'ビフォーアフターの視覚化',
      '成分・効果の科学的訴求',
      'インフルエンサー起用',
      '初回限定価格',
    ],
    avoidPatterns: [
      '過度な加工感',
      '効果の誇大表現',
      'ターゲット年齢のミスマッチ',
    ],
    seasonalTrends: [
      { month: '3-4月', trend: '春の新作・UV対策' },
      { month: '11-12月', trend: 'クリスマスコフレ' },
      { month: '6-7月', trend: '夏のスキンケア' },
    ],
    colorRecommendations: {
      primary: '#EC4899 (ピンク)',
      accent: '#F9A8D4 (ライトピンク)',
      reason: '女性らしさと上品さを表現',
    },
  },
  food: {
    category: '飲食・フード',
    averageCTR: '1.5%',
    topPerformerCTR: '4.0%',
    commonPatterns: [
      'シズル感のある食品写真',
      '期間限定メニュー',
      'クーポン・割引訴求',
      '口コミ・評価の表示',
    ],
    avoidPatterns: [
      '美味しそうに見えない写真',
      '情報過多',
      '価格が不明確',
    ],
    seasonalTrends: [
      { month: '12月', trend: '忘年会・クリスマス' },
      { month: '3-4月', trend: '歓送迎会' },
      { month: '7-8月', trend: '夏限定メニュー' },
    ],
    colorRecommendations: {
      primary: '#EF4444 (レッド)',
      accent: '#F97316 (オレンジ)',
      reason: '食欲を刺激する暖色系',
    },
  },
}

export function getIndustryBenchmark(category: string): IndustryBenchmark | null {
  return INDUSTRY_BENCHMARKS[category] || null
}

// ========================================
// A/Bテスト予測
// ========================================
export interface ABTestPrediction {
  bannerA: {
    label: string
    predictedCTR: string
    confidence: number
    strengths: string[]
  }
  bannerB: {
    label: string
    predictedCTR: string
    confidence: number
    strengths: string[]
  }
  bannerC: {
    label: string
    predictedCTR: string
    confidence: number
    strengths: string[]
  }
  recommendation: {
    winner: 'A' | 'B' | 'C'
    reason: string
    testDuration: string
    sampleSize: string
  }
}

export function predictABTestResults(
  category: string,
  appealTypes: string[]
): ABTestPrediction {
  const benchmark = INDUSTRY_BENCHMARKS[category] || INDUSTRY_BENCHMARKS.marketing
  const baseCTR = parseFloat(benchmark.averageCTR)
  
  return {
    bannerA: {
      label: 'ベネフィット訴求',
      predictedCTR: `${(baseCTR * 1.1).toFixed(2)}%`,
      confidence: 72,
      strengths: ['価値が明確', '長期的な効果'],
    },
    bannerB: {
      label: '緊急性訴求',
      predictedCTR: `${(baseCTR * 1.3).toFixed(2)}%`,
      confidence: 78,
      strengths: ['即座のアクション促進', '短期的に高いCTR'],
    },
    bannerC: {
      label: '信頼性訴求',
      predictedCTR: `${(baseCTR * 1.15).toFixed(2)}%`,
      confidence: 70,
      strengths: ['CVR向上に貢献', 'ブランド構築'],
    },
    recommendation: {
      winner: 'B',
      reason: '緊急性訴求は初期CTRが最も高い傾向。ただし、長期的なブランド構築にはA案も並行テストを推奨。',
      testDuration: '7-14日間',
      sampleSize: '各案1,000インプレッション以上',
    },
  }
}

// ========================================
// カラーパレット提案
// ========================================
export interface ColorPalette {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
  cta: string
  psychology: string
}

export function suggestColorPalette(category: string, mood: string): ColorPalette {
  const palettes: Record<string, ColorPalette> = {
    professional: {
      primary: '#1E40AF',
      secondary: '#3B82F6',
      accent: '#F59E0B',
      background: '#F8FAFC',
      text: '#1E293B',
      cta: '#DC2626',
      psychology: '信頼性と専門性を表現。CTAの赤で行動を促進。',
    },
    energetic: {
      primary: '#DC2626',
      secondary: '#F97316',
      accent: '#FBBF24',
      background: '#FFFBEB',
      text: '#1C1917',
      cta: '#16A34A',
      psychology: '活力と緊急性を表現。緑のCTAで安心感を追加。',
    },
    elegant: {
      primary: '#7C3AED',
      secondary: '#A855F7',
      accent: '#F472B6',
      background: '#FAF5FF',
      text: '#1E1B4B',
      cta: '#DB2777',
      psychology: '高級感と洗練を表現。ピンクのCTAで女性的な魅力。',
    },
    natural: {
      primary: '#059669',
      secondary: '#10B981',
      accent: '#84CC16',
      background: '#F0FDF4',
      text: '#14532D',
      cta: '#EA580C',
      psychology: '自然と健康を表現。オレンジのCTAで活力を追加。',
    },
    tech: {
      primary: '#6366F1',
      secondary: '#8B5CF6',
      accent: '#06B6D4',
      background: '#0F172A',
      text: '#F1F5F9',
      cta: '#22D3EE',
      psychology: '革新性と先進性を表現。シアンのCTAで未来感。',
    },
  }

  return palettes[mood] || palettes.professional
}

