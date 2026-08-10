export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/aishodan/room/[token]/end — 商談を終了し、要約とフィット判定を作る
//
// ⚠️ 「開始していないセッション」は終了させない。
//    リンクのプレビューやページを開いて閉じただけで商談が死ぬ事故を防ぐ（mensetsu で踏んだ）。
// ⚠️ 中断扱いにするかは、クライアントの申告ではなく**実際の発話数**で決める。
//    離脱ビーコンと明示終了の両方が aborted を送ってくると、
//    まともに実施した商談まで評価不能になる。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadGuestSession } from '@/lib/aishodan/session'
import { toScenarioConfig } from '@/lib/aishodan/public'
import { evaluateSession } from '@/lib/aishodan/evaluate'
import { postToSlackBlocks } from '@/lib/notifications'
import { VERDICT_LABELS } from '@/lib/aishodan/types'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

/** これ未満の発話数なら、商談が成立したとは見なさない */
const MIN_GUEST_TURNS = 2

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const body = await req.json().catch(() => ({}))
  const s = await loadGuestSession(req, p.token, String(body?.sessionId || ''))
  if (!s) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })

  // 開始していないなら何もしない（プレビューで死なせない）
  if (!s.startedAt) return NextResponse.json({ status: s.status, skipped: true })
  // すでに終わっているなら冪等に返す
  if (s.endedAt) return NextResponse.json({ status: s.status, alreadyEnded: true })

  const guestTurns = await prisma.aishodanTurn.count({ where: { sessionId: s.id, speaker: 'guest' } })

  if (guestTurns < MIN_GUEST_TURNS) {
    await prisma.aishodanSession.update({
      where: { id: s.id },
      data: { status: 'aborted', endedAt: new Date() },
    })
    return NextResponse.json({ status: 'aborted' })
  }

  await prisma.aishodanSession.update({
    where: { id: s.id },
    data: { status: 'completed', endedAt: new Date() },
  })

  const cfg = toScenarioConfig(s.room.scenario)
  const [turns, slotValues, unanswered] = await Promise.all([
    prisma.aishodanTurn.findMany({
      where: { sessionId: s.id },
      orderBy: [{ startMs: 'asc' }, { ord: 'asc' }],
      select: { speaker: true, text: true },
    }),
    prisma.aishodanSlotValue.findMany({ where: { sessionId: s.id }, select: { key: true, value: true } }),
    prisma.aishodanQuestion.findMany({
      where: { sessionId: s.id, unanswered: true },
      select: { text: true },
    }),
  ])

  let result
  try {
    result = await evaluateSession({
      productName: s.room.scenario.product.name,
      icp: cfg.icp,
      slots: cfg.slots,
      slotValues,
      turns,
      unansweredQuestions: unanswered.map((q) => q.text),
    })
  } catch (err) {
    // ⚠️ 評価に失敗しても商談ログは残す。completed のまま置き、後から再評価できる状態にする。
    console.error('[aishodan] evaluate failed', err instanceof Error ? err.message : err)
    // ⚠️ ここで黙って返すと、ホストは商談が行われたことすら知らないまま
    //    実際の見込み客が一覧の中で放置される。判定が出ていなくても必ず通知する。
    try {
      await postToSlackBlocks('AI商談が完了しました（判定は失敗）', [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              `*AI商談が完了しました*（${s.room.organization.name}）`,
              '⚠️ 適合判定の生成に失敗しました。内容はログからご確認ください。',
              `相手: ${s.guestCompany || '会社名未取得'} / ${s.guestName || 'お名前未取得'}`,
              `商材: ${s.room.scenario.product.name}`,
              s.schedulingClickedAt ? '日程調整: 予約ページを開きました' : '日程調整: 未（こちらから連絡が必要）',
              `${process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'}/aishodan/sessions/${s.id}`,
            ].join('\n'),
          },
        },
      ])
    } catch {
      /* 通知の失敗で商談ログを落とさない */
    }
    return NextResponse.json({ status: 'completed', evaluated: false })
  }

  await prisma.aishodanOutcome.upsert({
    where: { sessionId: s.id },
    create: {
      sessionId: s.id,
      fitScore: result.fitScore,
      verdict: result.verdict,
      reason: result.reason,
      summary: { ...result.summary, conditions: result.conditions } as any,
      nextAction: result.nextAction,
    },
    update: {
      fitScore: result.fitScore,
      verdict: result.verdict,
      reason: result.reason,
      summary: { ...result.summary, conditions: result.conditions } as any,
      nextAction: result.nextAction,
    },
  })
  await prisma.aishodanSession.update({ where: { id: s.id }, data: { status: 'evaluated' } })

  // ホストへの即時通知。商談が終わったことに気づけないと機会損失になる
  try {
    const lines = [
      `*AI商談が完了しました*（${s.room.organization.name}）`,
      `相手: ${s.guestCompany || '会社名未取得'} / ${s.guestName || 'お名前未取得'}`,
      `商材: ${s.room.scenario.product.name}`,
      `判定: ${VERDICT_LABELS[result.verdict]}（${result.fitScore}点）`,
      // ⚠️ 判定スコアより、日程調整に進んだかの方が事業上の意味が大きい
      s.schedulingClickedAt ? '日程調整: 予約ページを開きました' : '日程調整: 未（こちらから連絡が必要）',
      result.nextAction ? `次アクション: ${result.nextAction}` : '',
      `${process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'}/aishodan/sessions/${s.id}`,
    ].filter(Boolean)
    await postToSlackBlocks(lines[0], [
      { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
    ])
  } catch {
    /* 通知の失敗で商談結果を落とさない */
  }

  return NextResponse.json({
    status: 'evaluated',
    evaluated: true,
    // ゲスト側に返すのは「終わったこと」だけ。スコアや社内向けの判定理由は返さない
    thanks: true,
  })
}
