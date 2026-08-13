// ============================================
// ドヤ面接官 応募者向け（未認証）アクセス
// ============================================
// ⚠️ このファイルを通るAPIは、ログインしていない第三者（応募者）が叩く。
//    本サービス最大のセキュリティ論点であり、以下を必ず守ること:
//      1. スコープは session.token のみ。organizationId を外から受け取らない
//      2. 返却は下の toPublicSession() が返す形だけ（ホワイトリスト）
//      3. 評価結果・ルーブリック・他候補者の情報は絶対に返さない
import { prisma } from '@/lib/prisma'

export interface PublicSession {
  token: string
  status: string
  candidateName: string | null
  companyName: string
  jobTitle: string
  durationMin: number
  intro: string | null
  questionCount: number
  consented: boolean
  recordAudio: boolean
  retentionDays: number
  expired: boolean
  /** 本人確認のためメールアドレスの入力が必要か。⚠️ メール自体は返さない */
  requiresEmail: boolean
  /** 面接後に本人へフィードバックを開示する設定か */
  discloseToCandidate: boolean
}

/** トークンから面接セッションを解決する（内部用。返却にそのまま使わない） */
export async function loadSessionByToken(token: string) {
  if (!token || token.length < 16) return null
  return prisma.mensetsuSession.findUnique({
    where: { token },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          recordAudio: true,
          retentionDays: true,
          discloseToCandidate: true,
        },
      },
      template: {
        select: {
          id: true,
          jobTitle: true,
          level: true,
          durationMin: true,
          intro: true,
          closing: true,
          questions: { orderBy: { ord: 'asc' }, select: { ord: true, text: true, followUpHint: true } },
        },
      },
    },
  })
}

export type LoadedSession = NonNullable<Awaited<ReturnType<typeof loadSessionByToken>>>

/** 応募者に返してよいフィールドだけを組み立てる（ホワイトリスト） */
export function toPublicSession(s: LoadedSession): PublicSession {
  return {
    token: s.token,
    status: s.status,
    candidateName: s.candidateName,
    companyName: s.organization.name,
    jobTitle: s.template.jobTitle,
    durationMin: s.template.durationMin,
    intro: s.template.intro,
    questionCount: s.template.questions.length,
    consented: !!s.consentedAt,
    recordAudio: s.organization.recordAudio,
    retentionDays: s.organization.retentionDays,
    expired: s.expiresAt.getTime() < Date.now(),
    // ⚠️ 「入力が必要か」という真偽値だけ返す。登録されたメールそのものは返さない
    //    （URLを拾った第三者に応募者のメールを教えてしまう）
    requiresEmail: !!s.candidateEmail,
    discloseToCandidate: s.organization.discloseToCandidate,
  }
}

/** セッションが面接を開始・継続できる状態か */
export function assertUsable(s: LoadedSession): { ok: true } | { ok: false; reason: string; status: number } {
  if (s.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'この面接URLの有効期限が切れています。', status: 410 }
  }
  if (s.status === 'completed' || s.status === 'evaluated') {
    return { ok: false, reason: 'この面接は既に終了しています。', status: 409 }
  }
  if (s.status === 'expired' || s.status === 'aborted') {
    return { ok: false, reason: 'この面接は受けられません。', status: 409 }
  }
  return { ok: true }
}
