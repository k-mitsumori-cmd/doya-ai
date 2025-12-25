// ============================================
// Gemini 2.0 Flash Text Generation
// ============================================
// カンタンマーケAI用のテキスト生成
// 参考: https://ai.google.dev/gemini-api/docs/models?hl=ja

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Gemini 2.0 Flash（高速・高品質テキスト生成）
// 参考: https://ai.google.dev/gemini-api/docs/models?hl=ja
function getPrimaryTextModel(): string {
  return (
    process.env.DOYA_BANNER_TEXT_MODEL ||
    process.env.DOYA_TEXT_MODEL ||
    process.env.GEMINI_PRO3_MODEL ||
    process.env.GEMINI_PRO_3_MODEL ||
    process.env.GEMINI_TEXT_MODEL ||
    // 未設定時は Gemini 3 Pro Preview を優先（公式モデルID）
    // 参照: https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja
    'gemini-3-pro-preview'
  )
}

// フォールバック用モデル
const GEMINI_FALLBACK_MODEL = 'gemini-1.5-flash'

export interface GeminiTextOptions {
  temperature?: number
  maxOutputTokens?: number
  topP?: number
  topK?: number
}

/**
 * Gemini 2.0でテキスト生成
 * マーケティング業務に最適化されたシステムプロンプト付き
 */
export async function generateTextWithGemini(
  prompt: string,
  userInput: Record<string, string>,
  options: GeminiTextOptions = {}
): Promise<string> {
  const apiKey = 
    process.env.GOOGLE_GENAI_API_KEY || 
    process.env.GOOGLE_AI_API_KEY || 
    process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY または GEMINI_API_KEY 環境変数が設定されていません')
  }

  // プロンプト内の変数を置換
  let finalPrompt = prompt
  for (const [key, value] of Object.entries(userInput)) {
    finalPrompt = finalPrompt.replace(new RegExp(`{{${key}}}`, 'g'), value)
  }

  const {
    temperature = 0.8,
    maxOutputTokens = 8192,
    topP = 0.95,
    topK = 40,
  } = options

  // マーケティング業務に最適化されたシステムプロンプト
  const systemPrompt = `あなたは日本のトップマーケティングエージェンシーで10年以上の経験を持つシニアマーケターです。

【あなたの専門性】
- LP（ランディングページ）構成・コピーライティング
- 広告コピー（Google/Facebook/Instagram/Twitter）
- コンテンツマーケティング・SEO
- メールマーケティング・メルマガ
- 競合分析・市場分析・ペルソナ設計
- ブランディング・ネーミング

【出力ルール】
1. 実務で即座に使えるプロ品質のアウトプットを提供する
2. 具体的で行動を促す表現を使う
3. ターゲットに刺さる心理的トリガーを含める
4. 日本市場・日本語に最適化する
5. 複数案を提示する場合は、異なるアプローチで差別化する

【重要】
- クライアントの課題解決に直結するアウトプットを最優先
- 抽象的な説明ではなく、すぐに使える具体的な文章を提供
- マーケティングのベストプラクティスに基づいて回答`

  // Gemini 3 Pro Preview → Gemini 3 Flash Preview → 2.0 Flash → 1.5 Flash の順で試す
  const models = [getPrimaryTextModel(), 'gemini-3-flash-preview', 'gemini-2.0-flash', GEMINI_FALLBACK_MODEL]
  
  for (const model of models) {
    try {
      const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
      
      const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n---\n\n${finalPrompt}` }],
            },
          ],
          generationConfig: {
            temperature,
            maxOutputTokens,
            topP,
            topK,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.warn(`Gemini ${model} error: ${response.status}`, errorText.substring(0, 300))
        continue // 次のモデルを試行
      }

      const data = await response.json()
      
      // レスポンスからテキストを抽出
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      
      if (!text) {
        console.warn(`Gemini ${model} returned empty text`)
        continue
      }

      console.log(`Successfully generated with ${model}`)
      return text
    } catch (error: any) {
      console.warn(`Gemini ${model} failed:`, error?.message || error)
      continue
    }
  }

  throw new Error('すべてのGeminiモデルでの生成に失敗しました')
}

/**
 * チャット形式でのテキスト生成（会話履歴対応）
 */
export async function generateChatWithGemini(
  messages: Array<{ role: 'user' | 'model'; text: string }>,
  systemPrompt?: string,
  options: GeminiTextOptions = {}
): Promise<string> {
  const apiKey = 
    process.env.GOOGLE_GENAI_API_KEY || 
    process.env.GOOGLE_AI_API_KEY || 
    process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY または GEMINI_API_KEY 環境変数が設定されていません')
  }

  const {
    temperature = 0.8,
    maxOutputTokens = 8192,
    topP = 0.95,
    topK = 40,
  } = options

  const defaultSystemPrompt = `あなたは経験豊富なマーケティングコンサルタントです。
クライアントの質問に対して、具体的で実践的なアドバイスを提供してください。
日本語で、プロフェッショナルかつ親しみやすいトーンで回答してください。`

  // メッセージを構築
  const contents = messages.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }))

  // システムプロンプトを最初のユーザーメッセージに含める
  if (contents.length > 0 && contents[0].role === 'user') {
    const sys = systemPrompt || defaultSystemPrompt
    contents[0].parts[0].text = `${sys}\n\n---\n\n${contents[0].parts[0].text}`
  }

  const modelId = getPrimaryTextModel()
  const endpoint = `${GEMINI_API_BASE}/models/${modelId}:generateContent`
  
  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens,
        topP,
        topK,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 300)}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  
  if (!text) {
    throw new Error('Gemini returned empty response')
  }

  return text
}

// 使用しているモデル名を取得（UI表示用）
export function getGeminiModelName(): string {
  return 'Gemini 2.0 Flash'
}

