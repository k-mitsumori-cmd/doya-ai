// ============================================
// POST /api/mitsuboshi/nagusame/chat
// ============================================
// 三ツ星アプリ ナグサメの「会話継続」API。
// 初回の慰めを受け取った後、特定のキャラクターとの 1対1 会話を続けるためのエンドポイント。
//
// - body: { personaId, messages: [{role, content}, ...] }
//   messages の末尾は最新のユーザー発話
// - response: { type: 'reply' | 'safety' | 'error', content?, resources? }
// - 危機ワード検知、薬機法 NG 語フィルタは continue でも適用
// - 履歴は最新 12 件（user/assistant ペアで 6 ターン）に切り詰め

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { callClaudeChat, type ClaudeChatMessage } from '@/lib/mitsuboshi/_shared/anthropic'
import {
  detectSelfHarmRisk,
  containsPharmaNgWord,
  SAFETY_RESOURCES,
} from '@/lib/mitsuboshi/_shared/safety'
import { DEFAULT_PERSONAS } from '@/lib/mitsuboshi/nagusame/personas/default'

const MAX_HISTORY_LENGTH = 12 // user/assistant 合算で 12 件まで保持
const MAX_INPUT_LEN = 1000

// チャットモード用のシステムプロンプト追加文。
// 各ペルソナの固有 systemPrompt の後ろにくっつけて、
// 「会話を続けるモード」であることを明示する。
const CHAT_MODE_ADDENDUM = `

【会話モード】
これはユーザーとの継続会話です。これまでの会話履歴を踏まえ、ペルソナの口調と価値観を完全に保ったまま、
ユーザーの新しい言葉に1〜3文（80字以内）で応えてください。前の自分の発言を否定したり、突然キャラを
変えたりしないこと。話を遮らず、まず受け止めてから自分の言葉を返してください。`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const personaId = typeof body?.personaId === 'string' ? body.personaId : ''
    const rawMessages = Array.isArray(body?.messages) ? body.messages : []

    if (!personaId) {
      return NextResponse.json({ error: 'personaId が必要です' }, { status: 400 })
    }
    if (rawMessages.length === 0) {
      return NextResponse.json({ error: 'messages が空です' }, { status: 400 })
    }

    // ペルソナを id で引く
    const persona = DEFAULT_PERSONAS.find((p) => p.id === personaId)
    if (!persona) {
      return NextResponse.json(
        { error: '指定されたキャラクターは存在しません' },
        { status: 404 }
      )
    }

    // メッセージ配列を validate + 切り詰め
    const messages: ClaudeChatMessage[] = []
    for (const m of rawMessages) {
      if (!m || typeof m !== 'object') continue
      const role = m.role === 'assistant' ? 'assistant' : 'user'
      const content = typeof m.content === 'string' ? m.content.trim() : ''
      if (!content) continue
      messages.push({ role, content: content.slice(0, MAX_INPUT_LEN) })
    }
    if (messages.length === 0) {
      return NextResponse.json({ error: '有効なメッセージがありません' }, { status: 400 })
    }

    // 最新のユーザー発話で危機ワード検知
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUserMsg && detectSelfHarmRisk(lastUserMsg.content)) {
      return NextResponse.json({
        type: 'safety',
        resources: SAFETY_RESOURCES,
      })
    }

    // 履歴を切り詰め（古いものから）
    const trimmed = messages.slice(-MAX_HISTORY_LENGTH)
    // user で始まり、user で終わる必要がある（Anthropic API の制約）
    while (trimmed.length > 0 && trimmed[0].role !== 'user') trimmed.shift()
    if (trimmed.length === 0 || trimmed[trimmed.length - 1].role !== 'user') {
      return NextResponse.json(
        { error: '会話履歴が不正です（末尾はユーザー発話である必要があります）' },
        { status: 400 }
      )
    }

    // Claude 呼び出し
    const { text } = await callClaudeChat({
      systemPrompt: persona.systemPrompt + CHAT_MODE_ADDENDUM,
      messages: trimmed,
      maxTokens: 240,
      temperature: 0.9,
    })

    const reply = text.trim()
    if (!reply) {
      return NextResponse.json(
        { error: 'モデルから空の応答が返りました' },
        { status: 502 }
      )
    }
    if (containsPharmaNgWord(reply)) {
      // NG 語が混入したら別の言い方を試させる代わりにエラーを返す
      return NextResponse.json(
        {
          type: 'error',
          message: 'うまく言葉を選べませんでした。もう一度送ってもらえますか？',
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      type: 'reply',
      personaId: persona.id,
      personaName: persona.name,
      avatar: persona.avatar,
      content: reply,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '予期せぬエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
