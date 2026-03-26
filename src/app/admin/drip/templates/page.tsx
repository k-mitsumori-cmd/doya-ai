'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Plus,
  Save,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  Code,
  RefreshCw,
  Copy,
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface DripTemplate {
  id: string
  name: string
  subject: string
  bodyHtml: string
  bodyText: string
  createdAt: string
  updatedAt: string
}

const VARIABLES = [
  { key: '{{user_name}}', label: 'ユーザー名', sample: '田中太郎' },
  { key: '{{email}}', label: 'メールアドレス', sample: 'tanaka@example.com' },
  { key: '{{plan}}', label: 'プラン', sample: 'PRO' },
  { key: '{{last_login}}', label: '最終ログイン', sample: '2026-03-20' },
  { key: '{{days_since_login}}', label: '未ログイン日数', sample: '3' },
  { key: '{{registered_at}}', label: '登録日', sample: '2026-01-15' },
]

const EMPTY_TEMPLATE: Omit<DripTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  subject: '',
  bodyHtml: '',
  bodyText: '',
}

export default function TemplateManagementPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<DripTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, Partial<DripTemplate>>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [newTemplate, setNewTemplate] = useState(EMPTY_TEMPLATE)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<Record<string, boolean>>({})

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/drip/templates', {
        credentials: 'include',
      })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error()
      }
      const data = await res.json()
      setTemplates(data.templates ?? data ?? [])
    } catch {
      toast.error('テンプレートの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const replaceVariables = (text: string): string => {
    let result = text
    for (const v of VARIABLES) {
      result = result.replaceAll(v.key, v.sample)
    }
    return result
  }

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      const tpl = templates.find((t) => t.id === id)
      if (tpl) {
        setEditData((prev) => ({
          ...prev,
          [id]: {
            name: tpl.name,
            subject: tpl.subject,
            bodyHtml: tpl.bodyHtml,
            bodyText: tpl.bodyText,
          },
        }))
      }
    }
  }

  const handleSaveExisting = async (id: string) => {
    const data = editData[id]
    if (!data?.name?.trim() || !data?.subject?.trim()) {
      toast.error('名前と件名は必須です')
      return
    }
    setSavingId(id)
    try {
      const res = await fetch(`/api/admin/drip/templates/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...data } as DripTemplate : t))
      )
      toast.success('テンプレートを保存しました')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSavingId(null)
    }
  }

  const handleCreate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.subject.trim()) {
      toast.error('名前と件名は必須です')
      return
    }
    setSavingId('new')
    try {
      const res = await fetch('/api/admin/drip/templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const created = data.template ?? data
      setTemplates((prev) => [created, ...prev])
      setNewTemplate(EMPTY_TEMPLATE)
      setIsCreating(false)
      toast.success('テンプレートを作成しました')
    } catch {
      toast.error('作成に失敗しました')
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除しますか？')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/drip/templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      if (expandedId === id) setExpandedId(null)
      toast.success('テンプレートを削除しました')
    } catch {
      toast.error('削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }

  const copyVariable = (key: string) => {
    navigator.clipboard.writeText(key)
    toast.success(`${key} をコピーしました`)
  }

  const renderEditor = (
    data: { name: string; subject: string; bodyHtml: string; bodyText: string },
    onChange: (field: string, value: string) => void,
    onSave: () => void,
    saveLabel: string,
    id: string
  ) => {
    const isPreview = previewMode[id] ?? false
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/40 mb-1">テンプレート名</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="例: ウェルカムメール"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">件名</label>
            <input
              type="text"
              value={data.subject}
              onChange={(e) => onChange('subject', e.target.value)}
              placeholder="例: {{user_name}}さん、ようこそ！"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-white/40">HTML本文</label>
              <button
                onClick={() =>
                  setPreviewMode((prev) => ({ ...prev, [id]: !prev[id] }))
                }
                className="flex items-center gap-1 text-xs text-white/30 hover:text-violet-400"
              >
                {isPreview ? (
                  <>
                    <Code className="w-3 h-3" /> コード
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" /> プレビュー
                  </>
                )}
              </button>
            </div>
            {isPreview ? (
              <div
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm min-h-[200px] prose prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: replaceVariables(data.bodyHtml),
                }}
              />
            ) : (
              <textarea
                value={data.bodyHtml}
                onChange={(e) => onChange('bodyHtml', e.target.value)}
                placeholder="<h1>{{user_name}}さん、ようこそ！</h1>"
                rows={8}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-violet-500/50 resize-y"
              />
            )}
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">テキスト本文</label>
            <textarea
              value={data.bodyText}
              onChange={(e) => onChange('bodyText', e.target.value)}
              placeholder="{{user_name}}さん、ようこそ！"
              rows={8}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 resize-y"
            />
          </div>
        </div>

        {/* Variable reference */}
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
          <p className="text-xs text-white/40 mb-2">利用可能な変数</p>
          <div className="flex flex-wrap gap-2">
            {VARIABLES.map((v) => (
              <button
                key={v.key}
                onClick={() => copyVariable(v.key)}
                className="flex items-center gap-1 text-xs bg-white/5 hover:bg-violet-500/10 border border-white/10 hover:border-violet-500/20 rounded-lg px-2 py-1 transition-colors"
              >
                <Copy className="w-3 h-3 text-white/30" />
                <code className="text-violet-300">{v.key}</code>
                <span className="text-white/30">({v.label})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onSave}
            disabled={savingId === id}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 rounded-lg text-sm font-medium transition-colors"
          >
            {savingId === id ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-violet-400" />
            テンプレート管理
          </h1>
          <p className="text-white/50 text-sm mt-1">メールテンプレートの作成・編集</p>
        </div>
        <button
          onClick={() => {
            setIsCreating(!isCreating)
            setExpandedId(null)
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl font-medium text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規テンプレート
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Create form */}
          <AnimatePresence>
            {isCreating && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white/[0.02] border border-violet-500/30 rounded-2xl p-6 overflow-hidden"
              >
                <h3 className="text-sm font-semibold text-violet-300 mb-4">
                  新規テンプレート作成
                </h3>
                {renderEditor(
                  newTemplate,
                  (field, value) =>
                    setNewTemplate((prev) => ({ ...prev, [field]: value })),
                  handleCreate,
                  '作成',
                  'new'
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Existing templates */}
          {templates.map((tpl, i) => (
            <motion.div
              key={tpl.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden"
            >
              {/* Collapsed header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => handleExpand(tpl.id)}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{tpl.name}</h3>
                  <p className="text-xs text-white/30 mt-0.5 truncate">
                    件名: {tpl.subject}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(tpl.id)
                    }}
                    disabled={deletingId === tpl.id}
                    className="p-1.5 rounded-lg hover:bg-rose-500/20 transition-colors"
                  >
                    {deletingId === tpl.id ? (
                      <RefreshCw className="w-4 h-4 text-white/30 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-white/30 hover:text-rose-400" />
                    )}
                  </button>
                  {expandedId === tpl.id ? (
                    <ChevronUp className="w-4 h-4 text-white/30" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white/30" />
                  )}
                </div>
              </div>

              {/* Expanded editor */}
              <AnimatePresence>
                {expandedId === tpl.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 border-t border-white/5 pt-4">
                      {renderEditor(
                        {
                          name: editData[tpl.id]?.name ?? tpl.name,
                          subject: editData[tpl.id]?.subject ?? tpl.subject,
                          bodyHtml: editData[tpl.id]?.bodyHtml ?? tpl.bodyHtml,
                          bodyText: editData[tpl.id]?.bodyText ?? tpl.bodyText,
                        },
                        (field, value) =>
                          setEditData((prev) => ({
                            ...prev,
                            [tpl.id]: { ...prev[tpl.id], [field]: value },
                          })),
                        () => handleSaveExisting(tpl.id),
                        '保存',
                        tpl.id
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}

          {templates.length === 0 && !isCreating && (
            <div className="text-center py-20 text-white/30">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>テンプレートがありません</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
