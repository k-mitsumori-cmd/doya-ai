// ============================================
// ドヤカンニング セッションコンテキスト解決（共有）
// ============================================
// answer / prep ルートが共通で使う「セッションの所有確認＋モード・参照先(KB/企業/応募者)解決」。
// 所有外の参照先は null（黙って無視）。セッション自体が未所有/不在なら null を返す。
import { prisma } from '@/lib/prisma'
import { getMode } from './modes'
import type { ApplicantProfileLite, CompanyProfileLite, CunningMode } from './types'

export interface SessionContext {
  mode: CunningMode
  knowledgeBaseId: string | null // sales: 所有確認済みのナレッジID（チャンク取得は呼び出し側）
  company: CompanyProfileLite | null
  applicant: ApplicantProfileLite | null
}

export async function resolveSessionContext(
  userId: string,
  sessionId: string
): Promise<SessionContext | null> {
  const session = await prisma.cunningSession.findUnique({ where: { id: sessionId } })
  if (!session || session.userId !== userId) return null

  const def = getMode(session.mode)
  const mode: CunningMode = def.id
  let knowledgeBaseId: string | null = null
  let company: CompanyProfileLite | null = null
  let applicant: ApplicantProfileLite | null = null

  if (def.context === 'knowledge' && session.knowledgeBaseId) {
    const kb = await prisma.cunningKnowledgeBase.findUnique({
      where: { id: session.knowledgeBaseId },
      select: { userId: true },
    })
    if (kb && kb.userId === userId) knowledgeBaseId = session.knowledgeBaseId
  }
  if (def.context === 'company') {
    if (session.companyProfileId) {
      const cp = await prisma.cunningCompanyProfile.findUnique({ where: { id: session.companyProfileId } })
      if (cp && cp.userId === userId) {
        company = { companyName: cp.companyName, businessSummary: cp.businessSummary, requirements: cp.requirements }
      }
    }
    if (session.applicantProfileId) {
      const ap = await prisma.cunningApplicantProfile.findUnique({ where: { id: session.applicantProfileId } })
      if (ap && ap.userId === userId) {
        applicant = { name: ap.name, resume: ap.resume, motivation: ap.motivation }
      }
    }
  }
  return { mode, knowledgeBaseId, company, applicant }
}
