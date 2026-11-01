'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import PersonaTool, { type PersonaRestoredRecord } from '@/app/(shell)/persona/Tool'
import { isPersonaDisplayData, hasValidPersonaImages } from '@/lib/persona/display-data'
import { Skeleton } from '@/components/ds'

// 読み込み中は文字だけにせず、本文の場所に骨組みを出す（UX 点検 FIX-PLAN 13）
function SavedProjectSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6" aria-busy="true" aria-label={label}>
      <div className="rounded-2xl border border-gray-100 bg-white p-6"><Skeleton lines={2} height={20} delayMs={0} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-6"><Skeleton lines={4} delayMs={0} /></div>
        <div className="rounded-2xl border border-gray-100 bg-white p-6"><Skeleton lines={4} delayMs={0} /></div>
      </div>
    </div>
  )
}

export default function PersonaSavedProject({ projectId }: { projectId: string }) {
  const { data: session, status } = useSession()
  if (status === 'loading') return <SavedProjectSkeleton label="ログイン状態を確かめています" />
  if (status !== 'authenticated' || !session?.user?.id) return <p role="status" className="p-6">保存したペルソナを開くには、ログインしてください。</p>
  return <OwnedProject key={`${session.user.id}:${projectId}`} projectId={projectId} />
}

function OwnedProject({ projectId }: { projectId: string }) {
  const [record, setRecord] = useState<PersonaRestoredRecord | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    const read = async () => {
      if (pending) return
      pending = true
      setLoading(true)
      try {
        const response = await fetch(`/api/persona/projects/${projectId}`, {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        })
        if (controller.signal.aborted) return
        if (response.status === 401 || response.status === 404) {
          setRecord(null)
          setError(response.status === 401 ? 'ログインの期限が切れました。もう一度ログインしてください。' : '履歴が削除されたか、このアカウントでは開けません。')
          return
        }
        if (!response.ok) throw new Error('Project unavailable')
        const body = await response.json()
        if (body.id !== projectId || !isPersonaDisplayData(body.data) || !hasValidPersonaImages(body) || !Number.isFinite(body.timestamp) || (body.sourceUrl != null && typeof body.sourceUrl !== 'string')) throw new Error('Invalid project')
        if (controller.signal.aborted) return
        // A retry must not replace an in-progress edit with a fresh object.
        setRecord(previous => previous ?? body)
        setError('')
      } catch {
        if (!controller.signal.aborted) setError('保存したペルソナを読み込めませんでした。通信を確かめて、もう一度お試しください。')
      } finally {
        pending = false
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void read()
    return () => { controller.abort() }
  }, [projectId, revision])

  return <>
    {loading && !record && <SavedProjectSkeleton label="保存したペルソナを読み込んでいます" />}
    {error && <div role="alert" className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
      <p>{error}</p>
      <button type="button" className="mt-3 rounded-lg border border-red-300 px-4 py-2 disabled:opacity-50" disabled={loading} onClick={() => setRevision(value => value + 1)}>もう一度読み込む</button>
      <a href="/persona/history" className="ml-4 underline">履歴一覧に戻る</a>
    </div>}
    {record && <PersonaTool initialRecord={record} />}
  </>
}
