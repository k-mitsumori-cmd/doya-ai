'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AiInsightPanel from './AiInsightPanel'

interface AgendaItem {
  id: string
  topic: string
  category: string
}

interface ActionItem {
  id: string
  content: string
  assignee: string
  dueDate: string
  done: boolean
}

const AGENDA_CATEGORIES = [
  { value: 'BUSINESS', label: '業務' },
  { value: 'CAREER', label: 'キャリア' },
  { value: 'PERSONAL', label: 'プライベート' },
  { value: 'FEEDBACK', label: 'フィードバック' },
  { value: 'OTHER', label: 'その他' },
]

interface OneOnOneFormProps {
  recordId?: string
  employeeId?: string
  employeeName?: string
  initialDate?: string
  initialDuration?: number
  initialAgenda?: AgendaItem[]
  initialManagerNote?: string
  initialSharedNote?: string
  initialActionItems?: ActionItem[]
  readOnly?: boolean
  onSave?: (data: any) => void
}

export default function OneOnOneForm({
  recordId,
  employeeId,
  employeeName = '',
  initialDate = new Date().toISOString().slice(0, 16),
  initialDuration = 30,
  initialAgenda = [],
  initialManagerNote = '',
  initialSharedNote = '',
  initialActionItems = [],
  readOnly = false,
  onSave,
}: OneOnOneFormProps) {
  const [date, setDate] = useState(initialDate)
  const [duration, setDuration] = useState(initialDuration)
  const [agenda, setAgenda] = useState<AgendaItem[]>(
    initialAgenda.length > 0
      ? initialAgenda
      : [{ id: crypto.randomUUID(), topic: '', category: 'BUSINESS' }]
  )
  const [managerNote, setManagerNote] = useState(initialManagerNote)
  const [sharedNote, setSharedNote] = useState(initialSharedNote)
  const [actionItems, setActionItems] = useState<ActionItem[]>(
    initialActionItems.length > 0
      ? initialActionItems
      : [{ id: crypto.randomUUID(), content: '', assignee: '', dueDate: '', done: false }]
  )
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Agenda handlers
  const addAgenda = () => {
    setAgenda([...agenda, { id: crypto.randomUUID(), topic: '', category: 'BUSINESS' }])
  }
  const removeAgenda = (id: string) => {
    if (agenda.length <= 1) return
    setAgenda(agenda.filter((a) => a.id !== id))
  }
  const updateAgenda = (id: string, field: keyof AgendaItem, value: string) => {
    setAgenda(agenda.map((a) => (a.id === id ? { ...a, [field]: value } : a)))
  }

  // Action item handlers
  const addAction = () => {
    setActionItems([
      ...actionItems,
      { id: crypto.randomUUID(), content: '', assignee: '', dueDate: '', done: false },
    ])
  }
  const removeAction = (id: string) => {
    setActionItems(actionItems.filter((a) => a.id !== id))
  }
  const updateAction = (id: string, field: keyof ActionItem, value: string | boolean) => {
    setActionItems(actionItems.map((a) => (a.id === id ? { ...a, [field]: value } : a)))
  }

  const handleAiSummary = async () => {
    setAiLoading(true)
    setAiResult(null)
    try {
      const url = recordId
        ? `/api/hr/one-on-one/${recordId}/ai-summary`
        : '/api/hr/one-on-one/ai-summary'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          employeeId,
          agenda,
          managerNote,
          sharedNote,
          actionItems,
        }),
      })
      if (!res.ok) throw new Error('AI要約の生成に失敗しました')
      const data = await res.json()
      setAiResult(data.summary || data.result || '')
    } catch (e: any) {
      setAiResult(`エラー: ${e.message}`)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        recordId,
        employeeId,
        date,
        duration,
        agenda,
        managerNote,
        sharedNote,
        actionItems,
      }
      if (onSave) {
        await onSave(payload)
      } else {
        const url = recordId ? `/api/hr/one-on-one/${recordId}` : '/api/hr/one-on-one'
        const method = recordId ? 'PUT' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('保存に失敗しました')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Date & Duration */}
      <div className="bg-white rounded-3xl shadow-md p-6">
        <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-sky-500">event</span>
          基本情報
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {employeeName && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">対象者</label>
              <p className="text-sm font-semibold text-slate-900 py-2">{employeeName}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">日時</label>
            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">所要時間（分）</label>
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              disabled={readOnly}
              className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100"
            >
              <option value={15}>15分</option>
              <option value={30}>30分</option>
              <option value={45}>45分</option>
              <option value={60}>60分</option>
              <option value={90}>90分</option>
            </select>
          </div>
        </div>
      </div>

      {/* Agenda */}
      <div className="bg-white rounded-3xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-500">list_alt</span>
            アジェンダ
          </h3>
          {!readOnly && (
            <button
              type="button"
              onClick={addAgenda}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:shadow-lg transition-all"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              アジェンダ追加
            </button>
          )}
        </div>
        <AnimatePresence>
          {agenda.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 last:mb-0"
            >
              <div className="flex gap-3 items-start p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm font-bold text-slate-400 mt-2">{index + 1}</span>
                <div className="flex-1">
                  <input
                    type="text"
                    value={item.topic}
                    onChange={(e) => updateAgenda(item.id, 'topic', e.target.value)}
                    disabled={readOnly}
                    className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100 mb-2"
                    placeholder="トピックを入力"
                  />
                  <select
                    value={item.category}
                    onChange={(e) => updateAgenda(item.id, 'category', e.target.value)}
                    disabled={readOnly}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100"
                  >
                    {AGENDA_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                {!readOnly && agenda.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeAgenda(item.id)}
                    aria-label="アジェンダを削除"
                    className="text-slate-400 hover:text-red-500 transition-colors mt-2"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-3xl shadow-md p-6 space-y-4">
        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-sky-500">edit_note</span>
          メモ
        </h3>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            共有メモ（上司・部下で共有）
          </label>
          <textarea
            value={sharedNote}
            onChange={(e) => setSharedNote(e.target.value)}
            disabled={readOnly}
            rows={4}
            className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100 resize-none"
            placeholder="1on1の内容を記録..."
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            上司メモ（上司のみ閲覧可）
          </label>
          <textarea
            value={managerNote}
            onChange={(e) => setManagerNote(e.target.value)}
            disabled={readOnly}
            rows={3}
            className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100 resize-none"
            placeholder="部下には見えないメモ..."
          />
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-white rounded-3xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-500">task_alt</span>
            アクションアイテム
          </h3>
          {!readOnly && (
            <button
              type="button"
              onClick={addAction}
              className="flex items-center gap-1 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-lg text-sm font-semibold hover:bg-sky-100 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              追加
            </button>
          )}
        </div>
        <AnimatePresence>
          {actionItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 last:mb-0"
            >
              <div className="flex gap-3 items-start p-3 bg-slate-50 rounded-xl border border-slate-100">
                <button
                  type="button"
                  onClick={() => !readOnly && updateAction(item.id, 'done', !item.done)}
                  disabled={readOnly}
                  className="mt-1.5"
                >
                  <span className={`material-symbols-outlined text-xl ${item.done ? 'text-emerald-500' : 'text-slate-300'}`}
                    style={{ fontVariationSettings: item.done ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    check_circle
                  </span>
                </button>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={item.content}
                      onChange={(e) => updateAction(item.id, 'content', e.target.value)}
                      disabled={readOnly}
                      className={`w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100 ${item.done ? 'line-through text-slate-400' : ''}`}
                      placeholder="アクションアイテムを入力"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={item.dueDate}
                      onChange={(e) => updateAction(item.id, 'dueDate', e.target.value)}
                      disabled={readOnly}
                      className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100"
                    />
                  </div>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeAction(item.id)}
                    aria-label="アクションアイテムを削除"
                    className="text-slate-400 hover:text-red-500 transition-colors mt-1.5"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* AI Summary */}
      {!readOnly && (
        <div className="bg-white rounded-3xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-500">auto_awesome</span>
              AI要約生成
            </h3>
            <button
              type="button"
              onClick={handleAiSummary}
              disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-full text-base font-bold hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50"
            >
              {aiLoading ? (
                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
              )}
              {aiLoading ? '生成中...' : 'AI要約生成'}
            </button>
          </div>
          {(aiLoading || aiResult) && (
            <AiInsightPanel loading={aiLoading} content={aiResult || ''} />
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
          {error}
        </div>
      )}

      {/* Actions */}
      {!readOnly && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-full text-base font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      )}
    </div>
  )
}
