'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import PersonaTool, { type PersonaRestoredRecord } from '@/app/persona/Tool'
import { isPersonaDisplayData, hasValidPersonaImages } from '@/lib/persona/display-data'

export default function PersonaSavedProject({ projectId }: { projectId: string }) {
  const { data: session, status } = useSession()
  if (status !== 'authenticated' || !session?.user?.id) return <p role="status" className="p-6">{status === 'loading' ? 'ログイン状態を確認しています。' : '保存済みペルソナを開くにはログインしてください。'}</p>
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
          setError(response.status === 401 ? '再度ログインしてください。' : '履歴が削除されたか、このアカウントでは開けません。')
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
        if (!controller.signal.aborted) setError('保存済みペルソナを確認できませんでした。通信状態をご確認のうえ、再度お試しください。')
      } finally {
        pending = false
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void read()
    return () => { controller.abort() }
  }, [projectId, revision])

  return <>
    {loading && !record && <p role="status" className="p-6">保存済みペルソナを読み込んでいます。</p>}
    {error && <div role="alert" className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
      <p>{error}</p>
      <button type="button" className="mt-3 rounded-lg border border-red-300 px-4 py-2 disabled:opacity-50" disabled={loading} onClick={() => setRevision(value => value + 1)}>再試行</button>
      <a href="/persona/history" className="ml-4 underline">履歴一覧に戻る</a>
    </div>}
    {record && <PersonaTool initialRecord={record} />}
  </>
}
