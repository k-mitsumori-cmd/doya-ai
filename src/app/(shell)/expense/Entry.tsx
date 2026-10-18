'use client'

// ドヤ支出管理 入口（ログイン済み）: 所属組織があればそこへ、なければ組織作成フォーム
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { startGoogleSignIn } from '@/lib/use-navigation-submission'
import tokens from '@/components/ds/tokens.module.css'
import { Btn, Field, inputCls, Loading } from '@/components/expense/ui'

export default function ExpenseEntry() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [orgName, setOrgName] = useState('')
  const [memberName, setMemberName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/expense/usage', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const slug = d?.organization?.slug || d?.memberships?.[0]?.slug
        if (slug) router.replace(`/expense/${slug}`)
        else setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [router])

  const create = async () => {
    if (!orgName.trim() || !memberName.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/expense/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, memberName }),
      })
      if (res.status === 401) {
        await startGoogleSignIn('/expense')
        return
      }
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || '作成に失敗しました')
      router.replace(`/expense/${d.organization.slug}`)
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }

  if (checking) {
    return (
      <div className={`${tokens.ds} grid min-h-screen place-items-center bg-[var(--bg)]`}>
        <Loading />
      </div>
    )
  }

  return (
    <div className={`${tokens.ds} grid min-h-screen place-items-center bg-[var(--bg)] p-6`}>
      <Toaster position="top-center" />
      <div className="w-full max-w-md rounded-[var(--r)] border border-[var(--line)] bg-[var(--paper)] p-8 shadow-[var(--shadow-lg)]">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ui-renewal/mascots/expense.webp" alt="ドヤくん" width={96} height={96} className="mx-auto h-24 w-24 object-contain" />
          <h1 className="mt-3 text-2xl font-bold text-[var(--ink)]">ドヤ支出管理へようこそ</h1>
          <p className="mt-1 text-sm font-bold text-[var(--sub)]">組織を作成すると、すぐに使い始められます。</p>
        </div>
        <div className="space-y-3">
          <Field label="組織名（会社名）">
            <input className={inputCls} value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="例: 株式会社スリスタ" />
          </Field>
          <Field label="あなたの氏名">
            <input className={inputCls} value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="例: 三森 律稀" />
          </Field>
        </div>
        <div className="mt-6 flex justify-center">
          <Btn onClick={create} busy={busy} disabled={!orgName.trim() || !memberName.trim()}>
            組織を作成して始める
          </Btn>
        </div>
      </div>
    </div>
  )
}
