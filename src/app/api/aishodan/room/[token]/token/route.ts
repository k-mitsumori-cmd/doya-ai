export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/aishodan/room/[token]/token — Realtime用 ephemeral token を発行
//
//   ブラウザ ──WebRTC──▶ OpenAI Realtime API（音声は直結）
//        ▲
//        └ サーバは短命トークンを発行するだけ
//
// Vercel Serverless は WebSocket を長時間保持できないため、音声をサーバ中継すると
// 成立しない。ブラウザとOpenAIを直結し、サーバは認証と商談指示の組み立てだけを担う。
// （mensetsu で実証済みの構成）
//
// ⚠️ OPENAI_API_KEY を絶対にクライアントへ返さないこと。返すのは client_secret のみ。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertSessionUsable, loadGuestSession } from '@/lib/aishodan/session'
import { toScenarioConfig } from '@/lib/aishodan/public'
import { ADVANCE_TOOL, LOOKUP_TOOL, RECORD_TOOL, buildSalesInstructions } from '@/lib/aishodan/engine'
import { retrieve } from '@/lib/aishodan/knowledge'
import type { ProductProfile } from '@/lib/aishodan/types'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

const REALTIME_MODEL = process.env.AISHODAN_REALTIME_MODEL || process.env.MENSETSU_REALTIME_MODEL || 'gpt-realtime'
const REALTIME_VOICE = process.env.AISHODAN_REALTIME_VOICE || 'alloy'

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const body = await req.json().catch(() => ({}))
  const s = await loadGuestSession(req, p.token, String(body?.sessionId || ''))
  if (!s) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })

  const usable = assertSessionUsable(s)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  const cfg = toScenarioConfig(s.room.scenario)

  // --- 発行の上限 ---
  // ⚠️ ここは1回叩くごとに OPENAI_API_KEY 課金の Realtime 資格情報が1つ生まれる。
  //    上限が無いと、URLを持つ者が有効期間中いくらでも発行でき、従量課金と
  //    レート制限を枯渇させられる。
  // ⚠️ 判定と加算を分けると、並列リクエストが全て同じ値を読んで上限を突破できる。
  //    updateMany の条件付き加算で席を予約し、更新件数0なら上限到達とみなす。
  const MAX_ISSUES = 12
  const reserved = await prisma.aishodanSession.updateMany({
    where: { id: s.id, tokenIssueCount: { lt: MAX_ISSUES } },
    data: { tokenIssueCount: { increment: 1 } },
  })
  if (reserved.count === 0) {
    return NextResponse.json(
      { error: '接続の試行回数が上限に達しました。お手数ですが担当者までご連絡ください。' },
      { status: 429 }
    )
  }

  // 時間窓。商談の長さ＋猶予を過ぎたら発行しない
  if (s.startedAt) {
    const graceMs = (cfg.durationMin * 60 + 15 * 60) * 1000
    if (Date.now() - s.startedAt.getTime() > graceMs) {
      return NextResponse.json({ error: 'この商談の実施時間を過ぎています。' }, { status: 410 })
    }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: '音声商談の設定が未完了です（管理者にお問い合わせください）' }, { status: 503 })
  }

  // 冒頭の説明に使う資料の抜粋を少しだけ積む。全文は積まない（指示文が膨らむと守られなくなる）
  const profile = (s.room.scenario.product.profile as ProductProfile | null) ?? {}
  const digestChunks = await retrieve(s.room.scenario.product.id, profile.oneLiner || s.room.scenario.product.name, 3, 0.05)
  const knowledgeDigest = digestChunks.map((c) => c.text).join('\n---\n').slice(0, 4000)

  const instructions = buildSalesInstructions({
    companyName: s.room.organization.name,
    productName: s.room.scenario.product.name,
    profile,
    phases: cfg.phases,
    slots: cfg.slots,
    guardrails: cfg.guardrails,
    persona: cfg.persona,
    durationMin: cfg.durationMin,
    guestName: s.guestName,
    guestCompany: s.guestCompany,
    knowledgeDigest,
    hasScheduling: Boolean(cfg.schedulingUrl),
  })

  let res: Response
  try {
    // ⚠️ 旧 /v1/realtime/sessions（フラットな body）は廃止され 404 になる。
    //    現行は /v1/realtime/client_secrets で、設定は session の下にネストし、
    //    音声まわりは audio.input / audio.output に分かれる。
    res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
          instructions,
          audio: {
            input: {
              transcription: { model: 'whisper-1', language: 'ja' },
              // サーバVAD: 相手が話し終わったらAIの番にする
              // ⚠️ interrupt_response は true に戻した（2026-08-31）。
              //    false にしたところAIが「商談を始めます」以降を喋らなくなったため差し戻し。
              //    原因が特定できるまで false に戻さないこと。
              // ⚠️ しきい値が高いのは、生活音・キーボード・同席者の声を拾わないため。
              turn_detection: {
                type: 'server_vad',
                threshold: 0.78,
                prefix_padding_ms: 300,
                silence_duration_ms: 1100,
                create_response: true,
                interrupt_response: true,
              },
            },
            output: { voice: REALTIME_VOICE },
          },
          tools: [ADVANCE_TOOL, LOOKUP_TOOL, RECORD_TOOL],
          tool_choice: 'auto',
        },
      }),
    })
  } catch {
    return NextResponse.json({ error: '音声商談サーバーに接続できませんでした' }, { status: 502 })
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[aishodan] realtime session error', res.status, detail.slice(0, 500))
    return NextResponse.json(
      { error: '商談を開始できませんでした。時間をおいて再度お試しください。' },
      { status: 502 }
    )
  }

  const data = await res.json()
  // 新形式は { value, expires_at, session } を直接返す（旧形式の client_secret.value ではない）
  const clientSecret: string | null = data?.value ?? data?.client_secret?.value ?? null
  if (!clientSecret) {
    console.error('[aishodan] realtime: client secret missing', JSON.stringify(data).slice(0, 300))
    return NextResponse.json({ error: '商談を開始できませんでした。' }, { status: 502 })
  }

  if (!s.startedAt) {
    // 保持期限は実施日から数え直す。発行時点の仮の値のままだと、
    // 同意画面で伝えた「実施から◯日間保管」と実態がずれる。
    await prisma.aishodanSession.update({
      where: { id: s.id },
      data: {
        status: 'live',
        startedAt: new Date(),
        purgeAfter: new Date(Date.now() + Math.max(1, s.room.organization.retentionDays) * 24 * 60 * 60 * 1000),
      },
    })
  }

  return NextResponse.json({
    clientSecret,
    expiresAt: data?.expires_at ?? null,
    model: REALTIME_MODEL,
    durationMin: cfg.durationMin,
  })
}
