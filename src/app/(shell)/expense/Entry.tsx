'use client'

// ドヤ支出管理 入口（ログイン済み）: 所属組織があればそこへ、なければ組織作成フォーム
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import { NavigationSubmissionError, startGoogleSignIn, useNavigationSubmission } from '@/lib/use-navigation-submission'
import { useEntryActorScope } from '@/lib/use-entry-organization'
import { readExpenseEntry, expenseEntrySlug, type ExpenseEntryResult } from '@/lib/expense/entry-client'
import tokens from '@/components/ds/tokens.module.css'
import { Btn, Field, inputCls, Loading, EmptyState, ErrorBox } from '@/components/expense/ui'
import { useUiNext } from '@/components/shell/ui-next-context'
import { EntryNext } from '@/components/expense/next'

/** Only the initial matching authenticated actor may use the server's verified absence. */
export default function ExpenseEntry({ knownActor }: { knownActor?: string } = {}) {
  const scope = useEntryActorScope()
  return <ExpenseEntryContent key={scope.version} scope={scope} knownActor={knownActor} />
}

function ExpenseEntryContent({ scope, knownActor }: { scope: ReturnType<typeof useEntryActorScope>; knownActor?: string }) {
  const router = useRouter()
  const uiNext = useUiNext()
  const { actor, status, version, current } = scope
  const verifiedEmpty = version === 0 && status === 'authenticated' && !!actor && actor === knownActor
  const [result, setResult] = useState<ExpenseEntryResult | { state: 'loading' | 'error' }>(() => ({ state: verifiedEmpty ? 'empty' : 'loading' }))
  const [attempt, setAttempt] = useState(0)
  const [orgName, setOrgName] = useState('')
  const [memberName, setMemberName] = useState('')
  const { busy, run: submit } = useNavigationSubmission('組織を作成できませんでした。保存済みの組織を確認してから、もう一度お試しください。')

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) setAttempt(value => value + 1) }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const active = () => !controller.signal.aborted && current()
    if (verifiedEmpty && attempt === 0) return () => controller.abort()
    setResult({ state: 'loading' })
    if (status === 'loading') return () => controller.abort()
    if (status !== 'authenticated') {
      setResult({ state: 'unauthenticated' })
      return () => controller.abort()
    }
    if (!actor) {
      setResult({ state: 'error' })
      return () => controller.abort()
    }
    void readExpenseEntry(controller.signal).then(next => {
      if (!active()) return
      setResult(next)
      if (next.state === 'found') router.replace(`/expense/${encodeURIComponent(next.slug)}`)
    }).catch(() => { if (active()) setResult({ state: 'error' }) })
    return () => controller.abort()
  }, [router, actor, status, version, current, verifiedEmpty, attempt])

  const create = async () => {
    if (!scope.current() || result.state !== 'empty' || !scope.actor || !orgName.trim() || !memberName.trim()) return
    await submit(async isCurrent => {
      const res = await fetch('/api/expense/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, memberName }),
      })
      if (!isCurrent() || !scope.current()) return
      if (res.status === 401) {
        await startGoogleSignIn('/expense')
        return
      }
      if (res.status === 403) { setResult({ state: 'forbidden' }); return }
      const d = await res.json().catch(() => ({}))
      if (!isCurrent() || !scope.current()) return
      if (!res.ok) throw new NavigationSubmissionError('組織を作成できませんでした。入力内容を確認して、もう一度お試しください。')
      router.replace(`/expense/${encodeURIComponent(expenseEntrySlug(d?.organization?.slug))}`)
    })
  }

  if (result.state === 'unauthenticated') return <div className={`${tokens.ds} mx-auto max-w-md p-6`}><EmptyState text="ログインの有効期限が切れました。もう一度ログインしてください。" actionLabel="ログインする" href="/auth/signin?callbackUrl=%2Fexpense" /></div>
  if (result.state === 'forbidden') return <div className={`${tokens.ds} mx-auto max-w-md p-6`}><ErrorBox forbidden /></div>
  if (result.state === 'error') return <div className={`${tokens.ds} mx-auto max-w-md p-6`}><ErrorBox onRetry={() => setAttempt(value => value + 1)} /></div>
  const checking = result.state !== 'empty'

  // 新しい見た目（チェックリスト §5.1）: キービジュアルと「3ステップで始める」の案内（S-69）
  if (uiNext && !checking) {
    return (
      <>
        <Toaster position="top-center" />
        <EntryNext
          orgName={orgName}
          memberName={memberName}
          busy={busy}
          onOrgName={setOrgName}
          onMemberName={setMemberName}
          onCreate={create}
        />
      </>
    )
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
