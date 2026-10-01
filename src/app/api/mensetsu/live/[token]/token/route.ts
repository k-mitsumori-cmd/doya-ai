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
import { REALTIME_REQUEST_TIMEOUT_MS, readRealtimeJson, realtimeClientSecret } from '@/lib/realtime-token-response'

type Ctx = { params: Promise<{ token: string }> }

const REALTIME_MODEL = process.env.MENSETSU_REALTIME_MODEL || 'gpt-realtime'
const REALTIME_VOICE = process.env.MENSETSU_REALTIME_VOICE || 'alloy'

export async function POST(_req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })

  // 同意していない応募者には発行しない（C1）
  if (!s.consentedAt) {
    return NextResponse.json({ error: '先に同意が必要です' }, { status: 403 })
  }
  const usable = assertUsable(s)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })
  if (s.endedAt) return NextResponse.json({ error: 'この面接は既に終了しています。' }, { status: 409 })
  const graceMs = (s.template.durationMin * 60 + 10 * 60) * 1000
  if (s.startedAt && Date.now() - s.startedAt.getTime() > graceMs) {
    return NextResponse.json({ error: 'この面接の実施時間を過ぎています。採用ご担当者にお問い合わせください。' }, { status: 410 })
  }

  // --- 発行の上限（未認証で叩ける口なので必須）---
  // ⚠️ ここは1回叩くごとに OPENAI_API_KEY 課金の Realtime 資格情報が1つ生まれる。
  //    以前は上限も時間窓も無く、面接URLを持つ者が expiresAt までの14日間
  //    無制限に発行できたため、共有キーの従量課金とレート制限を枯渇させられた。
  //
  //  (1) 回数: 通信断からの再接続を許しつつ、明らかな乱用は止める
  //  (2) 時間窓: 面接開始から「所要時間＋猶予」を過ぎたら発行しない。
  //      14日間開きっぱなしの窓を、実際の面接の長さまで縮める。
  // ⚠️ 判定と加算を分けると、並列リクエストが全て同じ値を読んで上限を突破できる。
  //    updateMany の条件付き加算で「席を予約」し、更新件数0なら上限到達とみなす。
  const MAX_ISSUES = 12
  const reserved = await prisma.mensetsuSession.updateMany({
    where: { id: s.id, tokenIssueCount: { lt: MAX_ISSUES }, status: { in: ['pending', 'consented', 'live'] }, consentedAt: { not: null }, endedAt: null, expiresAt: { gt: new Date() } },
    data: { tokenIssueCount: { increment: 1 } },
  })
  if (reserved.count === 0) {
    const current = await loadSessionByToken(p.token)
    if (!current) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
    if (!current.consentedAt) return NextResponse.json({ error: '先に同意が必要です' }, { status: 403 })
    const allowed = assertUsable(current)
    if (!allowed.ok) return NextResponse.json({ error: allowed.reason }, { status: allowed.status })
    if (current.endedAt) return NextResponse.json({ error: 'この面接は既に終了しています。' }, { status: 409 })
    return NextResponse.json(
      { error: '接続の試行回数が上限に達しました。採用ご担当者にお問い合わせください。' },
      { status: 429 }
    )
  }

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

  let data: any
  try {
    // ⚠️ 旧 `/v1/realtime/sessions`（フラットな body）は廃止され 404 になる。
    //    現行は `/v1/realtime/client_secrets` で、設定は session の下にネストし、
    //    音声まわりは audio.input / audio.output に分かれる。2026-08-07 に実機で確認。
    const res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      signal: AbortSignal.timeout(REALTIME_REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
          instructions,
          audio: {
            input: {
              // 応募者の発話を文字起こしして字幕・逐語ログに使う（F1-6, F4-1）
              transcription: { model: 'whisper-1', language: 'ja' },
              // サーバVAD: 応募者が話し終わったら面接官の番にする
              // ⚠️ interrupt_response は true に戻した（2026-08-31）。
              //    「質問が最初から言い直される」対策として false にしたところ、
              //    面接官が一切喋らなくなる事象が本番で発生したため差し戻し。
              //    OpenAI側は false を200で受け付ける（検証済み）ので設定拒否ではなく、
              //    応答の生成が進まなくなる別の要因がある。原因が特定できるまで戻さないこと。
              //    言い直しの抑制は、下の instructions 側の指示で行う。
              // ⚠️ しきい値が高いのは、生活音・キーボード・同席者の声を拾わないため。
              //    silence_duration も長めにして、少し考えて間が空いただけで
              //    「話し終わった」と判定されないようにしている。
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
          tools: [ADVANCE_TOOL],
          tool_choice: 'auto',
        },
      }),
    })
    if (!res.ok) {
      void res.body?.cancel().catch(() => {})
      console.error('[mensetsu] realtime session error', res.status)
      return NextResponse.json(
        { error: '面接セッションを開始できませんでした。時間をおいて再度お試しください。' },
        { status: 502 }
      )
    }
    data = await readRealtimeJson(res)
  } catch {
    console.error('[mensetsu] realtime session request failed')
    return NextResponse.json({ error: '音声面接サーバーに接続できませんでした' }, { status: 502 })
  }

  // 新形式は { value, expires_at, session } を直接返す（旧形式の client_secret.value ではない）
  const clientSecret = realtimeClientSecret(data)
  if (!clientSecret) {
    console.error('[mensetsu] realtime: client secret missing')
    return NextResponse.json({ error: '面接セッションを開始できませんでした。' }, { status: 502 })
  }

  // 外部API待機中に終了・同意撤回された面接へ資格情報を渡さない。
  let current = await loadSessionByToken(p.token)
  if (!current) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (!current.consentedAt) return NextResponse.json({ error: '先に同意が必要です' }, { status: 403 })
  let allowed = assertUsable(current)
  if (!allowed.ok) return NextResponse.json({ error: allowed.reason }, { status: allowed.status })
  if (current.endedAt) return NextResponse.json({ error: 'この面接は既に終了しています。' }, { status: 409 })

  // 発行回数は上の予約で加算済み。並列開始でも開始時刻を上書きしない。
  if (!current.startedAt) {
    // 保持期限は実施日から数え直す。発行時点の仮の値のままだと、
    // 同意画面で伝えた「実施から◯日間保管」と実態がずれる。
    const purgeAfter = new Date(
      Date.now() + Math.max(1, s.organization.retentionDays) * 24 * 60 * 60 * 1000
    )
    await prisma.mensetsuSession.updateMany({
      where: { id: s.id, status: { in: ['pending', 'consented', 'live'] }, consentedAt: { not: null }, endedAt: null, startedAt: null, expiresAt: { gt: new Date() } },
      data: { status: 'live', startedAt: new Date(), purgeAfter },
    })
  }

  current = await loadSessionByToken(p.token)
  if (!current) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (!current.consentedAt) return NextResponse.json({ error: '先に同意が必要です' }, { status: 403 })
  allowed = assertUsable(current)
  if (!allowed.ok) return NextResponse.json({ error: allowed.reason }, { status: allowed.status })
  if (current.endedAt || current.status !== 'live' || !current.startedAt) {
    return NextResponse.json({ error: '面接の状態が変わりました。再読み込みしてご確認ください。' }, { status: 409 })
  }
  if (Date.now() - current.startedAt.getTime() > graceMs) {
    return NextResponse.json({ error: 'この面接の実施時間を過ぎています。採用ご担当者にお問い合わせください。' }, { status: 410 })
  }

  return NextResponse.json({
    clientSecret,
    expiresAt: data?.expires_at ?? null,
    model: REALTIME_MODEL,
    durationMin: s.template.durationMin,
    questionCount: s.template.questions.length,
    // 冒頭の一言目はクライアントから response.create で促す
    firstQuestion: s.template.questions[0]?.text ?? null,
  })
}
