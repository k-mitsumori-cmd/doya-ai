'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Save,
  Plus,
  Trash2,
  ArrowLeft,
  Clock,
  Mail,
  GitBranch,
  RefreshCw,
  CheckCircle,
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface Step {
  id: string
  label: string
  dayOffset: number
  sendTime: string
  templateId: string | null
  conditionType: string
  sortOrder: number
}

interface Sequence {
  id: string
  name: string
  status: 'draft' | 'active' | 'paused'
  segmentId: string | null
  steps: Step[]
}

interface Template {
  id: string
  name: string
}

interface Segment {
  id: string
  name: string
  userCount: number
}

const CONDITION_OPTIONS = [
  { value: 'none', label: 'なし' },
  { value: 'not_opened', label: '前ステップ未開封' },
  { value: 'opened', label: '開封済' },
  { value: 'not_clicked', label: '未クリック' },
  { value: 'clicked', label: 'クリック済' },
  { value: 'opened_not_clicked', label: '開封済&未クリック' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: '下書き' },
  { value: 'active', label: '配信中' },
  { value: 'paused', label: '一時停止' },
]

export default function SequenceEditorPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const isNew = id === 'new'

  const [sequence, setSequence] = useState<Sequence>({
    id: '',
    name: '',
    status: 'draft',
    segmentId: null,
    steps: [],
  })
  const [templates, setTemplates] = useState<Template[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const promises: Promise<Response>[] = [
        fetch('/api/admin/drip/templates', { credentials: 'include' }),
        fetch('/api/admin/drip/segments', { credentials: 'include' }),
      ]
      if (!isNew) {
        promises.push(
          fetch(`/api/admin/drip/sequences/${id}`, { credentials: 'include' })
        )
      }

      const results = await Promise.all(promises)

      for (const r of results) {
        if (r.status === 401) {
          router.push('/admin/login')
          return
        }
      }

      const [templatesRes, segmentsRes] = results
      const templatesData = await templatesRes.json()
      const segmentsData = await segmentsRes.json()

      setTemplates(templatesData.templates ?? templatesData ?? [])
      setSegments(segmentsData.segments ?? segmentsData ?? [])

      if (!isNew && results[2]) {
        if (!results[2].ok) throw new Error('シーケンスが見つかりません')
        const seqData = await results[2].json()
        const seq = seqData.sequence ?? seqData
        setSequence({
          id: seq.id,
          name: seq.name,
          status: seq.status,
          segmentId: seq.segmentId ?? null,
          steps: (seq.steps ?? []).map((s: Step) => ({
            id: s.id,
            label: s.label ?? '',
            dayOffset: s.dayOffset ?? 0,
            sendTime: s.sendTime ?? '09:00',
            templateId: s.templateId ?? null,
            conditionType: s.conditionType ?? 'none',
            sortOrder: s.sortOrder ?? 0,
          })).sort((a: Step, b: Step) => a.sortOrder - b.sortOrder),
        })
      }
    } catch (err) {
      console.error('Sequence editor fetch error:', err)
      toast.error('データの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [id, isNew, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSave = async () => {
    if (!sequence.name.trim()) {
      toast.error('シーケンス名を入力してください')
      return
    }
    setIsSaving(true)
    try {
      const method = isNew ? 'POST' : 'PUT'
      const url = isNew
        ? '/api/admin/drip/sequences'
        : `/api/admin/drip/sequences/${id}`

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sequence.name,
          status: sequence.status,
          segmentId: sequence.segmentId,
          steps: sequence.steps,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(isNew ? 'シーケンスを作成しました' : '保存しました')

      if (isNew && data.id) {
        router.replace(`/admin/drip/sequences/${data.id}`)
      }
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddStep = async () => {
    const newStep: Step = {
      id: `temp-${Date.now()}`,
      label: `ステップ ${sequence.steps.length + 1}`,
      dayOffset: sequence.steps.length > 0
        ? (sequence.steps[sequence.steps.length - 1]?.dayOffset ?? 0) + 1
        : 0,
      sendTime: '09:00',
      templateId: null,
      conditionType: 'none',
      sortOrder: sequence.steps.length,
    }

    if (!isNew && sequence.id) {
      try {
        const res = await fetch(`/api/admin/drip/sequences/${sequence.id}/steps`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newStep),
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        const created = data.step ?? data
        setSequence((prev) => ({
          ...prev,
          steps: [...prev.steps, { ...newStep, id: created.id ?? newStep.id }],
        }))
        toast.success('ステップを追加しました')
      } catch {
        toast.error('ステップの追加に失敗しました')
      }
    } else {
      setSequence((prev) => ({
        ...prev,
        steps: [...prev.steps, newStep],
      }))
    }
  }

  const handleUpdateStep = async (stepId: string, field: string, value: string | number) => {
    setSequence((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === stepId ? { ...s, [field]: value } : s
      ),
    }))

    if (!isNew && sequence.id && !stepId.startsWith('temp-')) {
      try {
        await fetch(`/api/admin/drip/sequences/${sequence.id}/steps/${stepId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })
      } catch {
        // Silent fail for inline updates - will be saved with main save
      }
    }
  }

  const handleDeleteStep = async (stepId: string) => {
    if (!confirm('このステップを削除しますか？')) return
    setDeletingStepId(stepId)

    if (!isNew && sequence.id && !stepId.startsWith('temp-')) {
      try {
        const res = await fetch(
          `/api/admin/drip/sequences/${sequence.id}/steps/${stepId}`,
          { method: 'DELETE', credentials: 'include' }
        )
        if (!res.ok) throw new Error()
      } catch {
        toast.error('ステップの削除に失敗しました')
        setDeletingStepId(null)
        return
      }
    }

    setSequence((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== stepId),
    }))
    toast.success('ステップを削除しました')
    setDeletingStepId(null)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.push('/admin/drip/sequences')}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-violet-400" />
            {isNew ? '新規シーケンス作成' : 'シーケンス編集'}
          </h1>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 rounded-xl font-medium text-sm transition-colors"
        >
          {isSaving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isNew ? '作成' : '保存'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Sequence Meta */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 mb-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-white/50 mb-1.5">シーケンス名</label>
                <input
                  type="text"
                  value={sequence.name}
                  onChange={(e) =>
                    setSequence((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="例: ウェルカムシーケンス"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1.5">ステータス</label>
                <select
                  value={sequence.status}
                  onChange={(e) =>
                    setSequence((prev) => ({
                      ...prev,
                      status: e.target.value as Sequence['status'],
                    }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-colors appearance-none"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1.5">セグメント</label>
                <select
                  value={sequence.segmentId ?? ''}
                  onChange={(e) =>
                    setSequence((prev) => ({
                      ...prev,
                      segmentId: e.target.value || null,
                    }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500/50 transition-colors appearance-none"
                >
                  <option value="" className="bg-[#1a1a2e]">
                    全ユーザー
                  </option>
                  {segments.map((seg) => (
                    <option key={seg.id} value={seg.id} className="bg-[#1a1a2e]">
                      {seg.name} ({seg.userCount}名)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>

          {/* Flow Editor */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-white/40" />
              フローエディタ
            </h2>

            <div className="relative">
              {/* Timeline line */}
              {sequence.steps.length > 0 && (
                <div className="absolute left-6 top-8 bottom-16 w-0.5 bg-violet-500/20" />
              )}

              <AnimatePresence>
                {sequence.steps.map((step, idx) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="relative flex gap-4 mb-4"
                  >
                    {/* Timeline circle */}
                    <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-violet-500/20 border-2 border-violet-500/40 flex items-center justify-center text-sm font-bold text-violet-300">
                      {idx + 1}
                    </div>

                    {/* Step card */}
                    <div className="flex-1 bg-white/[0.02] border border-white/10 rounded-xl p-4 hover:border-violet-500/20 transition-colors">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {/* Label */}
                        <div>
                          <label className="block text-xs text-white/40 mb-1">ラベル</label>
                          <input
                            type="text"
                            value={step.label}
                            onChange={(e) =>
                              handleUpdateStep(step.id, 'label', e.target.value)
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
                          />
                        </div>

                        {/* Day Offset */}
                        <div>
                          <label className="block text-xs text-white/40 mb-1">
                            <Clock className="w-3 h-3 inline mr-1" />
                            日数オフセット
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={step.dayOffset}
                            onChange={(e) =>
                              handleUpdateStep(
                                step.id,
                                'dayOffset',
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
                          />
                        </div>

                        {/* Send Time */}
                        <div>
                          <label className="block text-xs text-white/40 mb-1">送信時刻</label>
                          <input
                            type="time"
                            value={step.sendTime}
                            onChange={(e) =>
                              handleUpdateStep(step.id, 'sendTime', e.target.value)
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
                          />
                        </div>

                        {/* Template */}
                        <div>
                          <label className="block text-xs text-white/40 mb-1">テンプレート</label>
                          <select
                            value={step.templateId ?? ''}
                            onChange={(e) =>
                              handleUpdateStep(
                                step.id,
                                'templateId',
                                e.target.value || ''
                              )
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 appearance-none"
                          >
                            <option value="" className="bg-[#1a1a2e]">
                              選択してください
                            </option>
                            {templates.map((t) => (
                              <option key={t.id} value={t.id} className="bg-[#1a1a2e]">
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Condition */}
                        <div>
                          <label className="block text-xs text-white/40 mb-1">条件</label>
                          <select
                            value={step.conditionType}
                            onChange={(e) =>
                              handleUpdateStep(step.id, 'conditionType', e.target.value)
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 appearance-none"
                          >
                            {CONDITION_OPTIONS.map((c) => (
                              <option key={c.value} value={c.value} className="bg-[#1a1a2e]">
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Delete step button */}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => handleDeleteStep(step.id)}
                          disabled={deletingStepId === step.id}
                          className="flex items-center gap-1 text-xs text-white/30 hover:text-rose-400 transition-colors"
                        >
                          {deletingStepId === step.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          削除
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Add step button */}
              <div className="relative flex gap-4">
                <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-white/30" />
                </div>
                <button
                  onClick={handleAddStep}
                  className="flex-1 border-2 border-dashed border-white/10 rounded-xl p-4 text-center text-white/30 hover:border-violet-500/30 hover:text-violet-400 transition-colors"
                >
                  <Plus className="w-5 h-5 mx-auto mb-1" />
                  ステップを追加
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}
