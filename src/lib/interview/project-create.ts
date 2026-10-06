import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { interviewGuestTotalLimit } from '@/lib/interview/access'

export class InterviewProjectCreateError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

export function interviewProjectCreationScope(userId: string | null, guestId: string | null): string {
  return createHash('sha256').update(JSON.stringify(userId ? ['user', userId] : ['guest', guestId])).digest('hex')
}

export async function createInterviewProject(data: Prisma.InterviewProjectUncheckedCreateInput, requestKey?: string) {
  const userId = data.userId || null, guestId = data.guestId || null
  if (!userId && !guestId) throw new InterviewProjectCreateError(409, 'GUEST_SESSION_REQUIRED', '利用情報を確認できませんでした。画面を開き直してください。')
  if (userId && !requestKey) return prisma.interviewProject.create({ data })
  const scope = interviewProjectCreationScope(userId, guestId)
  const receiptKey = requestKey ? 'interview-project-create:v1:' + createHash('sha256').update(scope + ':' + requestKey.toLowerCase()).digest('hex') : null
  const inputHash = createHash('sha256').update(JSON.stringify(data)).digest('hex')
  return prisma.$transaction(async tx => {
    // Guests share the existing cumulative-limit lock; account requests serialize by operation.
    if (!userId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-guest-project'), hashtext(${guestId!}))`
    else await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-project-create'), hashtext(${receiptKey!}))`
    if (receiptKey) {
      const receipt = await tx.systemSetting.findUnique({ where: { key: receiptKey }, select: { value: true } })
      if (receipt) {
        let saved: { projectId?: unknown; inputHash?: unknown; version?: unknown } | null = null
        try { saved = JSON.parse(receipt.value) } catch { /* Fail closed without modifying the receipt. */ }
        if (!saved || saved.version !== 1 || typeof saved.projectId !== 'string' || typeof saved.inputHash !== 'string') throw new Error('Invalid project creation receipt')
        if (saved.inputHash !== inputHash) throw new InterviewProjectCreateError(409, 'REQUEST_CONFLICT', '同じ作成操作の入力が変わっています。プロジェクト一覧を確認してから新しく作成してください。')
        const project = await tx.interviewProject.findFirst({ where: { id: saved.projectId, ...(userId ? { userId } : { userId: null, guestId }) } })
        // Keep the receipt after deletion/claim: a replay must never resurrect or disclose another owner's project.
        if (!project) throw new InterviewProjectCreateError(409, 'PROJECT_UNAVAILABLE', 'この作成操作のプロジェクトは現在開けません。一覧を確認してから新しく作成してください。')
        return project
      }
    }
    let used = 0
    const guestLedgerKey = `interview-guest-project:v1:${guestId!}`
    if (!userId) {
      const [currentProjects, ledger] = await Promise.all([
        tx.interviewProject.count({ where: { guestId: guestId! } }),
        tx.systemSetting.findUnique({ where: { key: guestLedgerKey }, select: { value: true } }),
      ])
      const historicalProjects = ledger ? Number(ledger.value) : 0
      if (!Number.isSafeInteger(historicalProjects) || historicalProjects < 0) throw new Error('Invalid interview guest project ledger')
      used = Math.max(currentProjects, historicalProjects)
      if (used >= interviewGuestTotalLimit()) return null
    }
    const project = await tx.interviewProject.create({ data })
    if (!userId) await tx.systemSetting.upsert({
      where: { key: guestLedgerKey }, create: { key: guestLedgerKey, value: String(used + 1) }, update: { value: String(used + 1) },
    })
    if (receiptKey) await tx.systemSetting.create({ data: { key: receiptKey, value: JSON.stringify({ version: 1, projectId: project.id, inputHash }) } })
    return project
  }, { maxWait: 10000, timeout: 15000 })
}
