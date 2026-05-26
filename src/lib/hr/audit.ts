import { prisma } from '@/lib/prisma'

// ============================================
// ドヤHR 監査ログ
// ============================================

export interface LogAuditParams {
  organizationId: string
  userId: string
  userName?: string | null
  action: string
  target: string
  targetId?: string | null
  details?: Record<string, unknown> | null
  ipAddress?: string | null
}

/**
 * 監査ログを非同期で記録する（エラー時はconsole.errorのみ）
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await prisma.hrAuditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        userName: params.userName || null,
        action: params.action,
        target: params.target,
        targetId: params.targetId || null,
        details: (params.details as any) || null,
        ipAddress: params.ipAddress || null,
      },
    })
  } catch (e) {
    console.error('[HrAudit] Failed to write audit log:', e)
  }
}
