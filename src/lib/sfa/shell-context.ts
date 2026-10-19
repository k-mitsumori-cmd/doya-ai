// ============================================
// 営業管理: 共通の枠（ToolFrame）と組織の layout をつなぐ文脈
// ============================================
// 枠（SfaShellFrame）は src/app/(shell)/sfa/layout.tsx が出し、組織ごとの layout（[orgSlug]/layout.tsx）はその中に入る。
// 所属組織の一覧は組織の layout が /api/sfa/usage で取るので、枠の切り替えへはこの文脈で渡す。
// 枠が無い（従来のレイアウト）ときは文脈が null で、組織の layout は今までどおり自分でサイドバーを描く。
import { createContext, useContext } from 'react'

export interface SfaShellMembership { slug: string; name: string; role: string }

export interface SfaShellContextValue {
  publishMemberships: (memberships: SfaShellMembership[]) => void
}

export const SfaShellContext = createContext<SfaShellContextValue | null>(null)

export function useSfaShell(): SfaShellContextValue | null {
  return useContext(SfaShellContext)
}
