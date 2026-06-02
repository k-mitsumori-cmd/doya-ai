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
interface SessionDetail {
  id: string
  mode: string
  title: string
  status: string
  durationSec: number
  createdAt: string
  transcripts: Transcript[]
  answers: Answer[]
}

export default function CunningSessionReview() {
  const params = useParams()
  const sessionId = params.sessionId as string
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/cunning/sessions/${sessionId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setSession(d.session || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

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

      <div className="flex justify-end mb-4">
        <Link
          href={`/cunning/live/${session.id}`}
          className="px-4 py-2 rounded-full bg-gradient-to-r from-[#0B5CFF] to-blue-600 text-white font-black text-sm"
        >
          このセッションを再開
        </Link>
      </div>

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

      <h2 className="font-black text-slate-700 mb-3">文字起こし</h2>
      <div className="bg-slate-900 rounded-2xl p-4 max-h-[40vh] overflow-y-auto space-y-1.5">
        {session.transcripts.length === 0 ? (
          <p className="text-slate-500 font-bold text-sm">記録はありません</p>
        ) : (
          session.transcripts.map((t) => (
            <p key={t.id} className="text-sm text-white/90 leading-relaxed">
              {t.text}
            </p>
          ))
        )}
      </div>
    </div>
  )
}
