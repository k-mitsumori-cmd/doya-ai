'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InterviewGuestClaimGate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const router = useRouter()
  const [attempt, setAttempt] = useState(0)
  const [ready, setReady] = useState(!enabled)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled) {
      setReady(true)
      return
    }
    let active = true
    setReady(false)
    setError('')
    fetch('/api/interview/claim-guest', { method: 'POST' })
      .then(async response => {
        const data = await response.json().catch(() => null)
        if (!response.ok || data?.success !== true) throw new Error(data?.error || '引き継ぎ状況を確認できませんでした。')
        if (!active) return
        setReady(true)
        router.refresh()
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : '引き継ぎ状況を確認できませんでした。')
      })
    return () => { active = false }
  }, [enabled, attempt, router])

  if (!enabled || ready) return <>{children}</>
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-bold text-slate-900">ゲストプロジェクトを引き継いでいます</h2>
      {error ? (
        <>
          <p className="text-sm leading-7 text-slate-700">{error} ゲストの作業は削除されていません。</p>
          <button type="button" onClick={() => setAttempt(value => value + 1)} className="rounded-xl bg-[#7f19e6] px-5 py-3 font-bold text-white">
            引き継ぎを再試行する
          </button>
        </>
      ) : (
        <p className="text-sm text-slate-600" role="status">処理が完了するまでお待ちください。</p>
      )}
    </div>
  )
}
