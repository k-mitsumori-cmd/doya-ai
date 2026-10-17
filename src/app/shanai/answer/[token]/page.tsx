'use client'

// ドヤ社内インタビュー 社員が開くアンケート回答画面（ログイン不要）
// ⚠️ 社外・社内の第三者が開く画面。アプリ枠・料金・他サービスへの導線は出さない（guest-path.ts に登録済み）
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import SurveyForm from '@/components/shanai/SurveyForm'
import { api, Button, Notice } from '@/components/shanai/ui'
import type { SurveyAnswers } from '@/lib/shanai/types'

interface Payload {
  intervieweeName: string
  companyName: string
  brandColor: string
  answers: SurveyAnswers
  check: { score: number; canSubmit: boolean; missing: { id: string; question: string; have: number; need: number }[] }
  submittedAt: string | null
  canAskFollowups: boolean
}

export default function ShanaiAnswerPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<Payload | null>(null)
  const [answers, setAnswers] = useState<SurveyAnswers>({})
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'info' | 'warn' | 'error'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [asking, setAsking] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [done, setDone] = useState(false)
  const dirty = useRef(false)
  const answersRef = useRef<SurveyAnswers>({})
  answersRef.current = answers

  useEffect(() => {
    api<Payload>(`/api/shanai/public/survey/${token}`)
      .then((d) => {
        setData(d)
        setAnswers(d.answers || {})
        if (d.submittedAt) setDone(true)
      })
      .catch((e) => setError((e as Error).message))
  }, [token])

  // 書いた内容が消えないよう、30秒ごとに下書き保存する
  useEffect(() => {
    if (done) return
    const t = setInterval(async () => {
      if (!dirty.current) return
      dirty.current = false
      try {
        await api(`/api/shanai/public/survey/${token}`, { method: 'PUT', json: { answers: answersRef.current } })
        setSavedAt(new Date())
      } catch {
        dirty.current = true
      }
    }, 30000)
    // ⚠️ answers を依存に入れない（入力のたびにタイマーが作り直され、書いている間は保存されなくなる）
    return () => clearInterval(t)
  }, [token, done])

  const change = (next: SurveyAnswers) => {
    setAnswers(next)
    dirty.current = true
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const d = await api<{ check: Payload['check'] }>(`/api/shanai/public/survey/${token}`, { method: 'PUT', json: { answers } })
      setData((p) => (p ? { ...p, check: d.check } : p))
      dirty.current = false
      setSavedAt(new Date())
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const followups = async () => {
    setAsking(true)
    setMessage(null)
    try {
      const d = await api<{ answers: SurveyAnswers; added: number; check: Payload['check'] }>(`/api/shanai/public/survey/${token}`, { method: 'POST', json: { action: 'followups', answers } })
      setAnswers(d.answers)
      setData((p) => (p ? { ...p, check: d.check } : p))
      setMessage({ tone: d.added ? 'info' : 'warn', text: d.added ? `${d.added}つの設問に追加の質問があります。お答えいただくと、記事がより具体的になります。` : '追加の質問はありません。このまま提出できます。' })
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message })
    } finally {
      setAsking(false)
    }
  }

  const submit = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await api(`/api/shanai/public/survey/${token}`, { method: 'POST', json: { action: 'submit', answers } })
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      const err = e as Error & { data?: any }
      const missing: Payload['check']['missing'] = err.data?.missing || []
      setMessage({ tone: 'error', text: missing.length ? `${err.message}（あと${missing.length}問）` : err.message })
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Notice tone="error">{error}</Notice>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm font-bold text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        読み込んでいます
      </div>
    )
  }

  const color = /^#[0-9a-f]{6}$/i.test(data.brandColor) ? data.brandColor : '#c026d3'

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-xl px-4 py-20 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12" style={{ color }} />
          <h1 className="mt-4 text-xl font-black text-slate-900">ご回答ありがとうございました</h1>
          <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">
            いただいた内容をもとに、担当者がインタビュー記事を作成します。内容の修正をご希望の場合は、担当者までご連絡ください。
          </p>
        </div>
      </div>
    )
  }

  const check = data.check
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-xs font-black" style={{ color }}>
            {data.companyName ? `${data.companyName} 社員インタビュー` : '社員インタビュー'}
          </p>
          <h1 className="mt-1 text-xl font-black text-slate-900">{data.intervieweeName} さん、アンケートのご協力をお願いします</h1>
          <p className="mt-2 text-sm font-bold leading-relaxed text-slate-500">
            お答えいただいた内容をもとに、インタビュー記事を作成します。書いていただいたこと以外は記事に書きませんので、できるだけ具体的な場面や出来事を教えてください。途中で閉じても、30秒ごとに下書きが保存されます。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between text-xs font-black text-slate-600">
            <span>回答の充実度</span>
            <span className="tabular-nums">
              {check.score}%{check.missing.length > 0 ? `（文字数が足りない設問 ${check.missing.length}問）` : ''}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full transition-all" style={{ width: `${check.score}%`, backgroundColor: color }} />
          </div>
        </div>

        <SurveyForm answers={answers} onChange={change} />

        {message && (
          <div className="mt-4">
            <Notice tone={message.tone}>{message.text}</Notice>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 pb-16">
          {savedAt && <span className="mr-auto text-xs font-bold text-slate-400">{savedAt.toLocaleTimeString('ja-JP')} に保存しました</span>}
          <Button variant="secondary" onClick={save} loading={saving} disabled={asking}>
            下書き保存
          </Button>
          {data.canAskFollowups && (
            <Button variant="secondary" onClick={followups} loading={asking} disabled={saving}>
              <Sparkles className="h-4 w-4" />
              回答を見直す（追加の質問）
            </Button>
          )}
          <Button onClick={submit} loading={saving} disabled={asking}>
            提出する
          </Button>
        </div>
      </main>
    </div>
  )
}
