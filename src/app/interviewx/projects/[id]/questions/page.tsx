'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Wand2, Plus, GripVertical, Trash2, Loader2,
  Save, ChevronUp, ChevronDown, ArrowRight
} from 'lucide-react'

const QUESTION_TYPES = [
  { value: 'TEXT', label: '短文' },
  { value: 'TEXTAREA', label: '長文' },
  { value: 'SELECT', label: '選択式' },
  { value: 'RATING', label: '5段階評価' },
  { value: 'YES_NO', label: 'はい/いいえ' },
]

interface Question {
  id?: string
  text: string
  description: string
  type: string
  required: boolean
  order: number
  options?: any
}

export default function QuestionsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generateProgress, setGenerateProgress] = useState('')
  const [projectStatus, setProjectStatus] = useState('')

  useEffect(() => {
    fetch(`/api/interviewx/projects/${projectId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.project) {
          setQuestions(
            (data.project.questions || []).map((q: any) => ({
              id: q.id,
              text: q.text,
              description: q.description || '',
              type: q.type,
              required: q.required,
              order: q.order,
              options: q.options,
            }))
          )
          setProjectStatus(data.project.status)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [projectId])

  const generateQuestions = async () => {
    setGenerating(true)
    setGenerateProgress('質問生成を開始...')
    try {
      const res = await fetch(`/api/interviewx/projects/${projectId}/generate-questions`, {
        method: 'POST',
      })
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'progress') setGenerateProgress(event.message)
            if (event.type === 'done') {
              setQuestions(
                (event.data?.questions || []).map((q: any) => ({
                  id: q.id,
                  text: q.text,
                  description: q.description || '',
                  type: q.type,
                  required: q.required,
                  order: q.order,
                  options: q.options,
                }))
              )
              setProjectStatus('QUESTIONS_READY')
              setGenerateProgress('')
            }
            if (event.type === 'error') {
              setGenerateProgress(`エラー: ${event.message}`)
            }
          } catch {}
        }
      }
    } catch (e) {
      setGenerateProgress('質問生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  const saveQuestions = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/interviewx/projects/${projectId}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: questions.map((q, idx) => ({
            id: q.id,
            text: q.text,
            description: q.description,
            type: q.type,
            required: q.required,
            order: idx + 1,
            options: q.options,
          })),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setQuestions(
          (data.questions || []).map((q: any) => ({
            id: q.id,
            text: q.text,
            description: q.description || '',
            type: q.type,
            required: q.required,
            order: q.order,
            options: q.options,
          }))
        )
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const addQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        text: '',
        description: '',
        type: 'TEXTAREA',
        required: true,
        order: prev.length + 1,
      },
    ])
  }

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= questions.length) return
    setQuestions(prev => {
      const arr = [...prev]
      ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
      return arr
    })
  }

  const updateQuestion = (idx: number, field: keyof Question, value: any) => {
    setQuestions(prev => prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href={`/interviewx/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        プロジェクトに戻る
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">質問編集</h1>
          <p className="text-slate-500 mt-1">
            {questions.length > 0 ? `${questions.length}個の質問` : 'AIで質問を自動生成、または手動で追加'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateQuestions}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold hover:from-indigo-600 hover:to-violet-600 transition-all disabled:opacity-50 text-sm"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            {questions.length > 0 ? 'AI再生成' : 'AIで生成'}
          </button>
        </div>
      </div>

      {/* 生成中のプログレス */}
      {generating && generateProgress && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
            <p className="text-sm font-medium text-indigo-700">{generateProgress}</p>
          </div>
        </div>
      )}

      {/* 質問一覧 */}
      {questions.length === 0 && !generating ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Wand2 className="w-12 h-12 text-indigo-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">まだ質問がありません</h2>
          <p className="text-slate-500 mb-6">AIで自動生成するか、手動で追加してください。</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={generateQuestions}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold"
            >
              <Wand2 className="w-5 h-5" />
              AIで質問生成
            </button>
            <button
              onClick={addQuestion}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="w-5 h-5" />
              手動で追加
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q.id || idx} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 pt-1">
                  <GripVertical className="w-4 h-4 text-slate-300" />
                  <span className="text-xs font-bold text-slate-400">{idx + 1}</span>
                  <button onClick={() => moveQuestion(idx, 'up')} disabled={idx === 0} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveQuestion(idx, 'down')} disabled={idx === questions.length - 1} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={q.text}
                    onChange={e => updateQuestion(idx, 'text', e.target.value)}
                    placeholder="質問文を入力..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <input
                    type="text"
                    value={q.description}
                    onChange={e => updateQuestion(idx, 'description', e.target.value)}
                    placeholder="補足説明（任意）"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-3">
                    <select
                      value={q.type}
                      onChange={e => updateQuestion(idx, 'type', e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {QUESTION_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={e => updateQuestion(idx, 'required', e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      必須
                    </label>
                  </div>
                </div>

                <button
                  onClick={() => removeQuestion(idx)}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* 追加・保存ボタン */}
          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={addQuestion}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-600 font-bold hover:bg-slate-50 text-sm"
            >
              <Plus className="w-4 h-4" />
              質問を追加
            </button>
            <div className="flex-1" />
            <button
              onClick={saveQuestions}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              保存
            </button>
            <Link
              href={`/interviewx/projects/${projectId}/share`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold hover:from-indigo-600 hover:to-violet-600 transition-all text-sm"
            >
              共有設定へ
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
