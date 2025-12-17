// Nanobanner Pro API を使用したバナー画像生成
// Google Genai SDK (@google/genai) を使用

import { GoogleGenAI, Modality } from '@google/genai'

// APIクライアントの初期化
function getClient() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.NANOBANNER_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY または NANOBANNER_API_KEY が設定されていません')
  }
  return new GoogleGenAI({ apiKey })
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

// 単一のバナーを生成
async function generateSingleBanner(
  client: GoogleGenAI,
  prompt: string,
  size: string
): Promise<string> {
  try {
    const [width, height] = size.split('x').map(Number)
    
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash-exp', // 画像生成対応モデル
      contents: prompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        // サイズ指定が可能な場合
      },
    })

    // レスポンスから画像データを抽出
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          // Base64画像データをData URLに変換
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
        }
      }
    }

    throw new Error('画像が生成されませんでした')
  } catch (error: any) {
    console.error('Banner generation error:', error)
    throw error
  }
}

// A/B/C 3パターンのバナーを生成
export async function generateBanners(
  category: string,
  keyword: string,
  size: string = '1080x1080'
): Promise<{ banners: string[]; error?: string }> {
  try {
    const client = getClient()
    
    const banners: string[] = []
    
    // 3パターン並列で生成
    const promises = APPEAL_TYPES.map(async (appealType) => {
      const prompt = createBannerPrompt(category, keyword, size, appealType)
      return generateSingleBanner(client, prompt, size)
    })

    const results = await Promise.allSettled(promises)
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        banners.push(result.value)
      } else {
        console.error('Banner generation failed:', result.reason)
        // エラーの場合はプレースホルダーを追加
        banners.push(`https://via.placeholder.com/${size.replace('x', '/')}/8B5CF6/FFFFFF?text=Error`)
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

