'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'

// ============================================
// 9つのプラットフォーム定義
// ============================================
const PLATFORMS = [
  { key: 'note', icon: 'edit_note', label: 'note' },
  { key: 'blog', icon: 'article', label: 'Blog' },
  { key: 'x', icon: 'tag', label: 'X' },
  { key: 'instagram', icon: 'photo_camera', label: 'Instagram' },
  { key: 'line', icon: 'chat', label: 'LINE' },
  { key: 'facebook', icon: 'thumb_up', label: 'Facebook' },
  { key: 'linkedin', icon: 'work', label: 'LinkedIn' },
  { key: 'newsletter', icon: 'mail', label: 'Newsletter' },
  { key: 'press_release', icon: 'newspaper', label: 'Press' },
] as const

type PlatformKey = (typeof PLATFORMS)[number]['key']

// ============================================
// プラットフォームステータス
// ============================================
export interface PlatformStatus {
  platform: PlatformKey
  status: 'completed' | 'generating' | 'pending' | 'failed'
}

// ============================================
// Props
// ============================================
export interface ProjectCardProps {
  id: string
  title: string
  inputType: string       // "url" | "text" | "youtube" | "video"
  date: string            // ISO string
  status: string          // "draft" | "analyzing" | "ready" | "generating" | "completed"
  score?: number          // 0-100 (qualityScore の平均など)
  platformStatuses: PlatformStatus[]
  outputCount: number
  onDelete?: (id: string) => void
}

// ============================================
// inputType別アイコン
// ============================================
function getInputIcon(inputType: string): string {
  switch (inputType) {
    case 'url':
      return 'link'
    case 'youtube':
      return 'play_circle'
    case 'video':
      return 'videocam'
    case 'text':
    default:
      return 'description'
  }
}

// ============================================
// ステータスバッジ
// ============================================
function getStatusStyle(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'generating':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'analyzing':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'ready':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'draft':
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'completed':
      return '完了'
    case 'generating':
      return '生成中'
    case 'analyzing':
      return '分析中'
    case 'ready':
      return '準備完了'
    case 'draft':
    default:
      return '下書き'
  }
}

// ============================================
// ProjectCard コンポーネント
// ============================================
export default function ProjectCard({
  id,
  title,
  inputType,
  date,
  status,
  score,
  platformStatuses,
  outputCount,
  onDelete,
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // PF ステータスマップ
  const statusMap = new Map<string, PlatformStatus['status']>()
  platformStatuses.forEach((ps) => statusMap.set(ps.platform, ps.status))

  const completedCount = platformStatuses.filter((ps) => ps.status === 'completed').length
  const generatingCount = platformStatuses.filter((ps) => ps.status === 'generating').length

  // リパーパシングサマリ
  const repurposeLabel =
    generatingCount > 0
      ? `${generatingCount}/9 Processing`
      : `${completedCount}/9 Ready`

  // 日付フォーマット
  const formattedDate = new Date(date).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-500/50 transition-all duration-300"
    >
      {/* ======== 上部: アイコン + タイトル + スコア + 日付 ======== */}
      <div className="p-5 pb-3">
        <div className="flex items-start gap-3">
          {/* inputType アイコン */}
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-500 text-xl">
              {getInputIcon(inputType)}
            </span>
          </div>

          {/* タイトル + 日付 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate leading-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{formattedDate}</p>
          </div>

          {/* スコア */}
          {score !== undefined && score > 0 && (
            <div className="flex-shrink-0 text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                SCORE
              </p>
              <p
                className={`text-sm font-extrabold ${
                  score >= 80
                    ? 'text-emerald-600'
                    : score >= 60
                    ? 'text-blue-600'
                    : 'text-amber-600'
                }`}
              >
                {score}/100
              </p>
            </div>
          )}
        </div>

        {/* ステータスバッジ */}
        <div className="flex items-center gap-2 mt-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusStyle(
              status
            )}`}
          >
            {getStatusLabel(status)}
          </span>
          {outputCount > 0 && (
            <span className="text-[10px] text-slate-400">
              {outputCount} 件の成果物
            </span>
          )}
        </div>
      </div>

      {/* ======== 中央: REPURPOSING STATUS ======== */}
      <div className="px-5 py-3 border-t border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Repurposing Status
          </p>
          <span
            className={`text-xs font-bold ${
              generatingCount > 0 ? 'text-blue-600' : completedCount === 9 ? 'text-emerald-600' : 'text-slate-500'
            }`}
          >
            {repurposeLabel}
          </span>
        </div>

        {/* ======== 9つの PF アイコン ======== */}
        <div className="flex items-center justify-between gap-1">
          {PLATFORMS.map((pf) => {
            const pfStatus = statusMap.get(pf.key) || 'pending'
            return (
              <div
                key={pf.key}
                className="group/pf relative flex flex-col items-center"
                title={`${pf.label}: ${pfStatus}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    pfStatus === 'completed'
                      ? 'bg-emerald-100 text-emerald-600'
                      : pfStatus === 'generating'
                      ? 'bg-blue-100 text-blue-600 animate-pulse'
                      : pfStatus === 'failed'
                      ? 'bg-red-100 text-red-500'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {pf.icon}
                  </span>
                </div>
                {/* ツールチップ */}
                <span className="absolute -bottom-5 text-[8px] text-slate-400 opacity-0 group-hover/pf:opacity-100 transition-opacity whitespace-nowrap">
                  {pf.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ======== 最下部: ボタン + 三点メニュー ======== */}
      <div className="px-5 pb-5 pt-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/tenkai/projects/${id}`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:from-blue-600 hover:to-indigo-700 transition-all"
          >
            <span className="material-symbols-outlined text-base">
              visibility
            </span>
            成果物を確認
          </Link>

          {/* 三点メニュー */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.preventDefault()
                setMenuOpen(!menuOpen)
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">
                more_vert
              </span>
            </button>

            {/* ドロップダウンメニュー */}
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 bottom-12 z-20 w-44 bg-white rounded-xl border border-slate-200 shadow-xl py-1">
                  <Link
                    href={`/tenkai/projects/${id}`}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="material-symbols-outlined text-base text-slate-400">
                      open_in_new
                    </span>
                    詳細を開く
                  </Link>
                  <button
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full text-left"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/tenkai/projects/${id}`).catch(() => {/* ignore */})
                      setMenuOpen(false)
                    }}
                  >
                    <span className="material-symbols-outlined text-base text-slate-400">
                      content_copy
                    </span>
                    リンクをコピー
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                    onClick={() => {
                      setMenuOpen(false)
                      setDeleteConfirm(true)
                    }}
                  >
                    <span className="material-symbols-outlined text-base">
                      delete
                    </span>
                    削除
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 削除確認ダイアログ */}
          {deleteConfirm && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setDeleteConfirm(false)}
              />
              <div className="absolute right-0 bottom-12 z-40 w-56 bg-white rounded-xl border border-slate-200 shadow-xl p-4">
                <p className="text-sm font-semibold text-slate-900 mb-1">
                  削除しますか？
                </p>
                <p className="text-xs text-slate-400 mb-3">
                  この操作は取り消せません
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => {
                      setDeleteConfirm(false)
                      onDelete?.(id)
                    }}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
