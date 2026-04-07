/**
 * ナグサメ 慰め生成ロジック
 *
 * 多人格ペルソナに並列 fan-out してClaude APIを叩き、
 * 返ってきた順に SSE へ push する。
 */

import { callClaudeMessages } from '../_shared/anthropic'
import { containsPharmaNgWord } from '../_shared/safety'
import type { Persona } from './types'

export interface GeneratedReply {
  personaId: string
  personaName: string
  avatar: string
  content: string
  orderIndex: number
}

export interface GenerateOptions {
  userMessage: string
  personas: Persona[]
  /** 1件ずつ完了次第呼ばれるコールバック（SSE push 用） */
  onReply?: (reply: GeneratedReply) => void
  /** 薬機法NG語に該当した時の通知（UIには表示しない、ログ用） */
  onDropped?: (personaId: string, reason: string) => void
}

/**
 * 全ペルソナに並列でClaudeを投げ、返ってきたものから即座に onReply を呼ぶ。
 *
 * - 個別失敗は黙殺（他のペルソナの応答は止めない）
 * - NG語検出時はそのペルソナ分だけドロップ
 * - 戻り値は成功した応答の配列（DB保存用）
 */
export async function generateNagusameReplies(
  opts: GenerateOptions
): Promise<GeneratedReply[]> {
  const { userMessage, personas, onReply, onDropped } = opts

  const results: GeneratedReply[] = []

  // 各ペルソナごとに独立した promise を組み、Promise.allSettled で待つ
  const tasks = personas.map(async (persona, idx) => {
    try {
      const { text } = await callClaudeMessages({
        systemPrompt: persona.systemPrompt,
        userPrompt: userMessage,
        maxTokens: 200,
        temperature: 0.9,
      })

      const trimmed = text.trim()
      if (!trimmed) {
        onDropped?.(persona.id, 'empty response')
        return null
      }

      if (containsPharmaNgWord(trimmed)) {
        onDropped?.(persona.id, 'pharma NG word')
        return null
      }

      const reply: GeneratedReply = {
        personaId: persona.id,
        personaName: persona.name,
        avatar: persona.avatar,
        content: trimmed,
        orderIndex: idx,
      }

      results.push(reply)
      onReply?.(reply)
      return reply
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      onDropped?.(persona.id, `api error: ${message}`)
      return null
    }
  })

  await Promise.allSettled(tasks)

  // order 順にソートして返す（DB保存用）
  return results.sort((a, b) => a.orderIndex - b.orderIndex)
}
