'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'

interface Company {
  id: string
  projectId: string
  name: string
  website?: string | null
  industry?: string | null
  region?: string | null
  size?: string | null
  description?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  contactPerson?: string | null
  notes?: string | null
  enrichedData?: Record<string, any> | null
  score?: number | null
  status: string
  source?: string | null
  createdAt: string
}

const STATUS_OPTIONS = [
  { value: 'new', label: '新規', color: 'bg-slate-100 text-slate-600' },
  { value: 'contacted', label: 'コンタクト済み', color: 'bg-purple-100 text-purple-700' },
  { value: 'replied', label: '返信あり', color: 'bg-amber-100 text-amber-700' },
  { value: 'won', label: '受注', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'lost', label: '失注', color: 'bg-rose-100 text-rose-600' },
]

export default function CompanyDetailPage() {
  const params = useParams()
  const projectId = (params?.id as string) || ''
  const companyId = (params?.companyId as string) || ''

  const [company, setCompany] = useState(null as Company | null)
  const [loading, setLoading] = useState(true)
  const [savingNotes, setSavingNotes] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [notes, setNotes] = useState('')

  const load = () => {
    setLoading(true)
    fetch(`/api/doyalist/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        const proj = data?.project || data
        const c: Company | undefined = (proj?.companies || []).find(
          (x: Company) => x.id === companyId,
        )
        if (c) {
          setCompany(c)
          setNotes(c.notes || '')
        }
      })
      .catch(() => toast.error('企業情報の読み込みに失敗しました'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (projectId && companyId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, companyId])

  const handleStatusChange = async (status: string) => {
    const tid = toast.loading('更新中...')
    try {
      const res = await fetch(`/api/doyalist/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('更新に失敗しました')
      toast.success('ステータスを更新しました', { id: tid })
      load()
    } catch (e: any) {
      toast.error(e?.message || '更新に失敗しました', { id: tid })
    }
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    const tid = toast.loading('メモを保存中...')
    try {
      const res = await fetch(`/api/doyalist/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error('保存に失敗しました')
      toast.success('メモを保存しました', { id: tid })
    } catch (e: any) {
      toast.error(e?.message || '保存に失敗しました', { id: tid })
    } finally {
      setSavingNotes(false)
    }
  }

  const handleEnrich = async () => {
    setEnriching(true)
    const tid = toast.loading('AI分析を実行中...')
    try {
      const res = await fetch(`/api/doyalist/companies/${companyId}/enrich`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'AI分析に失敗しました')
      toast.success('AI分析が完了しました', { id: tid })
      load()
    } catch (e: any) {
      toast.error(e?.message || 'AI分析に失敗しました', { id: tid })
    } finally {
      setEnriching(false)
    }
  }

  const handleGenerateApproach = async () => {
    setGenerating(true)
    const tid = toast.loading('アプローチ文面を生成中...')
    try {
      const res = await fetch('/api/doyalist/approach/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, companyId, type: 'email' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '生成に失敗しました')
      toast.success('アプローチを生成しました', { id: tid })
    } catch (e: any) {
      toast.error(e?.message || '生成に失敗しました', { id: tid })
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[#7f19e6]/20 border-t-[#7f19e6] animate-spin" />
        <p className="text-sm font-bold text-slate-400">企業情報を読み込み中...</p>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
        <span className="material-symbols-outlined text-rose-400 text-6xl">domain_disabled</span>
        <h2 className="text-2xl font-black text-slate-800">企業が見つかりません</h2>
        <Link
          href={`/doyalist/projects/${projectId}`}
          className="px-6 py-3 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
        >
          プロジェクトに戻る
        </Link>
      </div>
    )
  }

  const enriched = company.enrichedData || null

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto pb-20">
      <Link
        href={`/doyalist/projects/${projectId}`}
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-[#7f19e6] transition-colors mb-3"
      >
        <span className="material-symbols-outlined text-base">arrow_back</span>
        プロジェクトに戻る
      </Link>

      {/* Header */}
      <div className="bg-gradient-to-br from-[#7f19e6] via-[#6b13c9] to-[#5b0fb3] rounded-3xl p-6 lg:p-8 text-white shadow-xl shadow-[#7f19e6]/20 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">apartment</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl lg:text-3xl font-black break-words">{company.name}</h1>
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-white/85 hover:text-white mt-1 hover:underline"
              >
                <span className="material-symbols-outlined text-base">open_in_new</span>
                {company.website}
              </a>
            )}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {company.industry && <Chip>{company.industry}</Chip>}
              {company.region && <Chip>{company.region}</Chip>}
              {company.size && <Chip>{company.size}</Chip>}
              {company.score != null && (
                <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full bg-amber-300 text-amber-900">
                  <span className="material-symbols-outlined text-sm">star</span>
                  スコア {company.score}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button
          onClick={handleEnrich}
          disabled={enriching}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white border border-violet-200 hover:bg-violet-50 disabled:opacity-50 text-violet-700 font-bold text-sm transition-colors"
        >
          {enriching ? (
            <span className="w-4 h-4 rounded-full border-2 border-violet-300 border-t-violet-700 animate-spin" />
          ) : (
            <span className="material-symbols-outlined">psychology</span>
          )}
          AI分析実行
        </button>
        <button
          onClick={handleGenerateApproach}
          disabled={generating}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#7f19e6] hover:bg-[#5b0fb3] disabled:bg-slate-300 text-white font-bold text-sm shadow-lg shadow-[#7f19e6]/20 transition-colors"
        >
          {generating ? (
            <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <span className="material-symbols-outlined">auto_awesome</span>
          )}
          アプローチ生成
        </button>
        <Link
          href={`/doyalist/projects/${projectId}/approach`}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors sm:ml-auto"
        >
          <span className="material-symbols-outlined">mail</span>
          アプローチ一覧
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Company info */}
        <div className="lg:col-span-2 space-y-6">
          <Section title="企業情報" icon="info">
            <InfoRow label="企業名" value={company.name} />
            <InfoRow label="業界" value={company.industry || '-'} />
            <InfoRow label="地域" value={company.region || '-'} />
            <InfoRow label="規模" value={company.size || '-'} />
            <InfoRow label="ウェブサイト" value={company.website || '-'} link={!!company.website} />
            <InfoRow label="担当者" value={company.contactPerson || '-'} />
            <InfoRow label="メール" value={company.contactEmail || '-'} />
            <InfoRow label="電話" value={company.contactPhone || '-'} />
            {company.description && (
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-500 mb-1">概要</p>
                <p className="text-sm text-slate-700 leading-relaxed">{company.description}</p>
              </div>
            )}
          </Section>

          {/* Enriched data */}
          <Section
            title="AI分析結果"
            icon="psychology"
            badge={enriched ? '分析済み' : '未分析'}
            badgeColor={enriched ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}
          >
            {enriched ? (
              <div className="space-y-3">
                {Object.entries(enriched).map(([key, value]) => (
                  <div key={key} className="pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                    <p className="text-xs font-bold text-violet-600 mb-1 capitalize">{key}</p>
                    {typeof value === 'string' ? (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {value}
                      </p>
                    ) : (
                      <pre className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl overflow-x-auto">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-slate-400 mb-3">
                  まだAI分析を実行していません
                </p>
                <button
                  onClick={handleEnrich}
                  disabled={enriching}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-50 hover:bg-violet-100 disabled:opacity-50 text-violet-700 font-bold text-sm transition-colors"
                >
                  <span className="material-symbols-outlined">psychology</span>
                  AI分析を実行
                </button>
              </div>
            )}
          </Section>

          {/* Notes */}
          <Section title="メモ" icon="sticky_note_2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="社内向けメモ、商談履歴など..."
              rows={5}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] focus:bg-white transition-all resize-y"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#7f19e6] hover:bg-[#5b0fb3] disabled:bg-slate-300 text-white font-bold text-xs shadow-md shadow-[#7f19e6]/20 transition-colors"
              >
                {savingNotes ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-sm">save</span>
                )}
                メモを保存
              </button>
            </div>
          </Section>
        </div>

        {/* Right: Status */}
        <div className="space-y-6">
          <Section title="ステータス" icon="flag">
            <div className="space-y-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleStatusChange(s.value)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                    company.status === s.value
                      ? 'bg-[#7f19e6] text-white shadow-md shadow-[#7f19e6]/20'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{s.label}</span>
                  {company.status === s.value && (
                    <span className="material-symbols-outlined text-base">check</span>
                  )}
                </button>
              ))}
            </div>
          </Section>

          <Section title="メタ情報" icon="schedule">
            <InfoRow label="登録日" value={new Date(company.createdAt).toLocaleString('ja-JP')} />
            {company.source && <InfoRow label="ソース" value={company.source} />}
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  icon,
  badge,
  badgeColor,
  children,
}: {
  title: string
  icon: string
  badge?: string
  badgeColor?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#7f19e6]">{icon}</span>
          <h2 className="text-base font-black text-slate-800">{title}</h2>
        </div>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor || ''}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function InfoRow({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <p className="text-xs font-bold text-slate-500 w-24 shrink-0">{label}</p>
      {link && value !== '-' ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-[#7f19e6] hover:underline truncate"
        >
          {value}
        </a>
      ) : (
        <p className="text-sm font-medium text-slate-700 truncate">{value}</p>
      )}
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur text-white">
      {children}
    </span>
  )
}
