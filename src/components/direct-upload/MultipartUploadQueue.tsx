'use client'

// 大きなファイル（動画・音声）を小分けで送る画面部品。ファイルごとに進み具合・残り時間・送り直しを出す。
// 呼び出し側は、完了した objectKey を使って自分のDBに記録する（onDone）。

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { MultipartQueue, type QueueItem } from '@/lib/direct-upload/multipart-client'

function formatEta(sec: number | null) {
  if (sec === null) return '計算中'
  if (sec < 60) return `あと約${sec}秒`
  if (sec < 3600) return `あと約${Math.ceil(sec / 60)}分`
  return `あと約${Math.floor(sec / 3600)}時間${Math.ceil((sec % 3600) / 60)}分`
}
function formatSize(n: number) {
  return n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)}GB` : `${Math.round(n / 1024 ** 2)}MB`
}
const LABEL: Record<QueueItem['status'], string> = {
  queued: '順番待ち', uploading: '送信中', completing: '仕上げ中', done: '完了', error: '失敗', paused: '一時停止',
}

export default function MultipartUploadQueue({ onDone, accept = 'video/*,audio/*' }: {
  onDone?: (item: { fileName: string; objectKey: string; fileSize: number }) => void
  accept?: string
}) {
  const [queue] = useState(() => new MultipartQueue())
  const items = useSyncExternalStore(queue.subscribe, () => queue.items, () => queue.items)
  const notified = useRef(new Set<string>())

  useEffect(() => {
    for (const i of items) {
      if (i.status === 'done' && i.objectKey && !notified.current.has(i.key)) {
        notified.current.add(i.key)
        onDone?.({ fileName: i.file.name, objectKey: i.objectKey, fileSize: i.file.size })
      }
    }
  }, [items, onDone])

  return (
    <div className="space-y-3">
      <label className="inline-flex cursor-pointer items-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
        ファイルを選ぶ（複数可）
        <input type="file" multiple accept={accept} className="hidden"
          onChange={e => { if (e.target.files?.length) queue.add(Array.from(e.target.files)); e.target.value = '' }} />
      </label>
      <p className="text-xs text-slate-500">大きなファイルは小分けにして送ります。途中で切れても、同じファイルをもう一度選ぶと残りだけを送ります。</p>
      <ul className="space-y-2">
        {items.map(i => (
          <li key={i.key} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-bold text-slate-800">{i.file.name}</span>
              <span className="shrink-0 text-xs text-slate-500">{formatSize(i.file.size)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={i.percent} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full rounded-full ${i.status === 'error' ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${i.percent}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                {LABEL[i.status]}
                {i.resumed && i.status !== 'done' ? '（続きから）' : ''}
                {i.status === 'uploading' ? `　${i.percent}%　${formatEta(i.etaSeconds)}` : ''}
              </span>
              <span className="flex gap-2">
                {(i.status === 'error' || i.status === 'paused') && (
                  <button type="button" onClick={() => queue.retry(i.key)} className="rounded-full border border-slate-300 px-3 py-1 font-bold hover:bg-slate-50">送り直す</button>
                )}
                {i.status === 'uploading' && (
                  <button type="button" onClick={() => queue.pause(i.key)} className="rounded-full border border-slate-300 px-3 py-1 font-bold hover:bg-slate-50">一時停止</button>
                )}
                {i.status !== 'done' && (
                  <button type="button" onClick={() => queue.cancel(i.key)} className="rounded-full border border-slate-300 px-3 py-1 font-bold hover:bg-slate-50">取り消す</button>
                )}
              </span>
            </div>
            {i.error && <p className="mt-1 text-xs text-red-600">{i.error}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}
