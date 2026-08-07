import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * ドヤ面接官 保持期限切れデータの自動削除（Vercel Cron・毎日）。
 *
 * 応募者には「記録は◯日間保管され、その後削除されます」と同意画面で明示している（C1）。
 * このcronがその約束を実際に履行する。動かなければ、同意内容と実態が食い違う。
 *
 * 削除するもの（＝応募者の個人データ）:
 *   - 逐語ログ（MensetsuTurn）… 発話そのもの
 *   - 採点の根拠引用（MensetsuScore.quotes）… ここにも応募者の発言が入っている
 *   - 氏名・メール・同意時のIP/UA
 *   - 録音ファイル（Supabase Storage）
 *
 * 残すもの（統計用。個人を特定しない）:
 *   - 面接の実施日時・所要・判定・スコアの数値・組織/テンプレートの紐付け
 *
 * ⚠️ スコアの rationale（採点理由）は本文に発言が引用されている可能性があるため、
 *    安全側に倒して削除する。数値スコアだけを残す。
 *
 * 認証: Authorization: Bearer ${CRON_SECRET}
 */

const BATCH = 200

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse('unauthorized', { status: 401 })
  }

  const now = new Date()

  // 1) 期限切れの未実施セッションを expired にする（応募者が開いても受けられない状態）
  const expired = await prisma.mensetsuSession.updateMany({
    where: {
      expiresAt: { lt: now },
      status: { in: ['pending', 'consented'] },
    },
    data: { status: 'expired' },
  })

  // 2) 保持期限を過ぎたセッションの個人データを削除
  const targets = await prisma.mensetsuSession.findMany({
    where: {
      purgeAfter: { lt: now },
      // 既に消したものを毎日拾い直さないよう、未処理のものだけを対象にする。
      // ⚠️ 氏名・メールが未入力の面接でも逐語ログは残るため、turns の有無も条件に入れる。
      //    PIIだけで判定すると、匿名で受けた面接のログが永久に消えなくなる。
      OR: [
        { candidateName: { not: null } },
        { candidateEmail: { not: null } },
        { consentIp: { not: null } },
        { recordingPath: { not: null } },
        { turns: { some: {} } },
      ],
    },
    select: { id: true, recordingPath: true },
    take: BATCH,
  })

  let purgedSessions = 0
  let purgedTurns = 0
  const storageFailures: string[] = []

  for (const s of targets) {
    // ⚠️ Storage の削除を先に試す。DB側の recordingPath を先に消すと、
    //    Storage 削除が失敗したときにパスを二度と辿れず、音声が永久に残る。
    let storageOk = true
    if (s.recordingPath) {
      try {
        const { deleteRecording } = await import('@/lib/mensetsu/storage')
        await deleteRecording(s.recordingPath)
      } catch (e: any) {
        storageOk = false
        storageFailures.push(s.recordingPath)
        console.error('[mensetsu-purge] storage delete failed', s.recordingPath, e?.message)
      }
    }

    try {
      const del = await prisma.mensetsuTurn.deleteMany({ where: { sessionId: s.id } })
      purgedTurns += del.count

      await prisma.mensetsuScore.updateMany({
        where: { sessionId: s.id },
        data: { quotes: [], rationale: null },
      })

      await prisma.mensetsuSession.update({
        where: { id: s.id },
        data: {
          candidateName: null,
          candidateEmail: null,
          consentIp: null,
          consentUa: null,
          // 消せなかったパスは残す（次回の実行で再試行できるように）
          ...(storageOk ? { recordingPath: null } : {}),
          // 応募者向けの文面にも発言内容が含まれうるため消す。担当者向けレポートは残す判断もあるが、
          // 引用が入っている可能性があるため同様に消す。
          candidateFeedback: null,
          recruiterReport: null,
          // 総評にも応募者の発言の言い換え・引用が入るため必ず消す。
          // ここが残っていると「◯日で削除」の約束と実態がずれる。
          overallComment: null,
        },
      })
      purgedSessions++
    } catch (e: any) {
      // 1件の失敗で全体を止めない。次回のcronで再試行される。
      console.error('[mensetsu-purge] failed', s.id, e?.message)
    }

  }

  const remaining = await prisma.mensetsuSession.count({
    where: {
      purgeAfter: { lt: now },
      OR: [{ candidateName: { not: null } }, { candidateEmail: { not: null } }, { consentIp: { not: null } }],
    },
  })

  return NextResponse.json({
    ok: true,
    expiredSessions: expired.count,
    purgedSessions,
    purgedTurns,
    storageFailures: storageFailures.length,
    // BATCH上限で積み残した件数。0でなければ翌日以降も削除が続く。
    remaining,
  })
}
