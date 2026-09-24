'use client'

import { mergeCunningEntries } from '@/lib/cunning/history-client'
import { useEffect, useRef, useState } from 'react'
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
  sourceCoverage?: { transcripts: number; answers: number }
  incompleteInput?: boolean
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
  reportStatus?: 'current' | 'outdated' | 'unverified' | null
  pagination?: { transcripts: string | null; answers: string | null }
  totals?: { transcripts: number; answers: number }
  report: CunningReport | null
}

export default function CunningSessionReview() {
  const params = useParams()
  const sessionId = params.sessionId as string
  return <CunningSessionContent key={sessionId} sessionId={sessionId} />
}

function CunningSessionContent({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [canGeneratePartial, setCanGeneratePartial] = useState(false)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryStep, setRetryStep] = useState(0)
  const [moreBusy, setMoreBusy] = useState({ transcripts: false, answers: false })
  const [moreError, setMoreError] = useState<{ transcripts: string | null; answers: string | null }>({ transcripts: null, answers: null })
  const busyRef = useRef(new Set<string>())
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    setLoading(true)
    setLoadError(null)
    setMoreError({ transcripts: null, answers: null })
    fetch(`/api/cunning/sessions/${sessionId}`, { cache: 'no-store', signal: controller.signal })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || '履歴を取得できませんでした')
        if (d.session?.id !== sessionId || !Array.isArray(d.session.transcripts) || !Array.isArray(d.session.answers)) throw new Error('履歴の形式を確認できませんでした')
        if (active) setSession(d.session)
      })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : '履歴を取得できませんでした') })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [sessionId, retryStep])

  const loadMore = async (kind: 'transcripts' | 'answers') => {
    const cursor = session?.pagination?.[kind]
    if (!cursor || busyRef.current.has(kind)) return
    busyRef.current.add(kind)
    setMoreBusy((s) => ({ ...s, [kind]: true }))
    setMoreError((s) => ({ ...s, [kind]: null }))
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const query = new URLSearchParams({ kind, cursor })
      const r = await fetch(`/api/cunning/sessions/${sessionId}/entries?${query}`, { cache: 'no-store', signal: controller.signal })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || '続きを取得できませんでした')
      if (d.kind !== kind || !Array.isArray(d.items) || !(d.nextCursor === null || typeof d.nextCursor === 'string')) throw new Error('履歴の形式を確認できませんでした')
      if (!aliveRef.current) return
      setSession((current) => {
        if (!current || current.id !== sessionId || current.pagination?.[kind] !== cursor) return current
        const pagination = { ...current.pagination, [kind]: d.nextCursor }
        return kind === 'transcripts'
          ? { ...current, transcripts: mergeCunningEntries<Transcript>(current.transcripts, d.items), pagination }
          : { ...current, answers: mergeCunningEntries<Answer>(current.answers, d.items), pagination }
      })
    } catch (error) {
      if (aliveRef.current) setMoreError((s) => ({ ...s, [kind]: error instanceof Error ? error.message : '続きを取得できませんでした' }))
    } finally {
      clearTimeout(timeout)
      busyRef.current.delete(kind)
      if (aliveRef.current) setMoreBusy((s) => ({ ...s, [kind]: false }))
    }
  }

  const genReport = async (force: boolean, acceptIncomplete = false) => {
    setGenLoading(true)
    setGenError(null)
    setCanGeneratePartial(false)
    try {
      const res = await fetch(`/api/cunning/sessions/${sessionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force, acceptIncomplete }),
      })
      const d = await res.json()
      if (!res.ok) {
        if (aliveRef.current && d.code === 'AUDIO_PENDING') setCanGeneratePartial(d.canGeneratePartial === true)
        throw new Error(d.error || '議事録を生成できませんでした。再試行してください。')
      }
      if (aliveRef.current) setSession((s) => (s?.id === sessionId ? { ...s, report: d.report, reportStatus: d.reportStatus } : s))
    } catch (error) {
      if (aliveRef.current) setGenError(error instanceof Error ? error.message : '議事録を生成できませんでした。再試行してください。')
    } finally {
      if (aliveRef.current) setGenLoading(false)
    }
  }

  if (loading) return <div className="p-10 text-slate-400 font-bold">読み込み中…</div>
  if (loadError) return <div role="alert" className="p-10 text-sm"><p>{loadError}</p><button onClick={() => setRetryStep((n) => n + 1)} className="mt-3 font-bold underline">再試行する</button></div>
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
        {new Date(session.createdAt).toLocaleString('ja-JP')} · {Math.max(session.totals?.answers ?? 0, session.answers.length)}回答 ·{' '}
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
          href={session.status === 'active' ? `/cunning/live/${session.id}` : '/cunning'}
          className="px-4 py-2 rounded-full bg-gradient-to-r from-[#0B5CFF] to-blue-600 text-white font-black text-sm"
        >
          {session.status === 'active' ? 'このセッションを開く' : '新しいセッションを作成する'}
        </Link>
      </div>

      {genError && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{genError}{session.report ? ' 保存済みの議事録は保持されています。' : ''}</p>}
      {canGeneratePartial && (
        <button type="button" disabled={genLoading} onClick={() => void genReport(!!session.report, true)} className="mb-4 rounded-xl border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900 disabled:opacity-50">
          保存済みの内容だけで議事録を作成する
        </button>
      )}
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
          {session.reportStatus === 'outdated' && <p role="alert" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">この議事録には、後から追加・変更された会話や設定が反映されていません。「議事録を再生成」で更新してください。</p>}
          {session.reportStatus === 'unverified' && <p role="status" className="mb-3 text-sm text-slate-600">この議事録が最新の会話内容に対応しているか確認できません。必要に応じて再生成してください。</p>}
          {session.report.incompleteInput && <p role="alert" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">一部の音声または回答が欠けています。保存できた内容のみの議事録です。</p>}
          <p className="mb-3 text-xs text-slate-500">{session.report.sourceCoverage
            ? `対象: 発話${session.report.sourceCoverage.transcripts}件・回答${session.report.sourceCoverage.answers}件`
            : '旧形式の議事録のため対象件数を確認できません。会話全体を対象にするには再生成してください。'}</p>
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

      {moreError.answers && <p role="alert" className="mb-2 text-sm text-amber-700">{moreError.answers} <button className="underline font-bold" onClick={() => setRetryStep(n => n + 1)}>履歴を読み直す</button></p>}
      {session.pagination?.answers && <button disabled={moreBusy.answers} onClick={() => void loadMore('answers')} className="mb-8 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">{moreBusy.answers ? '読み込み中…' : '回答の続きを読み込む'}</button>}
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
      {moreError.transcripts && <p role="alert" className="mt-2 text-sm text-amber-700">{moreError.transcripts} <button className="underline font-bold" onClick={() => setRetryStep(n => n + 1)}>履歴を読み直す</button></p>}
      {session.pagination?.transcripts && <button disabled={moreBusy.transcripts} onClick={() => void loadMore('transcripts')} className="mt-3 rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">{moreBusy.transcripts ? '読み込み中…' : '文字起こしの続きを読み込む'}</button>}
    </div>
  )
}
