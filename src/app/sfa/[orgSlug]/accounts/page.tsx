'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { sfaInit, withOrg } from '@/lib/sfa/client'

interface Account {
  id: string
  name: string
  industry: string | null
  prefecture: string | null
  url: string | null
}

export default function SfaAccountsPage() {
  const orgSlug = (useParams().orgSlug as string) || ''
  const [accounts, setAccounts] = useState<Account[]>([])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [prefecture, setPrefecture] = useState('')
  const [busy, setBusy] = useState(false)

  const load = (query = '') => {
    if (!orgSlug) return
    fetch(`/api/sfa/accounts${query ? `?q=${encodeURIComponent(query)}` : ''}`, sfaInit(orgSlug))
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
      .catch(() => {})
  }
  useEffect(() => load(), [orgSlug]) // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/sfa/accounts', sfaInit(orgSlug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, industry, prefecture }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setName('')
      setIndustry('')
      setPrefecture('')
      setOpen(false)
      toast.success('取引先を登録しました')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">取引先</h1>
          <p className="text-slate-500 font-bold text-sm">会社・顧客を一元管理</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={withOrg('/api/sfa/export?type=accounts', orgSlug)}
            className="px-4 py-3 rounded-full bg-white border border-slate-200 text-green-700 font-black shadow-sm hover:shadow flex items-center gap-1"
          >
            <span className="material-symbols-outlined">download</span>CSV出力
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            className="px-5 py-3 rounded-full bg-gradient-to-r from-green-500 to-lime-600 text-white font-black shadow-lg hover:shadow-xl transition-all flex items-center gap-1"
          >
            <span className="material-symbols-outlined">add</span>新規登録
          </button>
        </div>
      </div>

      {open && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="会社名（必須）" className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          <div className="grid grid-cols-2 gap-3">
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="業界" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
            <input value={prefecture} onChange={(e) => setPrefecture(e.target.value)} placeholder="都道府県" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          </div>
          <button onClick={create} disabled={busy} className="px-5 py-3 rounded-xl bg-green-600 text-white font-black disabled:opacity-50">
            {busy ? '登録中…' : '登録する'}
          </button>
        </div>
      )}

      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            load(e.target.value)
          }}
          placeholder="🔍 会社名で検索"
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-sm"
        />
      </div>

      <div className="space-y-2">
        {accounts.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-slate-400 font-bold">取引先がありません。「新規登録」から追加しましょう。</div>
        ) : (
          accounts.map((a) => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600">business</span>
              <div className="min-w-0">
                <p className="font-black text-slate-800 truncate">{a.name}</p>
                <p className="text-xs font-bold text-slate-400">
                  {[a.industry, a.prefecture].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
