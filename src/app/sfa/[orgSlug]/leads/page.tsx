'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { parseLeadCsv } from '@/lib/sfa/lead-csv'
import { LEAD_STATUS_LABEL } from '@/lib/sfa/constants'
import { sfaJson, sfaClientId, sfaClientDate, isSfaClientLeadImport, isSfaClientScore, type SfaClientScore } from '@/lib/sfa/client-response'
import { useSfaClientMutations, useSfaDraftSnapshot } from '@/lib/sfa/use-client-mutations'
import MutationRecovery from '@/components/sfa/MutationRecovery'
import LeadConversionForm, { type ConversionLead } from '@/components/sfa/LeadConversionForm'
import type { LeadStatus } from '@/lib/sfa/types'

interface Lead extends ConversionLead {
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

function isLeadPage(data: Record<string, unknown>): data is Record<string, unknown> & { leads: Lead[]; totalCount: number; nextCursor: string | null } {
  return Array.isArray(data.leads) && data.leads.every(l => l && typeof l === 'object' && sfaClientId(l.id)
    && typeof l.name === 'string' && l.name.length <= 10000 && typeof l.source === 'string'
    && STATUS_ORDER.includes(l.status) && sfaClientDate(l.updatedAt)
    && ['contactName', 'email', 'phone', 'corporateNumber', 'note'].every(k => l[k] === null || typeof l[k] === 'string' && l[k].length <= 10000)
    && (l.convertedAccountId === null || sfaClientId(l.convertedAccountId))
    && (l.score === null || Number.isInteger(l.score) && l.score >= 0 && l.score <= 100))
    && Number.isSafeInteger(data.totalCount) && (data.totalCount as number) >= 0
    && (data.nextCursor === null || typeof data.nextCursor === 'string' && data.nextCursor.length <= 512)
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

export default function SfaLeadsPage() {
  const orgSlug = (useParams().orgSlug as string) || ''
  const reload = useRef<() => void>(() => {})
  const mutations = useSfaClientMutations(orgSlug, (pending, state, row) => {
    if (pending.kind === 'score' && state === 'found' && isSfaClientScore(row, pending.leadId!, pending.operationId!)) setScoreResult({ value: row, identity: mutations.identity })
    if (pending.kind === 'conversion' && state === 'found') setRecoveredConversion({ leadId: pending.leadId!, identity: mutations.identity })
    reload.current()
  })
  const [recoveredConversion, setRecoveredConversion] = useState<{ leadId: string; identity: string } | null>(null)
  const [listKey, setListKey] = useState('')
  const ready = mutations.allowed
  const currentList = ready && listKey === mutations.key
  const [conversion, setConversion] = useState<{ lead: Lead; identity: string } | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [moreError, setMoreError] = useState(false)
  const requestVersion = useRef(0)
  const listRequest = useRef<AbortController | null>(null)
  const [filter, setFilter] = useState<LeadStatus | 'all'>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [formError, setFormError] = useState('')
  const [importResult, setImportResult] = useState('')
  const createDraft = useSfaDraftSnapshot([name, contactName, open])
  const importDraft = useSfaDraftSnapshot([csv, importOpen])
  const creating = mutations.busy.includes('lead:create')
  const importing = mutations.busy.includes('lead-import:create')
  const [scoreResult, setScoreResult] = useState<{ value: SfaClientScore; identity: string } | null>(null)

  const load = useCallback((status: LeadStatus | 'all' = 'all', query = '') => {
    if (!ready || !mutations.active()) return
    const version = ++requestVersion.current
    listRequest.current?.abort()
    const controller = new AbortController()
    listRequest.current = controller
    setLoading(true)
    setListError(false)
    setMoreError(false)
    setMoreLoading(false)
    setNextCursor(null)
    const params = new URLSearchParams()
    if (status !== 'all') params.set('status', status)
    if (query.trim()) params.set('q', query.trim())
    sfaJson(`/api/sfa/leads?${params}`, orgSlug, { signal: controller.signal })
      .then((data) => {
        if (!isLeadPage(data)) throw new Error('リードを読み込めませんでした')
        if (version !== requestVersion.current || controller.signal.aborted || !mutations.active()) return
        setListKey(mutations.key)
        setLeads(data.leads)
        setNextCursor(data.nextCursor)
        setTotalCount(data.totalCount)
      })
      .catch(() => { if (version === requestVersion.current && !controller.signal.aborted && mutations.active()) { setListKey(mutations.key); setListError(true) } })
      .finally(() => { if (version === requestVersion.current && !controller.signal.aborted && mutations.active()) setLoading(false) })
    // Capture actor/org epoch for this request; old callbacks must stay inactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, orgSlug, mutations.key])
  reload.current = () => load(filter, q)
  useEffect(() => {
    const timer = setTimeout(() => load(filter, q), q ? 200 : 0)
    return () => { clearTimeout(timer); listRequest.current?.abort() }
  }, [load, filter, q])

  const loadMore = async () => {
    if (!nextCursor || moreLoading || !mutations.active()) return
    const version = requestVersion.current
    setMoreLoading(true)
    setMoreError(false)
    const params = new URLSearchParams({ cursor: nextCursor })
    if (filter !== 'all') params.set('status', filter)
    if (q.trim()) params.set('q', q.trim())
    try {
      const data = await sfaJson(`/api/sfa/leads?${params}`, orgSlug)
      if (!isLeadPage(data)) throw new Error('追加のリードを読み込めませんでした')
      if (version !== requestVersion.current || !mutations.active()) return
      setLeads((current) => {
        const ids = new Set(current.map((lead) => lead.id))
        return [...current, ...data.leads.filter((lead: Lead) => !ids.has(lead.id))]
      })
      setNextCursor(data.nextCursor)
    } catch {
      if (version === requestVersion.current && mutations.active()) setMoreError(true)
    } finally {
      if (version === requestVersion.current && mutations.active()) setMoreLoading(false)
    }
  }

  const create = async () => {
    if (!mutations.active() || mutations.creationBlocked('lead')) return
    if (!name.trim() || name.trim().length > 200 || contactName.length > 80) {
      setFormError('企業名・氏名は1〜200文字、担当者名は80文字以内で入力してください。'); return
    }
    const revision = createDraft.current.revision
    setFormError('')
    const row = await mutations.create('lead', 'lead:create', { name, contactName })
    if (!row || !mutations.active()) return
    if (createDraft.current.revision === revision) { setName(''); setContactName(''); setOpen(false) }
    else setFormError('リードを追加しました。送信後に変更した入力は保持しています。同じ内容を重ねて送信しないでください。')
    toast.success('リードを追加しました')
    reload.current()
  }

  const doImport = async () => {
    if (!mutations.active() || mutations.creationBlocked('import')) return
    let rows: ReturnType<typeof parseLeadCsv>
    try { rows = parseLeadCsv(csv) } catch (error) { setFormError(error instanceof Error ? error.message : 'CSVを確認してください。'); return }
    const revision = importDraft.current.revision
    setFormError(''); setImportResult('')
    const result = await mutations.create('import', 'lead-import:create', { source: 'csv', rows })
    if (!result || !mutations.active() || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string' || !isSfaClientLeadImport(result, result.id, rows.length)) return
    setImportResult(`${result.imported}件を取り込みました。${result.skipped}件スキップ${result.skipped ? `（ヘッダを除くデータ位置: ${result.skippedRows.join('、')}。企業名のない行は取り込んでいません）` : ''}。`)
    if (importDraft.current.revision === revision) { setCsv(''); setImportOpen(false) }
    else setFormError('送信後に変更したCSVは保持しています。同じ内容を重ねて送信しないでください。')
    toast.success(`${result.imported}件を取り込みました`)
    reload.current()
  }

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    if (!mutations.active() || mutations.blocked('conversion:' + lead.id) || mutations.blocked('lead:' + lead.id)) return
    const row = await mutations.mutateLead(lead, { status })
    if (mutations.active()) { if (row) toast.success('状態を更新しました'); reload.current() }
  }

  const scoreLead = async (lead: Lead) => {
    if (!mutations.active() || mutations.blocked('conversion:' + lead.id) || mutations.blocked('lead:' + lead.id)) return
    const result = await mutations.scoreLead(lead)
    if (!result || !mutations.active()) return
    setScoreResult({ value: result, identity: mutations.identity })
    reload.current()
  }

  const convert = (lead: Lead) => {
    if (!mutations.active() || mutations.creationBlocked('conversion')) return
    setConversion({ lead, identity: mutations.identity })
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

      <MutationRecovery mutations={mutations} />
      {ready && scoreResult && scoreResult.identity === mutations.identity && <section aria-label="保存済みのAI判定結果" className="mb-4 break-words rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
        <h2 className="font-bold">保存済みのAI判定結果：{scoreResult.value.leadName}（{scoreResult.value.score}点）</h2>
        <p className="mt-2 whitespace-pre-wrap">{scoreResult.value.reason}</p>
        <p className="mt-2 whitespace-pre-wrap">次の行動：{scoreResult.value.nextAction}</p>
        <p className="mt-2 text-xs">実行時点の情報に基づく判定です。その後の変更は含まれません。</p>
        <button type="button" onClick={() => setScoreResult(null)} className="mt-2 underline">判定結果を閉じる</button>
      </section>}
      {formError && <p role="alert" className="mb-3 text-sm text-amber-800">{formError}</p>}
      {importResult && <p role="status" className="mb-3 text-sm text-green-800">{importResult}</p>}
      {conversion && conversion.identity === mutations.identity && <LeadConversionForm key={conversion.lead.id + mutations.identity} lead={conversion.lead} mutations={mutations} recovered={recoveredConversion?.leadId === conversion.lead.id && recoveredConversion.identity === mutations.identity}
        onClose={() => { setConversion(null); reload.current() }}
        onConverted={() => { if (mutations.active()) { toast.success('取引先・商談を作成しました'); reload.current() } }} />}

      {open && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input aria-label="企業名・氏名" value={name} onChange={(e) => setName(e.target.value)} placeholder="企業名/氏名（必須）" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          <input aria-label="リード担当者名" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="担当者名" className="rounded-xl border border-slate-200 px-4 py-3 font-bold" />
          <button onClick={create} disabled={!ready || mutations.creationBlocked('lead')} className="sm:col-span-2 px-5 py-2.5 rounded-xl bg-green-600 text-white font-black disabled:opacity-50">{creating ? '追加中…' : '追加する'}</button>
        </div>
      )}

      {importOpen && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <p className="text-sm font-black text-slate-700 mb-1">CSV取込（ドヤリストの出力形式に対応）</p>
          <p className="text-[11px] font-bold text-slate-400 mb-2">1行目にヘッダ（例: <code>name,corporateNumber,prefecture,url,phone,representative</code>）。日本語ヘッダ（企業名/法人番号/都道府県/URL/電話番号/代表者）も可。</p>
          <textarea aria-label="取込CSV" value={csv} onChange={(e) => setCsv(e.target.value)} rows={6} placeholder={'name,prefecture,url\n株式会社サンプル,東京都,https://example.com'} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs" />
          <button onClick={doImport} disabled={!ready || mutations.creationBlocked('import')} className="mt-2 px-5 py-2.5 rounded-xl bg-green-600 text-white font-black disabled:opacity-50">{importing ? '取込中…' : '取り込む'}</button>
        </div>
      )}

      {/* ステータスフィルタ */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {(['all', ...STATUS_ORDER] as const).map((s) => (
          <button key={s} onClick={() => { if (filter !== s) { requestVersion.current++; setLoading(true); setFilter(s) } }} className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-colors ${filter === s ? 'bg-[#7f19e6] text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
            {s === 'all' ? 'すべて' : LEAD_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <input value={q} maxLength={100} onChange={(e) => { requestVersion.current++; setLoading(true); setQ(e.target.value) }} placeholder="企業名で検索" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-bold text-sm" />
      </div>

      {loading && <p className="mb-3 text-sm text-slate-500">リードを読み込み中です...</p>}
      {currentList && listError && <div role="alert" className="mb-3 text-sm text-red-700">リードを読み込めませんでした。<button type="button" onClick={() => load(filter, q)} className="ml-2 underline">再試行</button></div>}
      {currentList && !loading && !listError && <p className="mb-3 text-xs text-slate-500">{totalCount}件中{leads.length}件を表示</p>}
      {currentList && !loading && !listError && <div className="space-y-2">
        {leads.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-slate-400 font-bold">{q || filter !== 'all' ? '条件に一致するリードがありません。検索条件を変更してください。' : 'リードがありません。「リード追加」か「CSV取込」から始めましょう。'}</div>
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
                  {l.contactName && <p className="text-xs font-bold text-slate-400 mt-0.5">{l.contactName}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <button onClick={() => scoreLead(l)} disabled={!ready || mutations.creationBlocked('score') || mutations.blocked('lead:' + l.id) || mutations.blocked('conversion:' + l.id)} className="text-xs font-black text-[#7f19e6] hover:underline flex items-center gap-0.5 disabled:opacity-50">
                      <span className="material-symbols-outlined text-[14px]">auto_awesome</span>{mutations.busy.includes('score:' + l.id) ? 'AI判定中…' : 'AIスコア'}
                    </button>
                    {l.status !== 'converted' && !l.convertedAccountId ? (
                      <button onClick={() => convert(l)} disabled={!ready || mutations.creationBlocked('conversion') || mutations.blocked('lead:' + l.id)} className="text-xs font-black text-green-700 hover:underline flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[14px]">swap_horiz</span>取引先に転換
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">転換済</span>
                    )}
                    <select value={l.status} disabled={!ready || mutations.blocked('lead:' + l.id) || mutations.blocked('conversion:' + l.id) || l.status === 'converted' || !!l.convertedAccountId} onChange={(e) => setStatus(l, e.target.value as LeadStatus)} className="ml-auto text-[11px] font-bold rounded-lg border border-slate-200 px-2 py-1 bg-slate-50 disabled:opacity-60">
                      {STATUS_ORDER.filter((s) => s !== 'converted' || l.status === 'converted').map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>}
      {currentList && !loading && !listError && nextCursor && <div className="mt-4 text-center">
        <button type="button" onClick={loadMore} disabled={moreLoading} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-green-700 disabled:opacity-50">{moreLoading ? '読み込み中...' : 'さらに表示'}</button>
        {moreError && <p role="alert" className="mt-2 text-sm text-red-700">追加のリードを読み込めませんでした。再度お試しください。</p>}
      </div>}
    </div>
  )
}
