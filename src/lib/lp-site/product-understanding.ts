// ============================================
// Step 1: 商品理解フェーズ
// ============================================

import { generateTextWithGemini } from '@/lib/gemini-text'
import { ProductInfo, LpType, Tone, BrandColors } from './types'

// カラー関連のユーティリティ関数
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

function colorDistance(a: string, b: string): number {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return 999
  const dr = ra.r - rb.r
  const dg = ra.g - rb.g
  const db = ra.b - rb.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function isNearNeutralHex(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  const { r, g, b } = rgb
  // 彩度が低い（グレー系）かどうか
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const saturation = max === 0 ? 0 : (max - min) / max
  // 明度が極端（白/黒に近い）かどうか
  const brightness = (r + g + b) / 3
  return saturation < 0.15 || brightness > 240 || brightness < 15
}

/**
 * HTMLからCSSカラーを抽出
 */
function extractColorsFromHtml(html: string): { hex: string; weight: number }[] {
  const colors: { hex: string; weight: number }[] = []
  
  // インラインスタイルからカラーを抽出
  const stylePatterns = [
    /background-color:\s*([^;}"']+)/gi,
    /background:\s*([^;}"']+)/gi,
    /color:\s*([^;}"']+)/gi,
    /border-color:\s*([^;}"']+)/gi,
  ]
  
  for (const pattern of stylePatterns) {
    let match
    while ((match = pattern.exec(html)) !== null) {
      const colorValue = match[1].trim()
      const hex = parseColorToHex(colorValue)
      if (hex) {
        colors.push({ hex, weight: 1 })
      }
    }
  }
  
  // CSSクラスやスタイルタグ内のカラーを抽出
  const cssColorPattern = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g
  let cssMatch
  while ((cssMatch = cssColorPattern.exec(html)) !== null) {
    let hex = cssMatch[0].toUpperCase()
    // 3桁を6桁に変換
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    }
    colors.push({ hex, weight: 1 })
  }
  
  // rgb/rgba形式を抽出
  const rgbPattern = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi
  let rgbMatch
  while ((rgbMatch = rgbPattern.exec(html)) !== null) {
    const r = parseInt(rgbMatch[1])
    const g = parseInt(rgbMatch[2])
    const b = parseInt(rgbMatch[3])
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
      colors.push({ hex: rgbToHex(r, g, b), weight: 1 })
    }
  }
  
  return colors
}

/**
 * カラー値をHEXに変換
 */
function parseColorToHex(colorValue: string): string | null {
  // HEX形式
  if (colorValue.startsWith('#')) {
    let hex = colorValue.toUpperCase()
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
    }
    if (/^#[0-9A-F]{6}$/.test(hex)) {
      return hex
    }
  }
  
  // rgb/rgba形式
  const rgbMatch = colorValue.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1])
    const g = parseInt(rgbMatch[2])
    const b = parseInt(rgbMatch[3])
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
      return rgbToHex(r, g, b)
    }
  }
  
  return null
}

/**
 * 抽出したカラーを集計してブランドカラーを決定
 */
function analyzeBrandColors(colors: { hex: string; weight: number }[]): BrandColors {
  // カラーを集計
  const colorMap = new Map<string, number>()
  for (const { hex, weight } of colors) {
    if (!/^#[0-9A-F]{6}$/.test(hex)) continue
    colorMap.set(hex, (colorMap.get(hex) || 0) + weight)
  }
  
  // 出現頻度でソート
  const sortedColors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
  
  // 中立色（白/黒/グレー）を除外してメインカラーを決定
  const colorfulColors = sortedColors.filter(hex => !isNearNeutralHex(hex))
  const neutralColors = sortedColors.filter(hex => isNearNeutralHex(hex))
  
  const mainColor = colorfulColors[0] || neutralColors[0]
  
  // サブカラーを決定（メインカラーと十分に異なる色）
  const subColors: string[] = []
  for (const hex of colorfulColors.slice(1)) {
    if (subColors.length >= 3) break
    if (mainColor && colorDistance(mainColor, hex) < 50) continue
    if (subColors.some(s => colorDistance(s, hex) < 50)) continue
    subColors.push(hex)
  }
  
  // アクセントカラー（最も彩度が高い色）
  let accentColor: string | undefined
  let maxSaturation = 0
  for (const hex of colorfulColors) {
    const rgb = hexToRgb(hex)
    if (!rgb) continue
    const max = Math.max(rgb.r, rgb.g, rgb.b)
    const min = Math.min(rgb.r, rgb.g, rgb.b)
    const saturation = max === 0 ? 0 : (max - min) / max
    if (saturation > maxSaturation && hex !== mainColor) {
      maxSaturation = saturation
      accentColor = hex
    }
  }
  
  // カラーサマリーを生成
  const allColors = [mainColor, ...subColors].filter(Boolean)
  const colorSummary = allColors.length > 0
    ? `メインカラー: ${mainColor || 'なし'}, サブカラー: ${subColors.join(', ') || 'なし'}, アクセント: ${accentColor || 'なし'}`
    : ''
  
  return {
    main_color: mainColor,
    sub_colors: subColors,
    accent_color: accentColor,
    color_summary: colorSummary,
  }
}

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

    // HTMLからカラーを抽出
    console.log('[LP-SITE] HTMLからカラーを抽出中...')
    const extractedColors = extractColorsFromHtml(html)
    const brandColors = analyzeBrandColors(extractedColors)
    console.log('[LP-SITE] 抽出されたブランドカラー:', brandColors)

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
        const parsed = JSON.parse(jsonMatch[0])
        // ブランドカラー情報を追加
        return {
          ...parsed,
          brand_colors: brandColors,
        }
      }
    } catch {
      // JSONパース失敗時はテキストから推測
    }

    return {
      brand_colors: brandColors,
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
        brand_colors: partialInfo.brand_colors, // ブランドカラーを保持
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
    brand_colors: partialInfo.brand_colors, // ブランドカラーを保持
  }
}




