'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Edit3,
  Trash2,
  ListOrdered,
  ChevronRight,
  Users,
  RefreshCw,
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface Step {
  id: string
  label: string
  dayOffset: number
}

interface Sequence {
  id: string
  name: string
  status: 'draft' | 'active' | 'paused'
  segmentName: string | null
  steps: Step[]
  createdAt: string
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-white/10', text: 'text-white/50', label: '下書き' },
  active: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '配信中' },
  paused: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '一時停止' },
}

export default function SequenceListPage() {
  const router = useRouter()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchSequences = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/drip/sequences', {
        credentials: 'include',
      })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error('取得に失敗しました')
      }
      const data = await res.json()
      setSequences(data.sequences ?? data ?? [])
    } catch (err) {
      console.error('Sequences fetch error:', err)
      toast.error('シーケンスの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchSequences()
  }, [fetchSequences])

  const handleToggle = async (seq: Sequence) => {
    const newStatus = seq.status === 'active' ? 'paused' : 'active'
    setTogglingId(seq.id)
    try {
      const res = await fetch(`/api/admin/drip/sequences/${seq.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      setSequences((prev) =>
        prev.map((s) => (s.id === seq.id ? { ...s, status: newStatus } : s))
      )
      toast.success(
        newStatus === 'active' ? 'シーケンスを有効にしました' : 'シーケンスを一時停止しました'
      )
    } catch {
      toast.error('ステータスの更新に失敗しました')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このシーケンスを削除しますか？')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/drip/sequences/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      setSequences((prev) => prev.filter((s) => s.id !== id))
      toast.success('シーケンスを削除しました')
    } catch {
      toast.error('削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListOrdered className="w-6 h-6 text-violet-400" />
            シーケンス管理
          </h1>
          <p className="text-white/50 text-sm mt-1">ドリップメールシーケンスの作成・管理</p>
        </div>
        <button
          onClick={() => router.push('/admin/drip/sequences/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl font-medium text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          新規シーケンス作成
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : sequences.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <ListOrdered className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 mb-4">シーケンスがまだありません</p>
          <button
            onClick={() => router.push('/admin/drip/sequences/new')}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm transition-colors"
          >
            最初のシーケンスを作成
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {sequences.map((seq, i) => {
              const style = STATUS_STYLES[seq.status] ?? STATUS_STYLES.draft
              return (
                <motion.div
                  key={seq.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 hover:border-violet-500/30 transition-colors"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{seq.name}</h3>
                      {seq.segmentName && (
                        <div className="flex items-center gap-1 mt-1">
                          <Users className="w-3 h-3 text-white/30" />
                          <span className="text-xs text-white/30">{seq.segmentName}</span>
                        </div>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>

                  {/* Step Pills */}
                  <div className="flex flex-wrap items-center gap-1 mb-4">
                    {seq.steps.map((step, si) => (
                      <span key={step.id} className="flex items-center gap-1">
                        {si > 0 && (
                          <ChevronRight className="w-3 h-3 text-white/20 flex-shrink-0" />
                        )}
                        <span className="text-xs bg-white/5 text-white/50 px-2 py-0.5 rounded-full whitespace-nowrap">
                          D{step.dayOffset} {step.label}
                        </span>
                      </span>
                    ))}
                    {seq.steps.length === 0 && (
                      <span className="text-xs text-white/20">ステップなし</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(seq)}
                      disabled={togglingId === seq.id || seq.status === 'draft'}
                      className="relative w-11 h-6 rounded-full transition-colors disabled:opacity-30"
                      style={{
                        backgroundColor:
                          seq.status === 'active'
                            ? 'rgba(16,185,129,0.4)'
                            : 'rgba(255,255,255,0.1)',
                      }}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          seq.status === 'active' ? 'translate-x-[22px]' : 'translate-x-0.5'
                        }`}
                      />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/admin/drip/sequences/${seq.id}`)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        title="編集"
                      >
                        <Edit3 className="w-4 h-4 text-white/50" />
                      </button>
                      <button
                        onClick={() => handleDelete(seq.id)}
                        disabled={deletingId === seq.id}
                        className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 transition-colors"
                        title="削除"
                      >
                        {deletingId === seq.id ? (
                          <RefreshCw className="w-4 h-4 text-white/30 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-white/50 hover:text-rose-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
