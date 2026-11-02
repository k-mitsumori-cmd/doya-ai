'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { formatBytes } from '@/lib/storage-plans'

type FileRow = { id: string; fileName: string; fileSize: number; createdAt: string; expiresAt: string | null }
type Data = {
  plan: { label: string; quotaBytes: number; retentionDays: number | null }
  usedBytes: number
  remainingBytes: number
  files: FileRow[]
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
const daysLeft = (s: string) => Math.ceil((new Date(s).getTime() - Date.now()) / 86400000)

export default function StoredFilesPage() {
  const { status } = useSession()
  const [data, setData] = useState<Data | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/stored-files', { cache: 'no-store' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || !j.success) { setError(j.error || '読み込めませんでした'); return }
    setData(j)
    setSelected(new Set())
  }, [])

  useEffect(() => { if (status === 'authenticated') load() }, [status, load])

  if (status === 'loading') return null
  if (status === 'unauthenticated') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-slate-700">保存しているファイルの確認にはログインが必要です。</p>
        <Link href="/auth/signin?callbackUrl=/settings/files" className="mt-4 inline-block rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">ログインする</Link>
      </main>
    )
  }

  const remove = async () => {
    if (!selected.size || !confirm(`選んだ${selected.size}件のファイルを削除します。元に戻せません。よろしいですか。`)) return
    setBusy(true); setError(null)
    let failed = 0
    for (const id of selected) {
      const r = await fetch(`/api/stored-files/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!r.ok) failed++
    }
    if (failed) setError(`${failed}件を削除できませんでした。しばらくしてからお試しください。`)
    await load()
    setBusy(false)
  }

  const pct = data ? Math.min(100, Math.round((data.usedBytes / data.plan.quotaBytes) * 100)) : 0

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-black text-slate-900">保存しているファイル</h1>
      {data && (
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-800">
            {formatBytes(data.usedBytes)} / {formatBytes(data.plan.quotaBytes)} を使用中（{data.plan.label}）
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-600">あと{formatBytes(data.remainingBytes)}まで保存できます。</p>
          <p className="mt-1 text-xs text-slate-600">
            {data.plan.retentionDays === null
              ? '契約している間は保存されます。無料プランに変わった場合は、30日後に削除されます。'
              : `保存期間は置いた日から${data.plan.retentionDays}日です。期限の7日前にメールでお知らせします。`}
          </p>
        </section>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {data && data.files.length === 0 && <p className="mt-6 text-sm text-slate-600">保存しているファイルはありません。</p>}
      {data && data.files.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={selected.size === data.files.length}
                onChange={e => setSelected(e.target.checked ? new Set(data.files.map(f => f.id)) : new Set())} />
              すべて選ぶ
            </label>
            <button type="button" disabled={!selected.size || busy} onClick={remove}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
              選んだファイルを削除（{selected.size}件）
            </button>
          </div>
          <ul className="mt-3 space-y-2">
            {data.files.map(f => {
              const left = f.expiresAt ? daysLeft(f.expiresAt) : null
              return (
                <li key={f.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <input type="checkbox" checked={selected.has(f.id)} aria-label={`${f.fileName}を選ぶ`}
                    onChange={e => setSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(f.id) : n.delete(f.id); return n })} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{f.fileName}</p>
                    <p className="text-xs text-slate-500">
                      {formatBytes(f.fileSize)}　{fmtDate(f.createdAt)}に保存
                      {f.expiresAt ? `　${fmtDate(f.expiresAt)}に削除予定` : ''}
                    </p>
                  </div>
                  {left !== null && left <= 7 && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">あと{Math.max(0, left)}日</span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      <p className="mt-8 text-xs text-slate-500">
        <Link href="/media/upload" className="underline">動画・音声を取り込む</Link>
      </p>
    </main>
  )
}
