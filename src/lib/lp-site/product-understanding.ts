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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`)
    }
    const html = await response.text()

    // HTMLからテキストコンテンツを抽出（シンプルな正規表現ベースの抽出）
    // titleタグから商品名を抽出
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''
    
    // meta descriptionから説明を抽出
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : ''
    
    // meta keywordsからキーワードを抽出
    const metaKeywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i)
    const metaKeywords = metaKeywordsMatch ? metaKeywordsMatch[1].trim() : ''
    
    // og:title, og:descriptionからも抽出
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
    const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : ''
    
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    const ogDescription = ogDescMatch ? ogDescMatch[1].trim() : ''
    
    // h1タグから見出しを抽出
    const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi)
    const h1Texts = h1Matches ? h1Matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(t => t.length > 0) : []
    
    // 本文からスクリプトやスタイルタグを除去してテキストを抽出
    const cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    const textContent = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 5000)

    // HTMLから情報を抽出
    const extractionPrompt = `以下のウェブサイト情報から商品情報を抽出してください。JSON形式で返してください。

URL: ${url}
Title: ${title || ogTitle || 'なし'}
Meta Description: ${metaDescription || ogDescription || 'なし'}
Meta Keywords: ${metaKeywords || 'なし'}
H1見出し: ${h1Texts.slice(0, 3).join(', ') || 'なし'}
主要なテキストコンテンツ: ${textContent.substring(0, 3000)}

抽出する情報:
- product_name: 商品名・サービス名（title、h1、og:titleから優先的に抽出）
- target: ターゲット顧客（テキストから「〜向け」「ターゲット」などの記述を探す）
- problem: 解決する課題（「課題」「悩み」「問題」などの記述を探す）
- solution: 提供価値・ソリューション（商品・サービスの説明から抽出）
- benefit: 顧客が得られる利益（「メリット」「効果」「利益」などの記述を探す）
- differentiation: 強み・差別化ポイント（「特徴」「強み」「違い」などの記述を探す）
- cta: 行動喚起テキスト（「今すぐ」「無料」「始める」「申し込む」などのボタンテキスト）

JSON形式で返してください。抽出できない項目は空文字列にしてください。できるだけ具体的な情報を抽出してください。`

    const extracted = await generateTextWithGemini(extractionPrompt, {})
    
    // JSONをパース
    try {
      const jsonMatch = extracted.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        // titleが空の場合は、抽出したproduct_nameまたはtitleを使用
        return {
          ...parsed,
          product_name: parsed.product_name || title || ogTitle || '',
        }
      }
    } catch (parseError) {
      console.error('JSONパースエラー:', parseError)
      // JSONパース失敗時は基本的な情報を返す
      return {
        product_name: title || ogTitle || '',
      }
    }

    // フォールバック: 基本的な情報のみ返す
    return {
      product_name: title || ogTitle || '',
    }
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
<<<<<<< HEAD
=======




>>>>>>> d95c3593108505b4f8da75e5f5c92339c7648b3f
