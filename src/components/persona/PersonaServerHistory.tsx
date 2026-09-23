'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { personaBrowserStorage } from '@/lib/persona/browser-storage'
import { deletePersonaRecord } from '@/lib/persona/history-records'

type Item = { id: string; name: string; occupation: string; createdAt: string }
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
const buttonClass = 'rounded-lg border border-slate-600 px-3 py-2 text-sm text-purple-300 disabled:opacity-50'

export default function PersonaServerHistory({ userId, onLocalChange }: { userId: string; onLocalChange: () => void }) {
  const storage = useMemo(() => personaBrowserStorage(userId), [userId])
  const request = useRef<AbortController | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const list = useCallback(async (next: string | null = null) => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/persona/projects${next ? `?cursor=${encodeURIComponent(next)}` : ''}`, {
        cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      })
      if (!response.ok) throw new Error('History unavailable')
      const body = await response.json()
      if (!Array.isArray(body.items) || body.items.some((item: Item) => !item || !ID.test(item.id) || typeof item.name !== 'string' || typeof item.occupation !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) ||
        !(body.nextCursor === null || typeof body.nextCursor === 'string')) throw new Error('Invalid history')
      if (controller.signal.aborted) return
      setItems(previous => next ? [...new Map([...previous, ...body.items].map(item => [item.id, item])).values()] : body.items)
      setCursor(body.nextCursor)
      setLoaded(true)
    } catch {
      if (!controller.signal.aborted) setError('保存済みの履歴を取得できませんでした。表示中の履歴は前回取得した内容です。再度お試しください。')
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false) }
    }
  }, [])

  useEffect(() => {
    void list()
    return () => { request.current?.abort(); request.current = null }
  }, [list])

  const act = async (item: Item, remove: boolean) => {
    if (request.current) return
    if (remove && !window.confirm('このペルソナを保存済み履歴から削除しますか？ 保存画像も開けなくなります。使用済みの生成枠は戻りません。')) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    let serverDeleted = false
    try {
      const response = await fetch(`/api/persona/projects/${item.id}`, {
        method: remove ? 'DELETE' : 'GET', cache: 'no-store',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      })
      if (!response.ok) throw new Error('History operation failed')
      const body = await response.json()
      if (controller.signal.aborted) return
      if (remove) {
        if (body.deleted !== true) throw new Error('Deletion unconfirmed')
        serverDeleted = true
        setItems(previous => previous.filter(row => row.id !== item.id))
        deletePersonaRecord(storage, { id: item.id, data: null, url: '', timestamp: 0 })
        onLocalChange()
      } else {
        if (body.id !== item.id || !body.data?.persona || typeof body.data.persona !== 'object' || Array.isArray(body.data.persona) || !Number.isFinite(body.timestamp)) throw new Error('Invalid project')
        window.location.assign(`/persona/projects/${item.id}`)
      }
    } catch {
      if (!controller.signal.aborted) setError(serverDeleted
        ? '保存済み履歴は削除しましたが、このブラウザのコピーを消去できませんでした。ブラウザ内の履歴も削除してください。'
        : remove ? '削除を確認できませんでした。一覧を再読み込みしてご確認ください。'
          : 'ペルソナを開けませんでした。削除済みでないか、通信状態をご確認ください。')
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false) }
    }
  }

  return <section aria-label="アカウントの保存済み履歴" aria-busy={busy} className="mb-8 rounded-xl border border-slate-700 bg-slate-900/80 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-bold text-white">アカウントの保存済み履歴</h2>
      <button type="button" className={buttonClass} disabled={busy} onClick={() => void list()}>再読み込み</button>
    </div>
    <p className="my-3 text-sm text-slate-400">同じアカウントで別の端末からも開けます。保存方式の変更前に生成した履歴は、下の「このブラウザの履歴」からご確認ください。</p>
    <p className="mb-3 text-xs text-slate-400">以前に保存した履歴には入力URLが残っていない場合があります。文章を変更する際は入力URLをご確認ください。</p>
    {error && <p role="alert" className="my-3 text-sm text-red-400">{error}</p>}
    {busy && <p role="status" className="my-3 text-sm text-slate-300">処理しています。</p>}
    {loaded && !items.length && !error && <p className="py-4 text-slate-400">保存済みの履歴はありません。</p>}
    <ul className="space-y-3">
      {items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 pt-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-bold text-white">{item.name}</h3>
          <p className="break-words text-sm text-slate-400">{item.occupation}</p>
          <time className="text-xs text-slate-400" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('ja-JP')}</time>
        </div>
        <div className="flex gap-2">
          <button type="button" className={buttonClass} disabled={busy} onClick={() => void act(item, false)} aria-label={`${item.name}を開く`}>開く</button>
          <button type="button" className={buttonClass} disabled={busy} onClick={() => void act(item, true)} aria-label={`${item.name}を削除`}>削除</button>
        </div>
      </li>)}
    </ul>
    {cursor && <button type="button" className={`${buttonClass} mt-4`} disabled={busy} onClick={() => void list(cursor)}>続きを読み込む</button>}
  </section>
}
