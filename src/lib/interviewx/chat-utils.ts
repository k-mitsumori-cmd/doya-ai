// ============================================
// チャットインタビュー ユーティリティ
// ============================================

import type { ChatAIResponse } from './types'

/**
 * Gemini API キーを環境変数から取得
 */
export function getGeminiApiKey(): string {
  const key =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini APIキーが設定されていません')
  return key.trim()
}

/**
 * Gemini API (非ストリーミング・JSON) を呼び出す
 */
export async function callGeminiJson(
  contents: { role: string; parts: { text: string }[] }[],
): Promise<string> {
  const apiKey = getGeminiApiKey()
  const model = 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    }),
  }).finally(() => clearTimeout(timeout))

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error('[interviewx-chat] Gemini error:', res.status, errText)
    throw new Error(`AI API エラー (${res.status})`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('AIからの応答が空でした')
  return text
}

/**
 * Gemini のJSON応答をパースしてChatAIResponseを返す
 */
export function parseAIResponse(rawText: string): ChatAIResponse {
  // JSONを抽出（コードブロックで囲まれている場合も対応）
  let jsonStr = rawText.trim()
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(jsonStr)
    return {
      reply: parsed.reply || '',
      topicIndex: typeof parsed.topicIndex === 'number' ? parsed.topicIndex : 0,
      messageType: parsed.messageType || 'question',
      shouldEndInterview: !!parsed.shouldEndInterview,
    }
  } catch {
    // JSON パース失敗: テキストをそのままreplyとして返す
    return {
      reply: rawText.replace(/```[\s\S]*?```/g, '').trim() || 'すみません、少し考えさせてください。もう一度お話しいただけますか？',
      topicIndex: 0,
      messageType: 'question',
      shouldEndInterview: false,
    }
  }
}

/**
 * チャットメッセージ履歴からtopicIndexベースでQ&Aペアを抽出
 */
export function extractQAPairsFromChat(
  chatMessages: { role: string; content: string; topicIndex?: number | null }[],
  questions: { id: string; text: string; order: number }[],
): { questionId: string; answerText: string }[] {
  // topicIndex別にユーザー回答を集約
  const answersByTopic = new Map<number, string[]>()

  for (const msg of chatMessages) {
    if (msg.role === 'respondent' && msg.topicIndex != null) {
      if (!answersByTopic.has(msg.topicIndex)) {
        answersByTopic.set(msg.topicIndex, [])
      }
      answersByTopic.get(msg.topicIndex)!.push(msg.content)
    }
  }

  // 質問とマッピング（質問はorder順にソート済みを想定）
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order)

  return sortedQuestions
    .map((q, index) => {
      const answers = answersByTopic.get(index)
      if (!answers || answers.length === 0) return null
      return {
        questionId: q.id,
        answerText: answers.join('\n'),
      }
    })
    .filter((x): x is { questionId: string; answerText: string } => x !== null)
}

/**
 * チャット履歴をGemini contents形式に変換
 * AIメッセージはJSON形式で送信（Geminiの出力形式と一致させる）
 */
export function buildGeminiContents(
  systemPrompt: string,
  chatHistory: { role: string; content: string; topicIndex?: number | null; messageType?: string | null }[],
  newUserMessage?: string,
): { role: string; parts: { text: string }[] }[] {
  const contents: { role: string; parts: { text: string }[] }[] = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: '{"reply":"承知しました。インタビューを開始します。","topicIndex":0,"messageType":"greeting","shouldEndInterview":false}' }] },
  ]

  // 会話履歴を追加（最新20件に制限）
  const recentHistory = chatHistory.slice(-20)
  for (const msg of recentHistory) {
    if (msg.role === 'interviewer') {
      // AIメッセージはJSON形式で送信（Geminiの出力形式と一致）
      contents.push({
        role: 'model',
        parts: [{ text: JSON.stringify({
          reply: msg.content,
          topicIndex: msg.topicIndex ?? 0,
          messageType: msg.messageType || 'question',
          shouldEndInterview: false,
        }) }],
      })
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: msg.content }],
      })
    }
  }

  // 新しいユーザーメッセージを追加
  if (newUserMessage) {
    contents.push({
      role: 'user',
      parts: [{ text: newUserMessage }],
    })
  }

  return contents
}
