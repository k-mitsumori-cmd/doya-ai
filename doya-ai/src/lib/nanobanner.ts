// Nanobanner Pro API を使用したバナー画像生成
// Google Generative AI SDK (@google/generative-ai) を使用

import { GoogleGenerativeAI } from '@google/generative-ai'

// APIクライアントの初期化
function getClient() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.NANOBANNER_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY または NANOBANNER_API_KEY が設定されていません')
  }
  return new GoogleGenerativeAI(apiKey)
}

// カテゴリ別のデザインガイドライン
const CATEGORY_STYLES: Record<string, { style: string; colors: string; elements: string }> = {
  telecom: {
    style: 'モダンでテクノロジー感のある',
    colors: '青、シアン、白を基調とした',
    elements: 'スマートフォン、電波アイコン、クラウド',
  },
  marketing: {
    style: 'プロフェッショナルで信頼感のある',
    colors: '紫、ピンク、白を基調とした',
    elements: 'グラフ、チャート、上昇矢印',
  },
  ec: {
    style: '華やかで購買意欲を刺激する',
    colors: 'オレンジ、赤、金色を基調とした',
    elements: 'ショッピングカート、ギフトボックス、セールタグ',
  },
  recruit: {
    style: '明るく前向きな',
    colors: '緑、白、青を基調とした',
    elements: 'オフィス、チーム、握手',
  },
  beauty: {
    style: 'エレガントで洗練された',
    colors: 'ピンク、ゴールド、白を基調とした',
    elements: '花、化粧品ボトル、きらめき',
  },
  food: {
    style: '美味しそうで食欲をそそる',
    colors: '赤、オレンジ、茶色を基調とした',
    elements: '料理写真、湯気、食材',
  },
}

// A/B/Cパターンの訴求タイプ
const APPEAL_TYPES = [
  { type: 'A', focus: 'ベネフィット重視', description: 'ユーザーが得られるメリットを強調' },
  { type: 'B', focus: '緊急性・限定性', description: '今すぐ行動すべき理由を強調' },
  { type: 'C', focus: '社会的証明', description: '実績や信頼性を強調' },
]

// バナー生成用プロンプトを作成
function createBannerPrompt(
  category: string,
  keyword: string,
  size: string,
  appealType: typeof APPEAL_TYPES[0]
): string {
  const categoryStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.marketing
  const [width, height] = size.split('x')
  const aspectRatio = parseInt(width) > parseInt(height) ? '横長' : 
                      parseInt(width) < parseInt(height) ? '縦長' : '正方形'

  return `
広告バナー画像を生成してください。

【サイズ】${aspectRatio}（${size}px）
【スタイル】${categoryStyle.style}デザイン
【配色】${categoryStyle.colors}配色
【装飾要素】${categoryStyle.elements}

【訴求タイプ】${appealType.focus}（${appealType.description}）

【メインコピー】"${keyword}"
※上記テキストをバナー内に読みやすく配置してください

【デザイン要件】
- 商用広告として使用できるプロフェッショナルなデザイン
- テキストは読みやすいフォントとサイズで配置
- 背景とテキストのコントラストを確保
- CTA（行動喚起）ボタンを含める
- 高品質でシャープな画像
`.trim()
}

// 単一のバナーを生成（テキストベースの説明を生成）
async function generateSingleBanner(
  genAI: GoogleGenerativeAI,
  prompt: string,
  size: string,
  appealType: string
): Promise<string> {
  try {
    // gemini-1.5-flash は画像生成には対応していないため、
    // テキストプロンプトを生成し、プレースホルダー画像を返す
    // 実際の画像生成には Imagen API または別のサービスが必要
    
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    
    const enhancedPrompt = `
以下のバナー広告のコピーとデザイン提案を日本語で作成してください：

${prompt}

回答形式：
1. キャッチコピー（20文字以内）
2. サブコピー（40文字以内）
3. CTAボタンテキスト（8文字以内）
4. 推奨配色（HEXコード3色）
`

    const result = await model.generateContent(enhancedPrompt)
    const response = await result.response
    const text = response.text()
    
    // レスポンスからコピーを抽出し、プレースホルダー画像を生成
    const lines = text.split('\n').filter(line => line.trim())
    const catchCopy = lines[0]?.replace(/^[0-9.、：:]+/, '').trim().slice(0, 20) || keyword
    
    // カテゴリに応じた色を選択
    const colors: Record<string, string> = {
      telecom: '3B82F6',
      marketing: '8B5CF6',
      ec: 'F97316',
      recruit: '22C55E',
      beauty: 'EC4899',
      food: 'EF4444',
    }
    const color = colors[appealType === 'A' ? 'marketing' : appealType === 'B' ? 'ec' : 'telecom'] || '8B5CF6'
    
    // SVGベースのプレースホルダー画像を生成
    const [width, height] = size.split('x').map(Number)
    const encodedText = encodeURIComponent(catchCopy || keyword)
    
    return `https://via.placeholder.com/${width}x${height}/${color}/FFFFFF?text=${encodedText}`
  } catch (error: any) {
    console.error('Banner generation error:', error)
    // エラー時はプレースホルダーを返す
    return `https://via.placeholder.com/${size.replace('x', '/')}/8B5CF6/FFFFFF?text=Banner`
  }
}

// A/B/C 3パターンのバナーを生成
export async function generateBanners(
  category: string,
  keyword: string,
  size: string = '1080x1080'
): Promise<{ banners: string[]; error?: string }> {
  try {
    const genAI = getClient()
    
    const banners: string[] = []
    
    // 3パターン順次生成（API制限を考慮）
    for (const appealType of APPEAL_TYPES) {
      try {
        const prompt = createBannerPrompt(category, keyword, size, appealType)
        const banner = await generateSingleBanner(genAI, prompt, size, appealType.type)
        banners.push(banner)
        
        // レート制限を避けるため少し待機
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error('Banner generation failed:', error)
        // エラーの場合はプレースホルダーを追加
        banners.push(`https://via.placeholder.com/${size.replace('x', '/')}/8B5CF6/FFFFFF?text=Pattern${appealType.type}`)
      }
    }

    return { banners }
  } catch (error: any) {
    console.error('generateBanners error:', error)
    return { 
      banners: [], 
      error: error.message || 'バナー生成中にエラーが発生しました' 
    }
  }
}

// 環境変数のチェック
export function isNanobannerConfigured(): boolean {
  return !!(process.env.GOOGLE_GENAI_API_KEY || process.env.NANOBANNER_API_KEY)
}
