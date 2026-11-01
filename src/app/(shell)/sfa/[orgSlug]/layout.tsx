'use client'

import { Fragment, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { sfaJson } from '@/lib/sfa/client-response'
import { useSfaShell } from '@/lib/sfa/shell-context'

interface Membership { slug: string; name: string; role: string }

export default function SfaOrgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const orgSlug = (params.orgSlug as string) || ''
  const guard = useOrgSettingsGuard(orgSlug)
  // 共通の枠（SfaShellFrame）の中では、所属組織の一覧を枠へ渡す
  const shell = useSfaShell()
  const [usageKey, setUsageKey] = useState('')
  const [, setPlan] = useState<string | undefined>()
  const [memberships, setMemberships] = useState<Membership[]>([])

  useEffect(() => {
    if (!guard.allowed) return
    const operation = guard.begin('usage')
    if (!operation) return
    setPlan(undefined); setMemberships([]); setUsageKey('')
    sfaJson('/api/sfa/usage', orgSlug, { signal: operation.signal }).then(d => {
      if (!operation.current()) return
      if (typeof d.plan !== 'string' || !Array.isArray(d.memberships) || !d.memberships.every(m => m && typeof m === 'object' && typeof m.slug === 'string' && typeof m.name === 'string' && typeof m.role === 'string')) throw new Error()
      setPlan(d.plan); setMemberships(d.memberships as Membership[]); setUsageKey(guard.key)
    }).catch(() => { if (operation.current()) { setPlan(undefined); setMemberships([]) } }).finally(operation.end)
    return operation.end
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard.key, guard.allowed, orgSlug])
  const currentMemberships = guard.allowed && usageKey === guard.key ? memberships : []

  const membershipsKey = JSON.stringify(currentMemberships)
  useEffect(() => {
    if (!shell) return
    shell.publishMemberships(currentMemberships)
    return () => shell.publishMemberships([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shell, membershipsKey])

  // ログイン状態の確認が終わらないとき、読み込み中のまま止まらないよう案内を出す
  const [guardStalled, setGuardStalled] = useState(false)
  useEffect(() => {
    setGuardStalled(false)
    if (guard.allowed || guard.requiresLogin) return
    const timer = setTimeout(() => setGuardStalled(true), 15000)
    return () => clearTimeout(timer)
  }, [guard.allowed, guard.requiresLogin, guard.key])

  const guardView = (
    <>
    {!guard.allowed && (guardStalled && !guard.requiresLogin ? (
      <div role="alert" className="p-6 space-y-3">
        <p>ログイン状態を確認できませんでした。通信状況を確認して、ページを再読み込みしてください。</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold">再読み込み</button>
      </div>
    ) : <p role="status" className="p-6">{guard.requiresLogin ? '再度ログインしてください。' : 'ログイン状態を確認しています。'}</p>)}
    <div hidden={!guard.allowed}><Fragment key={guard.identity}>{children}</Fragment></div>
    </>
  )

  // 共通の枠（SfaShellFrame）の外は、ログインしていないときだけ。旧来のサイドバーは出さず、案内と中身だけを出す
  return (
    <>
      <Toaster position="top-center" />
      {guardView}
    </>
  )
}
