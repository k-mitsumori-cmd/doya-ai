// ============================================
// 共通の枠を持つツールの layout（ルートグループ (shell)）
// ============================================
// (shell) の下のツール（/popup・/income など）を移っても、この layout は作り直されない。
// そのため枠（AppShell）をここに1つだけ置き、ツールの側の layout では枠で包まない。
// どのパスで枠を出すかは src/components/shell/registry.ts が決める。
// ⚠️ ルートグループの名前（(shell)）は URL に出ない。/popup はそのまま /popup。
// ⚠️ ここでは枠だけを出す。ツール内のナビ（ToolFrame）・組織の切り替え・認可は、各ツールの layout が持つ。
// 手順: docs/architecture/management-agent/SHELL-MIGRATION.md
import type { ReactNode } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { shellEnabledIds } from '@/lib/ui-shell'
import { uiNextMode } from '@/lib/ui-next'
import { listShellCompanies } from '@/lib/shell/company.server'
import ShellGate from '@/components/shell/ShellGate'

export default async function ShellGroupLayout({ children }: { children: ReactNode }) {
  // ⚠️ ここで落ちると (shell) の下の全ツールが開けなくなる。ログインが分からないときは「未ログイン」として枠を出さない
  const session = await getServerSession(authOptions).catch(() => null)
  // 新しい見た目（UI 品質の直し）を出すか。サーバーで決めて、クライアントの部品には context で渡す（チェックリスト §5.1）
  const uiNext = session?.user ? await uiNextMode() : null
  // 左下の「登録会社」（UI 品質 B-1）。新しい見た目のときだけ集める。失敗しても枠は出す
  const companies = uiNext ? await listShellCompanies().catch(() => []) : null
  return (
    <ShellGate signedIn={Boolean(session?.user)} userName={session?.user?.name ?? null} enabledIds={shellEnabledIds()} uiNext={uiNext} companies={companies}>
      {children}
    </ShellGate>
  )
}
