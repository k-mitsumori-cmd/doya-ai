// ============================================
// Step 1: 商品理解フェーズ
// ============================================

import { generateTextWithGemini } from '@/lib/gemini-text'
import { ProductInfo, LpType, Tone } from './types'

/**
 * URLから商品情報を抽出・推定
 */
export async function extractProductInfoFromUrl(url: string): Promise<Partial<ProductInfo>> {
  try {
    // URLからHTMLを取得
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`)
    }
    const html = await response.text()

    // HTMLから情報を抽出
    const extractionPrompt = `以下のHTMLから商品情報を抽出してください。JSON形式で返してください。

HTML:
${html.substring(0, 10000)} // 最初の10000文字のみ

抽出する情報:
- product_name: 商品名・サービス名
- target: ターゲット顧客
- problem: 解決する課題
- solution: 提供価値・ソリューション
- benefit: 顧客が得られる利益
- differentiation: 強み・差別化ポイント
- cta: 行動喚起テキスト（例: "今すぐ無料で始める"）

JSON形式で返してください。抽出できない項目は空文字列にしてください。`

    const extracted = await generateTextWithGemini(extractionPrompt, {})
    
    // JSONをパース
    try {
      const jsonMatch = extracted.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch {
      // JSONパース失敗時はテキストから推測
    }

    return {}
  } catch (error) {
    console.error('URL抽出エラー:', error)
    throw error
  }
}

/**
 * 商品情報を構造化（AI補完付き）
 */
export async function structureProductInfo(
  partialInfo: Partial<ProductInfo>,
  lpType: LpType,
  tone: Tone
): Promise<ProductInfo> {
  const completionPrompt = `以下の商品情報を基に、不足している項目をAIが補完して完全な商品情報を構造化してください。

既存情報:
${JSON.stringify(partialInfo, null, 2)}

LPタイプ: ${lpType}
トーン: ${tone}

以下の形式でJSONを返してください:
{
  "product_name": "商品名（必須）",
  "target": "ターゲット顧客（具体的に）",
  "problem": "解決する課題（明確に）",
  "solution": "提供価値・ソリューション",
  "benefit": "顧客が得られる利益（具体的に）",
  "differentiation": "強み・差別化ポイント",
  "tone": "${tone}",
  "lp_type": "${lpType}",
  "cta": "行動喚起テキスト"
}

不足している項目は、LPタイプとトーンを考慮して適切に補完してください。`

  const completed = await generateTextWithGemini(completionPrompt, {})
  
  try {
    const jsonMatch = completed.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        product_name: parsed.product_name || partialInfo.product_name || '',
        target: parsed.target || partialInfo.target || '',
        problem: parsed.problem || partialInfo.problem || '',
        solution: parsed.solution || partialInfo.solution || '',
        benefit: parsed.benefit || partialInfo.benefit || '',
        differentiation: parsed.differentiation || partialInfo.differentiation || '',
        tone: parsed.tone || tone,
        lp_type: parsed.lp_type || lpType,
        cta: parsed.cta || partialInfo.cta || '今すぐ始める',
      }
    }
  } catch {
    // パース失敗時は既存情報をベースに構築
  }

  return {
    product_name: partialInfo.product_name || '',
    target: partialInfo.target || '',
    problem: partialInfo.problem || '',
    solution: partialInfo.solution || '',
    benefit: partialInfo.benefit || '',
    differentiation: partialInfo.differentiation || '',
    tone: tone,
    lp_type: lpType,
    cta: partialInfo.cta || '今すぐ始める',
  }
}




