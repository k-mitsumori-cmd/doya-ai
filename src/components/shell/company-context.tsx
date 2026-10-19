'use client'
// ============================================
// 「登録会社」を枠・ホーム・ツールの見出しに伝える（UI 品質 B-1・B-2）
// ============================================
// 組織の一覧はサーバー（src/lib/shell/company.server.ts）が集め、(shell)/layout.tsx から渡す。
// どれを今の会社として出すかは src/lib/shell/company.ts の pickCurrentCompany()。
// ⚠️ 表示だけ。ここで選んだ組織で読み書きしない。
import { usePathname, useSearchParams } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { pickCurrentCompany, type ShellCompany, type ShellCompanyRef } from '@/lib/shell/company'

export const ShellCompaniesContext = createContext<ShellCompany[] | null>(null)

const LAST_KEY = 'doya_shell_last_company'

function readLast(): ShellCompanyRef | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(LAST_KEY) || 'null')
    return v && typeof v.tool === 'string' && typeof v.slug === 'string' ? { tool: v.tool, slug: v.slug } : null
  } catch {
    return null
  }
}

/** 組織の一覧と、今の画面の会社。一覧を渡されていない（今の見た目）ときは null */
export function useShellCompany(): { companies: ShellCompany[]; current: ShellCompany | null } | null {
  const companies = useContext(ShellCompaniesContext)
  const pathname = usePathname() || '/'
  const orgParam = useSearchParams()?.get('org') ?? null
  const [last, setLast] = useState<ShellCompanyRef | null>(null)
  useEffect(() => setLast(readLast()), [])
  const current = useMemo(
    () => (companies ? pickCurrentCompany(companies, pathname, orgParam, last) : null),
    [companies, pathname, orgParam, last],
  )
  // そのツールの組織の画面にいるときだけ「最後に使った会社」として覚える
  const onTool = Boolean(current && pathname.split('/')[1] === current.tool)
  useEffect(() => {
    if (!current || !onTool) return
    try { window.localStorage.setItem(LAST_KEY, JSON.stringify({ tool: current.tool, slug: current.slug })) } catch { /* 覚えられなくても表示は出す */ }
  }, [current, onTool])
  if (!companies) return null
  return { companies, current }
}
