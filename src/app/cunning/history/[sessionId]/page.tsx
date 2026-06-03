'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Transcript {
  id: string
  speaker: string | null
  text: string
  createdAt: string
}
interface Answer {
  id: string
  questionText: string
  summary: string
  script: string
  sources: { label: string; url?: string }[] | null
  model: string | null
  createdAt: string
}
interface CunningReport {
  title: string
  summary: string
  decisions: string[]
  todos: string[]
  score: number
  scoreLabel: string
  feedback: string
  good: string[]
  improve: string[]
}
interface SessionDetail {
  id: string
  mode: string
  title: string
  status: string
  durationSec: number
  createdAt: string
  transcripts: Transcript[]
  answers: Answer[]
  report: CunningReport | null
}

export default function CunningSessionReview() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [genLoading, setGenLoading] = useState(false)

  const load = () =>
    fetch(`/api/cunning/sessions/${sessionId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setSession(d.session || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const genReport = async (force: boolean) => {
    setGenLoading(true)
    try {
      const res = await fetch(`/api/cunning/sessions/${sessionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const d = await res.json()
      if (res.ok) setSession((s) => (s ? { ...s, report: d.report } : s))
    } finally {
      setGenLoading(false)
    }
  }

  if (loading) return <div className="p-10 text-slate-400 font-bold">読み込み中…</div>
  if (!session) return <div className="p-10 text-slate-400 font-bold">セッションが見つかりません</div>

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/cunning/history" className="text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <span>{session.mode === 'interview' ? '🎓' : '💼'}</span>
        <h1 className="text-xl font-black text-slate-900">{session.title}</h1>
      </div>
      <p className="text-xs font-bold text-slate-400 mb-6">
        {new Date(session.createdAt).toLocaleString('ja-JP')} · {session.answers.length}回答 ·{' '}
        {Math.floor(session.durationSec / 60)}分
      </p>

      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={() => genReport(!!session.report)}
          disabled={genLoading}
          className="px-4 py-2 rounded-full bg-white border border-slate-200 text-[#0B5CFF] font-black text-sm disabled:opacity-50"
        >
          {genLoading ? '生成中…' : session.report ? '議事録を再生成' : '議事録・評価を生成'}
        </button>
        <Link
          href={`/cunning/live/${session.id}`}
          className="px-4 py-2 rounded-full bg-gradient-to-r from-[#0B5CFF] to-blue-600 text-white font-black text-sm"
        >
          このセッションを再開
        </Link>
      </div>

      {/* 議事録＋評価 */}
      {session.report && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-8">
          <div className="rounded-2xl bg-gradient-to-br from-[#2D8CFF] to-[#0B5CFF] text-white p-4 text-center mb-4">
            <p className="text-xs font-black opacity-90">{session.report.scoreLabel}</p>
            <p className="text-4xl font-black leading-none mt-1">
              {session.report.score}
              <span className="text-xl">点</span>
            </p>
            {session.report.feedback && <p className="text-sm font-bold mt-1 opacity-95">{session.report.feedback}</p>}
          </div>
          {session.report.summary && (
            <div className="mb-3">
              <p className="text-xs font-black text-slate-400 mb-1">議事録（要約）</p>
              <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                {session.report.summary}
              </p>
            </div>
          )}
          {session.report.decisions.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-black text-slate-400 mb-1">決定事項</p>
              <ul className="text-sm text-slate-700 font-medium list-disc list-inside space-y-0.5">
                {session.report.decisions.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </div>
          )}
          {session.report.todos.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-black text-slate-400 mb-1">ネクストアクション</p>
              <ul className="text-sm text-slate-700 font-medium space-y-0.5">
                {session.report.todos.map((d, i) => (
                  <li key={i} className="flex items-start gap-1.5"><span className="text-[#0B5CFF]">✓</span>{d}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {session.report.good.length > 0 && (
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xs font-black text-green-600 mb-1">👍 良かった点</p>
                <ul className="text-xs text-slate-600 font-bold space-y-0.5 list-disc list-inside">
                  {session.report.good.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
            {session.report.improve.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs font-black text-amber-600 mb-1">💡 改善点</p>
                <ul className="text-xs text-slate-600 font-bold space-y-0.5 list-disc list-inside">
                  {session.report.improve.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <h2 className="font-black text-slate-700 mb-3">回答ログ</h2>
      <div className="space-y-3 mb-8">
        {session.answers.length === 0 ? (
          <p className="text-slate-400 font-bold text-sm">回答はありません</p>
        ) : (
          session.answers.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-[#0B5CFF]">
              <p className="text-xs font-bold text-slate-400 mb-1">質問: {a.questionText}</p>
              <p className="text-base font-black text-slate-900 leading-snug">{a.summary}</p>
              {a.script && (
                <p className="mt-2 text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                  {a.script}
                </p>
              )}
              {a.sources && a.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {a.sources.map((s, i) => (
                    <span key={i} className="text-[11px] font-bold text-[#0B5CFF] bg-blue-50 rounded-full px-2.5 py-1">
                      {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <h2 className="font-black text-slate-700 mb-3">文字起こし（🟦自分 / ⬜相手）</h2>
      <div className="bg-slate-900 rounded-2xl p-4 max-h-[40vh] overflow-y-auto space-y-1.5">
        {session.transcripts.length === 0 ? (
          <p className="text-slate-500 font-bold text-sm">記録はありません</p>
        ) : (
          session.transcripts.map((t) => (
            <div key={t.id} className={`flex ${t.speaker === 'self' ? 'justify-end' : 'justify-start'}`}>
              <p
                className={`text-sm leading-relaxed rounded-lg px-2.5 py-1 max-w-[85%] ${
                  t.speaker === 'self' ? 'bg-[#0B5CFF] text-white' : 'bg-white/10 text-white/90'
                }`}
              >
                {t.text}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
