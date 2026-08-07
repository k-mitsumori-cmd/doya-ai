export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/live/[token]/token — Realtime用 ephemeral token を発行
//
// 設計の要点:
//   ブラウザ ──WebRTC──▶ OpenAI Realtime API（音声は直結）
//        ▲
//        └ サーバは「短命トークンを発行するだけ」
//
//   Vercel Serverless は WebSocket を長時間保持できない。音声をサーバ中継すると成立しないため、
//   ブラウザとOpenAIを直結し、サーバは認証と面接指示の組み立てだけを担当する。
//
// ⚠️ OPENAI_API_KEY を絶対にクライアントへ返さないこと。返すのは client_secret のみ。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertUsable, loadSessionByToken } from '@/lib/mensetsu/public'
import { ADVANCE_TOOL, buildInterviewerInstructions } from '@/lib/mensetsu/interview'
import { LEVEL_LABELS, type MensetsuLevel } from '@/lib/mensetsu/types'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

const REALTIME_MODEL = process.env.MENSETSU_REALTIME_MODEL || 'gpt-realtime'
const REALTIME_VOICE = process.env.MENSETSU_REALTIME_VOICE || 'alloy'

export async function POST(_req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })

  // 同意していない応募者には発行しない（C1）
  if (!s.consentedAt) {
    return NextResponse.json({ error: '先に同意が必要です' }, { status: 403 })
  }
  const usable = assertUsable(s)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: '音声面接の設定が未完了です（管理者にお問い合わせください）' }, { status: 503 })
  }

  const instructions = buildInterviewerInstructions({
    companyName: s.organization.name,
    jobTitle: s.template.jobTitle,
    levelLabel: LEVEL_LABELS[(s.template.level as MensetsuLevel) || 'mid'] || '中途',
    durationMin: s.template.durationMin,
    intro: s.template.intro,
    closing: s.template.closing,
    questions: s.template.questions,
    candidateName: s.candidateName,
  })

  let res: Response
  try {
    res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice: REALTIME_VOICE,
        instructions,
        modalities: ['audio', 'text'],
        // 応募者の発話を文字起こしして字幕・逐語ログに使う（F1-6, F4-1）
        input_audio_transcription: { model: 'whisper-1' },
        // サーバVAD: 応募者が話し始めたらAIの発話を止める（F1-3 バージイン）
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700,
          create_response: true,
        },
        tools: [ADVANCE_TOOL],
        tool_choice: 'auto',
      }),
    })
  } catch (e: any) {
    return NextResponse.json({ error: '音声面接サーバーに接続できませんでした' }, { status: 502 })
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[mensetsu] realtime session error', res.status, detail.slice(0, 500))
    return NextResponse.json(
      { error: '面接セッションを開始できませんでした。時間をおいて再度お試しください。' },
      { status: 502 }
    )
  }

  const data = await res.json()

  // 面接開始を記録（最初の1回だけ）
  if (!s.startedAt) {
    await prisma.mensetsuSession.update({
      where: { id: s.id },
      data: { status: 'live', startedAt: new Date() },
    })
  }

  return NextResponse.json({
    clientSecret: data?.client_secret?.value ?? null,
    expiresAt: data?.client_secret?.expires_at ?? null,
    model: REALTIME_MODEL,
    durationMin: s.template.durationMin,
    questionCount: s.template.questions.length,
    // 冒頭の一言目はクライアントから response.create で促す
    firstQuestion: s.template.questions[0]?.text ?? null,
  })
}
