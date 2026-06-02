'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface KB {
  id: string
  name: string
  _count: { chunks: number }
}
interface Company {
  id: string
  companyName: string | null
  url: string
}
interface Applicant {
  id: string
  name: string
}
interface SessionRow {
  id: string
  mode: string
  title: string
  status: string
  durationSec: number
  createdAt: string
  _count: { answers: number }
}

export default function CunningDashboard() {
  const router = useRouter()
  const [mode, setMode] = useState<'sales' | 'interview'>('sales')
  const [kbs, setKbs] = useState<KB[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [usage, setUsage] = useState<any>(null)
  const [kbId, setKbId] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [applicantId, setApplicantId] = useState('')
  const [starting, setStarting] = useState(false)

  const load = () => {
    fetch('/api/cunning/knowledge', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setKbs(d.bases || []))
      .catch(() => {})
    fetch('/api/cunning/company', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setCompanies(d.profiles || []))
      .catch(() => {})
    fetch('/api/cunning/profiles', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setApplicants(d.profiles || []))
      .catch(() => {})
    fetch('/api/cunning/sessions', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions || []))
      .catch(() => {})
    fetch('/api/cunning/usage', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => {})
  }
  useEffect(load, [])

  const start = async () => {
    setStarting(true)
    try {
      const res = await fetch('/api/cunning/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          knowledgeBaseId: mode === 'sales' ? kbId || null : null,
          companyProfileId: mode === 'interview' ? companyId || null : null,
          applicantProfileId: mode === 'interview' ? applicantId || null : null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'セッションを開始できませんでした')
      router.push(`/cunning/live/${d.session.id}`)
    } catch (e: any) {
      toast.error(e.message)
      setStarting(false)
    }
  }

  const remaining = usage?.remainingMinutes
  const overLimit = typeof remaining === 'number' && remaining !== -1 && remaining <= 0

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl">🎧</span>
        <div>
          <h1 className="text-2xl font-black text-slate-900">ドヤカンニング</h1>
          <p className="text-slate-500 font-bold text-sm">
            Web会議の相手の声を解析し、最適な回答をリアルタイム提示
          </p>
        </div>
      </div>

      {usage?.limits && (
        <div className="mb-6 mt-3 inline-flex items-center gap-3 text-xs font-bold text-slate-500 bg-white rounded-full px-4 py-2 shadow-sm">
          <span>プラン: {usage.plan}</span>
          <span className="text-slate-300">|</span>
          <span>
            今月の利用 {usage.usedMinutes ?? 0}分
            {usage.limits.maxMinutesPerMonth === -1 ? '' : ` / ${usage.limits.maxMinutesPerMonth}分`}
          </span>
        </div>
      )}

      {/* モード選択 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {[
          { key: 'sales', icon: '💼', title: '商談アシスト', desc: '自社ナレッジに基づく回答を即時提示' },
          { key: 'interview', icon: '🎓', title: '面接対策', desc: '応募先企業に最適化した回答案を提示' },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key as any)}
            className={`text-left p-5 rounded-2xl border-2 transition-all ${
              mode === m.key
                ? 'border-[#7f19e6] bg-purple-50 shadow-md'
                : 'border-slate-200 bg-white hover:border-purple-200'
            }`}
          >
            <div className="text-3xl mb-2">{m.icon}</div>
            <p className="font-black text-slate-800">{m.title}</p>
            <p className="text-xs text-slate-500 font-bold mt-1">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* コンテキスト選択 */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        {mode === 'sales' ? (
          <div>
            <label className="block text-sm font-black text-slate-700 mb-2">参照ナレッジ（任意）</label>
            <select
              value={kbId}
              onChange={(e) => setKbId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700"
            >
              <option value="">未選択（一般的な回答）</option>
              {kbs.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}（{k._count.chunks}件）
                </option>
              ))}
            </select>
            <Link href="/cunning/knowledge" className="inline-block mt-2 text-xs font-bold text-[#7f19e6] hover:underline">
              ＋ ナレッジを追加・編集
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2">応募先企業（任意）</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700"
              >
                <option value="">未選択</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName || c.url}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-black text-slate-700 mb-2">応募者プロフィール（任意）</label>
              <select
                value={applicantId}
                onChange={(e) => setApplicantId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-bold text-slate-700"
              >
                <option value="">未選択</option>
                {applicants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <Link href="/cunning/company" className="inline-block text-xs font-bold text-[#7f19e6] hover:underline">
              ＋ 企業URLを解析・プロフィールを登録
            </Link>
          </div>
        )}
      </div>

      <button
        onClick={start}
        disabled={starting || overLimit}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#7f19e6] to-fuchsia-600 text-white font-black text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
      >
        {overLimit ? '今月の利用上限に達しました' : starting ? '開始中…' : '🎤 ライブを開始する'}
      </button>
      <p className="text-center text-xs text-slate-400 font-bold mt-2">
        開始後、会議タブの音声共有を許可してください（Chrome/Edge推奨）
      </p>

      {/* 最近のセッション */}
      {sessions.length > 0 && (
        <div className="mt-10">
          <h2 className="font-black text-slate-700 mb-3">最近のセッション</h2>
          <div className="space-y-2">
            {sessions.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                href={`/cunning/live/${s.id}`}
                className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span>{s.mode === 'interview' ? '🎓' : '💼'}</span>
                  <span className="font-bold text-slate-700 truncate">{s.title}</span>
                </div>
                <span className="text-xs font-bold text-slate-400 flex-shrink-0">
                  {s._count.answers}回答 · {Math.floor(s.durationSec / 60)}分
                </span>
              </Link>
            ))}
          </div>
          <Link href="/cunning/history" className="inline-block mt-3 text-xs font-bold text-[#7f19e6] hover:underline">
            すべての履歴を見る →
          </Link>
        </div>
      )}
    </div>
  )
}
