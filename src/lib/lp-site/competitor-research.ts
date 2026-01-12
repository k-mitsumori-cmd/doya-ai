// ============================================
// 競合調査機能
// ============================================

import { generateTextWithGemini } from '@/lib/gemini-text'
import { ProductInfo } from './types'

export interface CompetitorInfo {
  service_name: string
  service_url?: string
  features: string[]
  lp_content?: string
  strengths?: string[]
  differentiation_points?: string[]
}

export interface CompetitorResearchResult {
  competitors: CompetitorInfo[]
  summary?: string
  differentiation_strategy?: string
}

/**
 * 類似サービスを検索して競合情報を取得
 * 浅めのキーワードで類似サービスを調べる
 */
export async function researchCompetitors(productInfo: ProductInfo): Promise<CompetitorResearchResult> {
  try {
    // 商品名やターゲットから類似サービスを検索するキーワードを生成
    const searchKeywords = generateSearchKeywords(productInfo)
    
    // 競合調査プロンプト
    const researchPrompt = `以下の商品情報を基に、類似サービス・競合サービスの情報を調査してください。

商品情報:
- 商品名: ${productInfo.product_name}
- ターゲット: ${productInfo.target}
- 提供価値: ${productInfo.solution}
- 業界: ${productInfo.lp_type}

検索キーワード: ${searchKeywords.join(', ')}

以下の形式でJSONを返してください:
{
  "competitors": [
    {
      "service_name": "サービス名",
      "service_url": "サービスURL（可能であれば）",
      "features": ["特徴1", "特徴2", "特徴3"],
      "lp_content": "LPの主な内容や訴求ポイント",
      "strengths": ["強み1", "強み2"],
      "differentiation_points": ["差別化ポイント1", "差別化ポイント2"]
    }
  ],
  "summary": "競合分析の要約",
  "differentiation_strategy": "差別化戦略の提案"
}

3-5個の類似サービスを調査してください。直接の競合だけでなく、関連するサービスも含めてください。`

    const result = await generateTextWithGemini(researchPrompt, {})
    
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as CompetitorResearchResult
        return parsed
      }
    } catch (parseError) {
      console.error('競合調査JSONパースエラー:', parseError)
    }

    // フォールバック: 空の結果を返す
    return {
      competitors: [],
      summary: '競合調査を完了できませんでした',
    }
  } catch (error) {
    console.error('競合調査エラー:', error)
    return {
      competitors: [],
      summary: '競合調査中にエラーが発生しました',
    }
  }
}

/**
 * 商品情報から検索キーワードを生成
 * 浅めのキーワードで類似サービスを調べる
 */
function generateSearchKeywords(productInfo: ProductInfo): string[] {
  const keywords: string[] = []
  
  // 商品名から主要キーワードを抽出
  if (productInfo.product_name) {
    // 商品名の主要部分を抽出（3-5文字程度）
    const nameKeywords = productInfo.product_name
      .replace(/[（）()【】\[\]「」]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && w.length <= 10)
      .slice(0, 3)
    keywords.push(...nameKeywords)
  }
  
  // ターゲットからキーワードを抽出
  if (productInfo.target) {
    const targetKeywords = productInfo.target
      .replace(/[向け|対象|の]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2 && w.length <= 8)
      .slice(0, 2)
    keywords.push(...targetKeywords)
  }
  
  // LPタイプからキーワードを追加
  const lpTypeKeywords: Record<string, string[]> = {
    saas: ['SaaS', 'クラウド', '業務効率化'],
    ec: ['EC', '通販', 'オンラインショップ'],
    service: ['サービス', 'コンサル', 'サポート'],
    recruit: ['採用', '求人', '人材'],
    education: ['教育', '学習', 'スクール'],
    beauty: ['美容', 'コスメ', 'スキンケア'],
    healthcare: ['医療', '健康', 'ヘルスケア'],
    finance: ['金融', '投資', '資産運用'],
  }
  
  if (lpTypeKeywords[productInfo.lp_type]) {
    keywords.push(...lpTypeKeywords[productInfo.lp_type])
  }
  
  // 重複を除去
  return Array.from(new Set(keywords)).slice(0, 5)
}

