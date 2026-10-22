// 旧呼び出し形式の互換窓口。公開状態と許可判定は canonical helper に集約する。
import { canUseBetaService as canonicalCanUseBetaService, betaAllowEmails } from './beta-service'

export { betaAllowEmails }
export { canAccessBetaService as betaServiceAllowed, betaServiceDenied as betaServiceGuard } from './beta-service.server'

export function canUseBetaService(serviceId: string, email: string | null | undefined, allow: string[] = betaAllowEmails()): boolean {
  return canonicalCanUseBetaService(serviceId, email, { allow })
}
