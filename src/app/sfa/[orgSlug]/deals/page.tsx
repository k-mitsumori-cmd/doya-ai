'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { sfaInit, withOrg } from '@/lib/sfa/client'

interface Stage { id: string; name: string; order: number; probability: number; color: string; isWon: boolean; isLost: boolean }
interface Deal {
  id: string
  name: string
  amount: number
  stageId: string | null
  probability: number
  accountId: string | null
  accountName: string | null
  status: string
  lastActivityAt: string | null
}
interface Account { id: string; name: string }

const STALE_DAYS = 14
const yen = (n: number) => '¥' + (n || 0).toLocaleString('ja-JP')

export default function SfaDealsPage() {
  const orgSlug = (useParams().orgSlug as string) || ''
  const ready = !!orgSlug
  const [stages, setStages] = useState<Stage[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    if (!ready) return
    fetch('/api/sfa/deals', sfaInit(orgSlug))
      .then((r) => r.json())
      .then((d) => {
        setStages(d.stages || [])
        setDeals(d.deals || [])
      })
      .catch(() => {})
  }, [ready, orgSlug])
  useEffect(() => {
    if (!ready) return
    load()
    fetch('/api/sfa/accounts', sfaInit(orgSlug)).then((r) => r.json()).then((d) => setAccounts(d.accounts || [])).catch(() => {})
  }, [ready, orgSlug, load])

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/sfa/deals', sfaInit(orgSlug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, amount: Number(amount) || 0, accountId: accountId || null }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setName(''); setAmount(''); setAccountId(''); setOpen(false)
      toast.success('商談を追加しました')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const moveStage = async (deal: Deal, stageId: string) => {
    // 楽観更新
    setDeals((prev) => prev.map((x) => (x.id === deal.id ? { ...x, stageId } : x)))
    try {
      const res = await fetch(`/api/sfa/deals/${deal.id}`, sfaInit(orgSlug, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      }))
      if (!res.ok) throw new Error()
      load()
    } catch {
      toast.error('移動に失敗しました')
      load()
    }
  }

  const isStale = (d: Deal) =>
    d.status === 'open' && d.lastActivityAt && Date.now() - new Date(d.lastActivityAt).getTime() > STALE_DAYS * 86400000

  // 重み付きパイプライン（open のみ）
  const weighted = deals.filter((d) => d.status === 'open').reduce((s, d) => s + (d.amount * d.probability) / 100, 0)
  const openTotal = deals.filter((d) => d.status === 'open').reduce((s, d) => s + d.amount, 0)

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black text-slate-900">商談パイプライン</h1>
          <p className="text-slate-500 font-bold text-sm">
            総額 {yen(openTotal)}・確度加重 <span className="text-green-600">{yen(Math.round(weighted))}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={withOrg('/api/sfa/export?type=deals', orgSlug)} className="px-4 py-3 rounded-full bg-white border border-slate-200 text-green-700 font-black shadow-sm hover:shadow flex items-center gap-1">
            <span className="material-symbols-outlined">download</span>CSV出力
          </a>
          <button onClick={() => setOpen((v) => !v)} className="px-5 py-3 rounded-full bg-gradient-to-r from-green-500 to-lime-600 text-white font-black shadow-lg hover:shadow-xl transition-all flex items-center gap-1">
            <span className="material-symbols-outlined">add</span>商談を追加
          </button>
        </div>
      </div>

      {open && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-slate-500 mb-1">商談名</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 新規SaaS導入" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">金額(円)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="1000000" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">取引先</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold">
              <option value="">未選択</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-4">
            <button onClick={create} disabled={busy} className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-black disabled:opacity-50">{busy ? '追加中…' : '追加する'}</button>
          </div>
        </div>
      )}

      {/* カンバン */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((st) => {
          const col = deals.filter((d) => d.stageId === st.id)
          const colTotal = col.reduce((s, d) => s + d.amount, 0)
          return (
            <div key={st.id} className="flex-shrink-0 w-72 bg-slate-100 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.color }} />
                  <span className="font-black text-slate-700 text-sm">{st.name}</span>
                  <span className="text-[11px] font-bold text-slate-400">{col.length}</span>
                </div>
                <span className="text-[11px] font-bold text-slate-400">{st.probability}%</span>
              </div>
              <p className="text-[11px] font-bold text-slate-400 mb-2">{yen(colTotal)}</p>
              <div className="space-y-2">
                {col.map((d) => (
                  <div key={d.id} className="bg-white rounded-xl p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-black text-slate-800 text-sm leading-snug">{d.name}</p>
                      {isStale(d) && <span title="14日以上停滞" className="text-[10px] font-black text-white bg-red-500 rounded px-1.5 py-0.5 flex-shrink-0">停滞</span>}
                    </div>
                    {d.accountName && <p className="text-[11px] font-bold text-slate-400 mt-0.5">🏢 {d.accountName}</p>}
                    <p className="text-green-600 font-black mt-1">{yen(d.amount)}</p>
                    <select
                      value={d.stageId || ''}
                      onChange={(e) => moveStage(d, e.target.value)}
                      className="mt-2 w-full text-[11px] font-bold rounded-lg border border-slate-200 px-2 py-1.5 bg-slate-50"
                    >
                      {stages.map((s) => <option key={s.id} value={s.id}>→ {s.name}</option>)}
                    </select>
                  </div>
                ))}
                {col.length === 0 && <p className="text-[11px] font-bold text-slate-300 text-center py-4">なし</p>}
              </div>
            </div>
          )
        })}
        {stages.length === 0 && (
          <p className="text-slate-400 font-bold">{ready ? 'パイプラインを読み込み中…' : '読み込み中…'}</p>
        )}
      </div>
    </div>
  )
}
