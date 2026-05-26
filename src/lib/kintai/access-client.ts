import { ROLE_HIERARCHY } from './types'
import type { KintaiMemberRole } from './types'

/**
 * Client-safe role check (no server-only imports).
 */
export function hasMinRole(currentRole: string, minRole: KintaiMemberRole): boolean {
  return (ROLE_HIERARCHY[currentRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0)
}
