'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { sfaInit } from '@/lib/sfa/client'

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
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [accountId, setAccountId] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [isKeyPerson, setIsKeyPerson] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback((query = '') => {
    if (!ready) return
    fetch(`/api/sfa/contacts${query ? `?q=${encodeURIComponent(query)}` : ''}`, sfaInit(orgSlug))
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts || []))
      .catch(() => {})
  }, [ready, orgSlug])
  useEffect(() => {
    load()
    fetch('/api/sfa/accounts', sfaInit(orgSlug)).then((r) => r.json()).then((d) => setAccounts(d.accounts || [])).catch(() => {})
  }, [load, orgSlug])

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
      load(q)
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
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 font-bold">
            <option value="">取引先（任意）</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="役職" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メール" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="電話" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer px-1">
            <input type="checkbox" checked={isKeyPerson} onChange={(e) => setIsKeyPerson(e.target.checked)} className="w-4 h-4 accent-[#7f19e6]" />
            ⭐ キーマン（決裁者）
          </label>
          <button onClick={create} disabled={busy} className="sm:col-span-2 px-5 py-2.5 rounded-xl bg-green-600 text-white font-black disabled:opacity-50">{busy ? '登録中…' : '登録する'}</button>
        </div>
      )}

      <div className="mb-4">
        <input value={q} onChange={(e) => { setQ(e.target.value); load(e.target.value) }} placeholder="🔍 氏名で検索" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-sm" />
      </div>

      <div className="space-y-2">
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
      </div>
    </div>
  )
}
