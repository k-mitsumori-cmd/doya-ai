// Nanobanner Pro API を使用したバナー画像生成
// https://nanobanana.co/ - Gemini 3 Pro Image 搭載

const NANOBANNER_API_ENDPOINT = 'https://api.nanobananai.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent'

// カテゴリ別のデザインガイドライン
const CATEGORY_STYLES: Record<string, { style: string; colors: string; elements: string }> = {
  telecom: {
    style: 'モダンでテクノロジー感のある、クリーンでプロフェッショナルな',
    colors: '鮮やかな青（#3B82F6）、シアン（#06B6D4）、白を基調とした、グラデーション背景の',
    elements: 'スマートフォンのアイコン、電波マーク、クラウドアイコン、速度を表す矢印',
  },
  marketing: {
    style: '洗練されていて信頼感のある、ビジネス向けの高級感ある',
    colors: '紫（#8B5CF6）、ピンク（#EC4899）、白を基調とした、美しいグラデーション背景の',
    elements: '上昇するグラフ、成長を示す矢印、チャートアイコン',
  },
  ec: {
    style: '華やかで購買意欲を刺激する、セール感のある緊急性を感じる',
    colors: 'オレンジ（#F97316）、赤（#EF4444）、金色を基調とした、目を引く鮮やかな',
    elements: 'ショッピングカート、ギフトボックス、セールタグ、パーセントマーク',
  },
  recruit: {
    style: '明るく前向きで希望に満ちた、プロフェッショナルかつ親しみやすい',
    colors: '緑（#22C55E）、青（#3B82F6）、白を基調とした、クリーンで明るい',
    elements: 'オフィスビル、握手するシルエット、チームワークを示すアイコン',
  },
  beauty: {
    style: 'エレガントで洗練された、女性向けの高級感ある',
    colors: 'ピンク（#EC4899）、ローズゴールド、白を基調とした、柔らかくフェミニンな',
    elements: '花のイラスト、化粧品ボトル、きらめきエフェクト、リボン',
  },
  food: {
    style: '美味しそうで食欲をそそる、温かみのある',
    colors: '赤（#EF4444）、オレンジ（#F97316）、茶色を基調とした、食欲を刺激する',
    elements: '料理のイラスト、湯気エフェクト、新鮮な食材、レストランの雰囲気',
  },
}

// A/B/Cパターンの訴求タイプ
const APPEAL_TYPES = [
  { 
    type: 'A', 
    focus: 'ベネフィット重視', 
    style: 'ユーザーのメリットを大きく強調し、ポジティブで明るいデザイン。メインコピーを画面中央に大きく配置。',
  },
  { 
    type: 'B', 
    focus: '緊急性・限定性', 
    style: '「今すぐ」「限定」「残りわずか」などの緊急性を演出。赤や黄色のアクセントを使い、目を引くデザイン。',
  },
  { 
    type: 'C', 
    focus: '信頼性・実績', 
    style: '「No.1」「○万人が利用」などの実績を強調。落ち着いた配色で信頼感を演出。',
  },
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
  const aspectRatio = parseInt(width) > parseInt(height) ? '横長（ランドスケープ）' : 
                      parseInt(width) < parseInt(height) ? '縦長（ポートレート）' : '正方形（スクエア）'

  return `
あなたは日本のトップクリエイティブディレクターです。以下の要件で、日本市場向けの高品質な広告バナー画像を1枚生成してください。

【バナー仕様】
- サイズ: ${aspectRatio}形式（${width}×${height}ピクセル）
- 用途: デジタル広告バナー（SNS広告、ディスプレイ広告）

【デザインスタイル】
${categoryStyle.style}デザインで作成してください。

【配色】
${categoryStyle.colors}配色を使用してください。

【装飾要素】
${categoryStyle.elements}などのグラフィック要素を適切に配置してください。

【訴求タイプ: ${appealType.focus}】
${appealType.style}

【メインコピー（必須・日本語で大きく配置）】
「${keyword}」
※このテキストをバナーの中央または目立つ位置に、読みやすいフォントサイズで必ず配置してください。

【必須デザイン要件】
1. 商用広告として使用できるプロフェッショナルなデザイン
2. 日本語テキストは読みやすく、背景とのコントラストを確保
3. CTAボタン（「詳しくはこちら」「今すぐチェック」など）を右下または下部に配置
4. 余白を適切に取り、情報を詰め込みすぎない
5. 高解像度でシャープな画像
6. ブランドイメージを損なわないクリーンなデザイン

画像のみを生成してください。説明は不要です。
`.trim()
}

// Nanobanner Pro APIを呼び出してバナーを生成
async function generateSingleBanner(
  apiKey: string,
  prompt: string
): Promise<string> {
  try {
    const response = await fetch(NANOBANNER_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Nanobanner API error:', response.status, errorText)
      throw new Error(`API Error: ${response.status}`)
    }

    const result = await response.json()
    
    // レスポンスから画像データを抽出
    if (result.candidates && result.candidates[0]?.content?.parts) {
      for (const part of result.candidates[0].content.parts) {
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
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.NANOBANNER_API_KEY
  
  if (!apiKey) {
    console.error('API key not configured')
    return { 
      banners: [], 
      error: 'APIキーが設定されていません。環境変数 GOOGLE_GENAI_API_KEY を設定してください。' 
    }
  }

  try {
    const banners: string[] = []
    
    // 3パターン順次生成（レート制限を考慮）
    for (const appealType of APPEAL_TYPES) {
      try {
        const prompt = createBannerPrompt(category, keyword, size, appealType)
        console.log(`Generating banner type ${appealType.type}...`)
        
        const banner = await generateSingleBanner(apiKey, prompt)
        banners.push(banner)
        
        // レート制限を避けるため少し待機
        if (APPEAL_TYPES.indexOf(appealType) < APPEAL_TYPES.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error: any) {
        console.error(`Banner ${appealType.type} generation failed:`, error)
        // エラーの場合はプレースホルダーを追加
        const [w, h] = size.split('x')
        banners.push(`https://placehold.co/${w}x${h}/8B5CF6/FFFFFF?text=Pattern+${appealType.type}`)
      }
    }

    if (banners.every(b => b.startsWith('https://placehold'))) {
      return {
        banners,
        error: 'すべてのバナー生成に失敗しました。APIキーを確認してください。'
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
