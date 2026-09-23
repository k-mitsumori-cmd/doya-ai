'use client'

import { useEffect, useRef, useState } from 'react'

// Mount with key={conceptId} so an earlier concept cannot update the next one's feedback.
export default function ExportDownload({ conceptId }: { conceptId: string }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [available, setAvailable] = useState(0)
  const request = useRef<AbortController | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; request.current?.abort() }
  }, [])

  async function download(partial = false) {
    if (request.current || !conceptId) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setMessage('')
    setAvailable(0)
    const timeout = setTimeout(() => controller.abort(), 180_000)
    try {
      const response = await fetch(`/api/adimage/concepts/${encodeURIComponent(conceptId)}/export${partial ? '?partial=1' : ''}`, {
        signal: controller.signal, cache: 'no-store',
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        if (!alive.current) return
        if (result.code === 'EXPORT_IMAGES_UNAVAILABLE' && Number.isSafeInteger(result.availableCount) && result.availableCount > 0) {
          setAvailable(result.availableCount)
        }
        throw new Error(result.error || 'ダウンロードの準備に失敗しました。再試行してください。')
      }
      if (!response.headers.get('content-type')?.includes('application/zip')) {
        throw new Error('ZIPを取得できませんでした。ログイン状態を確認して再試行してください。')
      }
      const blob = await response.blob()
      if (!blob.size) throw new Error('取得したファイルが空です。再試行してください。')
      if (!alive.current || controller.signal.aborted) return
      const missing = Number(response.headers.get('X-Export-Missing-Count') || 0)
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = `adimage_${conceptId}${missing > 0 ? '_partial' : ''}.zip`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(href), 60_000)
      setMessage(missing > 0
        ? `${missing}枚が不足したZIPの保存を開始しました。不足一覧をZIP内に同梱しています。全画像の取得は再試行できます。`
        : 'ZIPの保存を開始しました。ブラウザのダウンロードをご確認ください。')
    } catch (error) {
      if (alive.current) setMessage(controller.signal.aborted
        ? '取得に時間がかかっています。時間をおいて再試行してください。'
        : error instanceof Error ? error.message : 'ダウンロードに失敗しました。再試行してください。')
    } finally {
      clearTimeout(timeout)
      request.current = null
      if (alive.current) setBusy(false)
    }
  }

  return (
    <div className="mt-2 max-w-full text-xs">
      <button type="button" onClick={() => void download()} disabled={busy || !conceptId}
        className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        {busy ? 'ZIPを準備しています…' : 'すべてダウンロード（ZIP）'}
      </button>
      {message && <p role="status" className="mt-2 max-w-lg break-words text-slate-700">{message}</p>}
      {available > 0 && <button type="button" onClick={() => void download(true)} disabled={busy}
        className="mt-2 rounded-lg border border-amber-600 px-3 py-2 font-semibold text-amber-800 disabled:opacity-50">
        取得できる画像のみ保存（現在{available}枚・不足一覧付き）
      </button>}
    </div>
  )
}
