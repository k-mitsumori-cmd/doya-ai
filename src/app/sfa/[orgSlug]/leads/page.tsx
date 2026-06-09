'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { sfaInit } from '@/lib/sfa/client'
import { LEAD_STATUS_LABEL } from '@/lib/sfa/constants'
import type { LeadStatus } from '@/lib/sfa/types'

interface Lead {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  status: LeadStatus
  score: number | null
  source: string
  note: string | null
  convertedAccountId: string | null
}

const STATUS_ORDER: LeadStatus[] = ['new', 'working', 'nurturing', 'qualified', 'converted', 'disqualified']
const STATUS_COLOR: Record<LeadStatus, string> = {
  new: 'bg-sky-100 text-sky-700',
  working: 'bg-amber-100 text-amber-700',
  nurturing: 'bg-violet-100 text-violet-700',
  qualified: 'bg-green-100 text-green-700',
  converted: 'bg-slate-200 text-slate-600',
  disqualified: 'bg-slate-100 text-slate-400',
}
const SOURCE_LABEL: Record<string, string> = { doyalist: 'ドヤリスト', csv: 'CSV', manual: '手動' }

const scoreColor = (s: number | null) =>
  s == null ? 'text-slate-300' : s >= 70 ? 'text-green-600' : s >= 40 ? 'text-amber-500' : 'text-slate-400'

// CSV（ヘッダ行つき）をオブジェクト配列に変換。簡易パーサ（カンマ区切り・引用符対応）。
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const split = (line: string) => {
    const out: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ }
      else if (ch === ',' && !inQ) { out.push(cur); cur = '' }
      else cur += ch
    }
    out.push(cur)
    return out.map((s) => s.trim())
  }
  const headers = split(lines[0])
  return lines.slice(1).map((line) => {
    const cells = split(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = cells[i] || '' })
    return row
  })
}

export default function SfaLeadsPage() {
  const orgSlug = (useParams().orgSlug as string) || ''
  const ready = !!orgSlug
  const [leads, setLeads] = useState<Lead[]>([])
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [busy, setBusy] = useState(false)
  const [scoringId, setScoringId] = useState<string | null>(null)

  const load = useCallback((status: LeadStatus | 'all' = 'all', query = '') => {
    if (!ready) return
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    if (query) params.set('q', query)
    fetch(`/api/sfa/leads${params.toString() ? `?${params}` : ''}`, sfaInit(orgSlug))
      .then((r) => r.json())
      .then((d) => setLeads(d.leads || []))
      .catch(() => {})
  }, [ready, orgSlug])
  useEffect(() => { load(filter, q) }, [load, filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/sfa/leads', sfaInit(orgSlug, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contactName }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setName(''); setContactName(''); setOpen(false)
      toast.success('リードを追加しました')
      load(filter, q)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  const doImport = async () => {
    const rows = parseCsv(csv)
    if (rows.length === 0) { toast.error('ヘッダ行＋1行以上のCSVを貼り付けてください'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/sfa/leads/import', sfaInit(orgSlug, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'csv', rows }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast.success(`${d.imported}件を取り込みました${d.skipped ? `（${d.skipped}件スキップ）` : ''}`)
      setCsv(''); setImportOpen(false)
      load(filter, q)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)))
    try {
      await fetch(`/api/sfa/leads/${lead.id}`, sfaInit(orgSlug, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      }))
      load(filter, q)
    } catch { load(filter, q) }
  }

  const scoreLead = async (lead: Lead) => {
    setScoringId(lead.id)
    try {
      const res = await fetch('/api/sfa/ai/score', sfaInit(orgSlug, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, score: d.score } : l)))
      toast.success(`AIスコア ${d.score}点：${d.nextAction || d.reason}`, { duration: 6000 })
    } catch (e: any) { toast.error(e.message) } finally { setScoringId(null) }
  }

  const convert = async (lead: Lead) => {
    if (!confirm(`「${lead.name}」を取引先＋商談に転換しますか？`)) return
    try {
      const res = await fetch(`/api/sfa/leads/${lead.id}/convert`, sfaInit(orgSlug, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast.success('取引先＋商談を作成しました')
      load(filter, q)
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black text-slate-900">リード</h1>
          <p className="text-slate-500 font-bold text-sm">見込み客を集めて、有望なら取引先へ転換</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setImportOpen((v) => !v); setOpen(false) }} className="px-4 py-3 rounded-full bg-white border border-slate-200 text-green-700 font-black shadow-sm hover:shadow flex items-center gap-1">
            <span className="material-symbols-outlined">upload</span>CSV取込
          </button>
          <button onClick={() => { setOpen((v) => !v); setImportOpen(false) }} className="px-5 py-3 rounded-full bg-gradient-to-r from-green-500 to-lime-600 text-white font-black shadow-lg hover:shadow-xl transition-all flex items-center gap-1">
            <span className="material-symbols-outlined">add</span>リード追加
          </button>
        </div>
      </div>

      {open && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="企業名/氏名（必須）" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="担当者名" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          <button onClick={create} disabled={busy} className="sm:col-span-2 px-5 py-2.5 rounded-xl bg-green-600 text-white font-black disabled:opacity-50">{busy ? '追加中…' : '追加する'}</button>
        </div>
      )}

      {importOpen && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <p className="text-sm font-black text-slate-700 mb-1">CSV取込（ドヤリストの出力形式に対応）</p>
          <p className="text-[11px] font-bold text-slate-400 mb-2">1行目にヘッダ（例: <code>name,corporateNumber,prefecture,url,phone,representative</code>）。日本語ヘッダ（企業名/法人番号/都道府県/URL/電話番号/代表者）も可。</p>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={6} placeholder={'name,prefecture,url\n株式会社サンプル,東京都,https://example.com'} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs" />
          <button onClick={doImport} disabled={busy} className="mt-2 px-5 py-2.5 rounded-xl bg-green-600 text-white font-black disabled:opacity-50">{busy ? '取込中…' : '取り込む'}</button>
        </div>
      )}

      {/* ステータスフィルタ */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {(['all', ...STATUS_ORDER] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-colors ${filter === s ? 'bg-[#7f19e6] text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
            {s === 'all' ? 'すべて' : LEAD_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input value={q} onChange={(e) => { setQ(e.target.value); load(filter, e.target.value) }} placeholder="🔍 企業名で検索" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-sm" />
      </div>

      <div className="space-y-2">
        {leads.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-slate-400 font-bold">リードがありません。「リード追加」か「CSV取込」から始めましょう。</div>
        ) : (
          leads.map((l) => (
            <div key={l.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="text-center w-12 flex-shrink-0">
                  <p className={`text-2xl font-black leading-none ${scoreColor(l.score)}`}>{l.score ?? '—'}</p>
                  <p className="text-[9px] font-black text-slate-300">SCORE</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-slate-800 truncate">{l.name}</p>
                    <span className={`text-[10px] font-black rounded px-1.5 py-0.5 ${STATUS_COLOR[l.status]}`}>{LEAD_STATUS_LABEL[l.status]}</span>
                    <span className="text-[10px] font-bold text-slate-400">{SOURCE_LABEL[l.source] || l.source}</span>
                  </div>
                  {l.contactName && <p className="text-xs font-bold text-slate-400 mt-0.5">👤 {l.contactName}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <button onClick={() => scoreLead(l)} disabled={scoringId === l.id} className="text-xs font-black text-[#7f19e6] hover:underline flex items-center gap-0.5 disabled:opacity-50">
                      <span className="material-symbols-outlined text-[14px]">auto_awesome</span>{scoringId === l.id ? 'AI判定中…' : 'AIスコア'}
                    </button>
                    {l.status !== 'converted' ? (
                      <button onClick={() => convert(l)} className="text-xs font-black text-green-700 hover:underline flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[14px]">swap_horiz</span>取引先に転換
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">転換済</span>
                    )}
                    <select value={l.status} onChange={(e) => setStatus(l, e.target.value as LeadStatus)} className="ml-auto text-[11px] font-bold rounded-lg border border-slate-200 px-2 py-1 bg-slate-50">
                      {STATUS_ORDER.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
