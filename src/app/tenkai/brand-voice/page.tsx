'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ============================================
// 型定義
// ============================================
interface BrandVoice {
  id: string
  name: string
  isDefault: boolean
  formalityLevel: number     // 1-5: カジュアル → フォーマル
  enthusiasmLevel: number    // 1-5: 落ち着き → 熱意
  technicalLevel: number     // 1-5: 簡潔 → 専門的
  humorLevel: number         // 1-5: シリアス → ユーモア
  description?: string
  createdAt: string
}

// ============================================
// レベルインジケーターバー
// ============================================
function LevelBar({ value, label, colorClass }: { value: number; label: string; colorClass: string }) {
  const pct = (value / 5) * 100
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 w-14 text-right truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${colorClass}`}
        />
      </div>
      <span className="text-[10px] text-slate-400 w-6">{value}/5</span>
    </div>
  )
}

// ============================================
// Brand Voice Editor Modal
// ============================================
function BrandVoiceEditor({
  voice,
  onClose,
  onSave,
}: {
  voice: BrandVoice | null
  onClose: () => void
  onSave: (data: Omit<BrandVoice, 'id' | 'createdAt'>) => void
}) {
  const [name, setName] = useState(voice?.name || '')
  const [description, setDescription] = useState(voice?.description || '')
  const [formality, setFormality] = useState(voice?.formalityLevel ?? 3)
  const [enthusiasm, setEnthusiasm] = useState(voice?.enthusiasmLevel ?? 3)
  const [technicality, setTechnicality] = useState(voice?.technicalLevel ?? 3)
  const [humor, setHumor] = useState(voice?.humorLevel ?? 2)
  const [isDefault, setIsDefault] = useState(voice?.isDefault ?? false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        isDefault,
        formalityLevel: formality,
        enthusiasmLevel: enthusiasm,
        technicalLevel: technicality,
        humorLevel: humor,
      })
    } catch {
      // エラーは親コンポーネントで処理
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg bg-white rounded-2xl shadow-2xl z-50 overflow-y-auto max-h-[90vh]"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">
              {voice ? 'ブランドボイスを編集' : 'ブランドボイスを作成'}
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="space-y-5">
            {/* 名前 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">ボイス名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 公式フォーマル"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none"
              />
            </div>

            {/* 説明 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">説明（オプション）</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="このボイスの用途や特徴を記述..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 text-sm text-slate-700 placeholder-slate-400 transition-all outline-none resize-none h-20"
              />
            </div>

            {/* スライダー: フォーマル度 (1-5) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">フォーマル度</label>
                <span className="text-xs text-slate-400">{formality}/5</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">カジュアル</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={formality}
                  onChange={(e) => setFormality(Number(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xs text-slate-400">フォーマル</span>
              </div>
            </div>

            {/* スライダー: 熱意度 (1-5) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">熱意度</label>
                <span className="text-xs text-slate-400">{enthusiasm}/5</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">落ち着き</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={enthusiasm}
                  onChange={(e) => setEnthusiasm(Number(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xs text-slate-400">熱意</span>
              </div>
            </div>

            {/* スライダー: 専門性 (1-5) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">専門性</label>
                <span className="text-xs text-slate-400">{technicality}/5</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">簡潔</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={technicality}
                  onChange={(e) => setTechnicality(Number(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xs text-slate-400">専門的</span>
              </div>
            </div>

            {/* スライダー: ユーモア (1-5) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">ユーモア</label>
                <span className="text-xs text-slate-400">{humor}/5</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">シリアス</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={humor}
                  onChange={(e) => setHumor(Number(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xs text-slate-400">ユーモア</span>
              </div>
            </div>

            {/* デフォルト設定 */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-slate-700">デフォルトに設定</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  新規プロジェクトでこのボイスを自動選択
                </p>
              </div>
              <button
                onClick={() => setIsDefault(!isDefault)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isDefault ? 'bg-blue-500' : 'bg-slate-200'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    isDefault ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 disabled:opacity-50 transition-all"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  保存中...
                </span>
              ) : voice ? (
                '更新する'
              ) : (
                '作成する'
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ============================================
// Brand Voice Page
// ============================================
export default function BrandVoicePage() {
  const [voices, setVoices] = useState<BrandVoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingVoice, setEditingVoice] = useState<BrandVoice | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // ============================================
  // データ取得
  // ============================================
  const fetchVoices = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/tenkai/brand-voices')
      if (!res.ok) throw new Error('ブランドボイスの取得に失敗しました')
      const data = await res.json()
      setVoices(data.brandVoices || [])
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVoices()
  }, [fetchVoices])

  // ============================================
  // CRUD
  // ============================================
  const handleSave = async (data: Omit<BrandVoice, 'id' | 'createdAt'>) => {
    try {
      const method = editingVoice ? 'PUT' : 'POST'
      const url = editingVoice
        ? `/api/tenkai/brand-voices/${editingVoice.id}`
        : '/api/tenkai/brand-voices'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error('保存に失敗しました')

      setEditorOpen(false)
      setEditingVoice(null)
      fetchVoices()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tenkai/brand-voices/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      setDeleteConfirm(null)
      fetchVoices()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleEdit = (voice: BrandVoice) => {
    setEditingVoice(voice)
    setEditorOpen(true)
  }

  const handleCreate = () => {
    setEditingVoice(null)
    setEditorOpen(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen"
    >
      {/* ======== Header ======== */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-white/70 border-b border-slate-200/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">ブランドボイス設定</h1>
              <p className="text-sm text-slate-500 mt-1">
                生成コンテンツの文体とトーンをカスタマイズ
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:from-blue-600 hover:to-indigo-700 transition-all"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              新規作成
            </button>
          </div>
        </div>
      </div>

      {/* ======== Content ======== */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-2/3 mb-4" />
                <div className="space-y-2">
                  <div className="h-2 bg-slate-100 rounded w-full" />
                  <div className="h-2 bg-slate-100 rounded w-full" />
                  <div className="h-2 bg-slate-100 rounded w-full" />
                  <div className="h-2 bg-slate-100 rounded w-full" />
                </div>
                <div className="flex gap-2 mt-4">
                  <div className="h-8 bg-slate-100 rounded-lg flex-1" />
                  <div className="h-8 bg-slate-100 rounded-lg flex-1" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-red-400">error</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">エラーが発生しました</h3>
            <p className="text-sm text-slate-500 mb-6">{error}</p>
            <button
              onClick={fetchVoices}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              再試行
            </button>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && !error && voices.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-blue-400">
                record_voice_over
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">ブランドボイスがありません</h3>
            <p className="text-sm text-slate-500 mb-8 max-w-md text-center">
              ブランドボイスを作成して、生成コンテンツの文体を統一しましょう
            </p>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:from-blue-600 hover:to-indigo-700 transition-all"
            >
              <span className="material-symbols-outlined">add</span>
              最初のボイスを作成
            </button>
          </motion.div>
        )}

        {/* Voice Grid */}
        {!loading && !error && voices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {voices.map((voice, index) => (
                <motion.div
                  key={voice.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200/50 transition-all p-5"
                >
                  {/* ヘッダー */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{voice.name}</h3>
                      {voice.isDefault && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[9px] font-bold rounded-full">
                          デフォルト
                        </span>
                      )}
                    </div>
                  </div>

                  {voice.description && (
                    <p className="text-xs text-slate-400 mb-4 line-clamp-2">{voice.description}</p>
                  )}

                  {/* レベルインジケーター */}
                  <div className="space-y-2 mb-4">
                    <LevelBar value={voice.formalityLevel} label="フォーマル" colorClass="bg-blue-500" />
                    <LevelBar value={voice.enthusiasmLevel} label="熱意" colorClass="bg-amber-500" />
                    <LevelBar value={voice.technicalLevel} label="専門性" colorClass="bg-emerald-500" />
                    <LevelBar value={voice.humorLevel} label="ユーモア" colorClass="bg-purple-500" />
                  </div>

                  {/* アクション */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleEdit(voice)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      編集
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setDeleteConfirm(voice.id)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>

                      {/* 削除確認ポップオーバー */}
                      <AnimatePresence>
                        {deleteConfirm === voice.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setDeleteConfirm(null)}
                            />
                            <motion.div
                              initial={{ opacity: 0, y: 4, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 4, scale: 0.95 }}
                              className="absolute bottom-10 right-0 z-20 w-56 bg-white rounded-xl border border-slate-200 shadow-xl p-4"
                            >
                              <p className="text-sm font-semibold text-slate-900 mb-1">
                                削除しますか？
                              </p>
                              <p className="text-xs text-slate-400 mb-3">
                                この操作は取り消せません
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                >
                                  キャンセル
                                </button>
                                <button
                                  onClick={() => handleDelete(voice.id)}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                                >
                                  削除
                                </button>
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ======== Editor Modal ======== */}
      <AnimatePresence>
        {editorOpen && (
          <BrandVoiceEditor
            voice={editingVoice}
            onClose={() => {
              setEditorOpen(false)
              setEditingVoice(null)
            }}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
