'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { sfaInit, fetchAllSfaAccounts } from '@/lib/sfa/client'

interface Contact {
  id: string
  name: string
  title: string | null
  department: string | null
  email: string | null
  phone: string | null
  isKeyPerson: boolean
  accountName: string | null
}
interface Account { id: string; name: string }

export default function SfaContactsPage() {
  const orgSlug = (useParams().orgSlug as string) || ''
  const ready = !!orgSlug
  const [contacts, setContacts] = useState<Contact[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [q, setQ] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [moreError, setMoreError] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [accountsError, setAccountsError] = useState(false)
  const [accountsLoading, setAccountsLoading] = useState(true)
  const requestVersion = useRef(0)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [accountId, setAccountId] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [isKeyPerson, setIsKeyPerson] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!ready) return
    const version = ++requestVersion.current
    const controller = new AbortController()
    setLoading(true)
    setListError(false)
    setMoreError(false)
    setMoreLoading(false)
    setNextCursor(null)
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (q.trim()) params.set('q', q.trim())
        const response = await fetch(`/api/sfa/contacts?${params}`, sfaInit(orgSlug, { signal: controller.signal }))
        const data = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(data?.contacts)) throw new Error('担当者の取得に失敗しました')
        if (version !== requestVersion.current) return
        setContacts(data.contacts)
        setNextCursor(data.nextCursor || null)
        setTotalCount(data.totalCount || 0)
      } catch {
        if (version === requestVersion.current) setListError(true)
      } finally {
        if (version === requestVersion.current) setLoading(false)
      }
    }, q ? 200 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [ready, orgSlug, q, refresh])

  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    setAccounts([])
    setAccountId('')
    setAccountsError(false)
    setAccountsLoading(true)
    fetchAllSfaAccounts(orgSlug, controller.signal)
      .then((all) => { if (!controller.signal.aborted) setAccounts(all) })
      .catch(() => { if (!controller.signal.aborted) setAccountsError(true) })
      .finally(() => { if (!controller.signal.aborted) setAccountsLoading(false) })
    return () => controller.abort()
  }, [ready, orgSlug])

  const loadMore = async () => {
    if (!nextCursor || moreLoading) return
    const version = requestVersion.current
    setMoreLoading(true)
    setMoreError(false)
    const params = new URLSearchParams({ cursor: nextCursor })
    if (q.trim()) params.set('q', q.trim())
    try {
      const response = await fetch(`/api/sfa/contacts?${params}`, sfaInit(orgSlug))
      const data = await response.json().catch(() => null)
      if (!response.ok || !Array.isArray(data?.contacts)) throw new Error('担当者の追加取得に失敗しました')
      if (version !== requestVersion.current) return
      setContacts((current) => {
        const ids = new Set(current.map((contact) => contact.id))
        return [...current, ...data.contacts.filter((contact: Contact) => !ids.has(contact.id))]
      })
      setNextCursor(data.nextCursor || null)
    } catch {
      if (version === requestVersion.current) setMoreError(true)
    } finally {
      if (version === requestVersion.current) setMoreLoading(false)
    }
  }

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/sfa/contacts', sfaInit(orgSlug, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, title, accountId: accountId || null, email, phone, isKeyPerson }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setName(''); setTitle(''); setAccountId(''); setEmail(''); setPhone(''); setIsKeyPerson(false); setOpen(false)
      toast.success('担当者を登録しました')
      setRefresh((value) => value + 1)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">担当者</h1>
          <p className="text-slate-500 font-bold text-sm">取引先のキーマン・連絡先を管理</p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="px-5 py-3 rounded-full bg-gradient-to-r from-green-500 to-lime-600 text-white font-black shadow-lg hover:shadow-xl transition-all flex items-center gap-1">
          <span className="material-symbols-outlined">add</span>新規登録
        </button>
      </div>

      {open && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="氏名（必須）" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={accountsLoading || accountsError} className="rounded-xl border border-slate-200 px-4 py-3 font-bold disabled:opacity-50">
            <option value="">{accountsLoading ? '取引先を読み込み中' : '取引先（任意）'}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {accountsError && <p role="alert" className="text-sm text-red-700">取引先の選択肢を読み込めませんでした。画面を再読み込みしてお試しください。</p>}
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="役職" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メール" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="電話" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer px-1">
            <input type="checkbox" checked={isKeyPerson} onChange={(e) => setIsKeyPerson(e.target.checked)} className="w-4 h-4 accent-[#7f19e6]" />
            <span className="material-symbols-outlined text-base">grade</span>キーマン（決裁者）
          </label>
          <button onClick={create} disabled={busy} className="sm:col-span-2 px-5 py-2.5 rounded-xl bg-green-600 text-white font-black disabled:opacity-50">{busy ? '登録中…' : '登録する'}</button>
        </div>
      )}

      <div className="mb-4">
        <input value={q} maxLength={100} onChange={(e) => { requestVersion.current++; setQ(e.target.value) }} placeholder="氏名で検索" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-sm" />
      </div>

      {loading && <p className="mb-3 text-sm text-slate-500">担当者を読み込み中です...</p>}
      {listError && <div role="alert" className="mb-3 text-sm text-red-700">担当者を読み込めませんでした。<button type="button" onClick={() => setRefresh((value) => value + 1)} className="ml-2 underline">再試行</button></div>}
      {!loading && !listError && <p className="mb-3 text-xs text-slate-500">{totalCount}件中{contacts.length}件を表示</p>}
      {!loading && !listError && <div className="space-y-2">
        {contacts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-slate-400 font-bold">担当者がいません。「新規登録」から追加しましょう。</div>
        ) : (
          contacts.map((c) => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600">person</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-slate-800 truncate">{c.name}</p>
                  {c.isKeyPerson && <span className="text-[10px] font-black text-amber-600 bg-amber-100 rounded px-1.5 py-0.5">キーマン</span>}
                </div>
                <p className="text-xs font-bold text-slate-400 truncate">
                  {[c.accountName, c.title, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>}
      {!loading && !listError && nextCursor && <div className="mt-4 text-center">
        <button type="button" onClick={loadMore} disabled={moreLoading} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-green-700 disabled:opacity-50">{moreLoading ? '読み込み中...' : 'さらに表示'}</button>
        {moreError && <p role="alert" className="mt-2 text-sm text-red-700">追加の担当者を読み込めませんでした。再度お試しください。</p>}
      </div>}
    </div>
  )
}
