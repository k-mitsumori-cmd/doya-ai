'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pin,
  Star,
  Clock,
  Search,
  Command,
  X,
  FileText,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ピン留めテンプレートの管理
const PINNED_KEY = 'doya_pinned_templates'
const RECENT_KEY = 'doya_recent_templates'

interface TemplateInfo {
  id: string
  name: string
  categoryId: string
  icon?: string
}

// ピン留め管理のフック
export function usePinnedTemplates() {
  const [pinned, setPinned] = useState<string[]>([])

  useEffect(() => {
    const stored = localStorage.getItem(PINNED_KEY)
    if (stored) {
      setPinned(JSON.parse(stored))
    }
  }, [])

  const togglePin = (templateId: string) => {
    setPinned((prev) => {
      const newPinned = prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
      localStorage.setItem(PINNED_KEY, JSON.stringify(newPinned))
      return newPinned
    })
  }

  const isPinned = (templateId: string) => pinned.includes(templateId)

  return { pinned, togglePin, isPinned }
}

// 最近使ったテンプレートの管理
export function useRecentTemplates() {
  const [recent, setRecent] = useState<TemplateInfo[]>([])

  useEffect(() => {
    const stored = localStorage.getItem(RECENT_KEY)
    if (stored) {
      setRecent(JSON.parse(stored))
    }
  }, [])

  const addRecent = (template: TemplateInfo) => {
    setRecent((prev) => {
      const filtered = prev.filter((t) => t.id !== template.id)
      const newRecent = [template, ...filtered].slice(0, 5)
      localStorage.setItem(RECENT_KEY, JSON.stringify(newRecent))
      return newRecent
    })
  }

  return { recent, addRecent }
}

// ピン留めボタンコンポーネント
export function PinButton({
  templateId,
  size = 'md',
}: {
  templateId: string
  size?: 'sm' | 'md'
}) {
  const { isPinned, togglePin } = usePinnedTemplates()
  const pinned = isPinned(templateId)

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        togglePin(templateId)
      }}
      className={`p-1.5 rounded-lg transition-colors ${
        pinned
          ? 'bg-amber-100 text-amber-600'
          : 'hover:bg-gray-100 text-gray-400'
      }`}
      title={pinned ? 'ピン留め解除' : 'ピン留め'}
    >
      <Pin className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${pinned ? 'fill-current' : ''}`} />
    </button>
  )
}

// クイック検索モーダル（Cmd+K）
export function QuickSearchModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const { recent } = useRecentTemplates()
  const { pinned } = usePinnedTemplates()

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K または Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      // Escape
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelect = (href: string) => {
    setIsOpen(false)
    setQuery('')
    router.push(href)
  }

  // サンプルテンプレート（実際はtemplates.tsから取得）
  const sampleTemplates = [
    { id: 'business-email', name: 'ビジネスメール作成', categoryId: 'business', icon: '✉️' },
    { id: 'blog-article', name: 'ブログ記事生成', categoryId: 'content', icon: '📝' },
    { id: 'instagram-caption', name: 'Instagram投稿文', categoryId: 'sns', icon: '📸' },
    { id: 'catchcopy', name: 'キャッチコピー作成', categoryId: 'creative', icon: '✨' },
    { id: 'meeting-minutes', name: '議事録作成', categoryId: 'business', icon: '📋' },
    { id: 'persona-creation', name: 'ペルソナ作成', categoryId: 'persona', icon: '👥' },
    { id: 'google-ad-title', name: 'Google広告タイトル', categoryId: 'marketing', icon: '📢' },
    { id: 'youtube-script', name: 'YouTube台本作成', categoryId: 'video', icon: '🎬' },
  ]

  const filteredTemplates = query
    ? sampleTemplates.filter((t) =>
        t.name.toLowerCase().includes(query.toLowerCase())
      )
    : sampleTemplates

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 検索入力 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="テンプレートを検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 text-lg outline-none placeholder-gray-400"
              autoFocus
            />
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </div>

          {/* 結果 */}
          <div className="max-h-80 overflow-y-auto p-2">
            {/* ピン留め */}
            {pinned.length > 0 && !query && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-400 px-2 py-1 flex items-center gap-1">
                  <Pin className="w-3 h-3" />
                  ピン留め
                </p>
                {sampleTemplates
                  .filter((t) => pinned.includes(t.id))
                  .map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelect(`/dashboard/text/${template.id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                    >
                      <span className="text-xl">{template.icon}</span>
                      <span className="text-gray-900">{template.name}</span>
                      <ArrowRight className="w-4 h-4 text-gray-300 ml-auto" />
                    </button>
                  ))}
              </div>
            )}

            {/* 最近使った */}
            {recent.length > 0 && !query && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-400 px-2 py-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  最近使った
                </p>
                {recent.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(`/dashboard/text/${template.id}`)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="text-xl">{template.icon || '📄'}</span>
                    <span className="text-gray-900">{template.name}</span>
                    <ArrowRight className="w-4 h-4 text-gray-300 ml-auto" />
                  </button>
                ))}
              </div>
            )}

            {/* 検索結果 / 全テンプレート */}
            <div>
              {query && (
                <p className="text-xs font-medium text-gray-400 px-2 py-1">
                  検索結果
                </p>
              )}
              {!query && !pinned.length && !recent.length && (
                <p className="text-xs font-medium text-gray-400 px-2 py-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  人気のテンプレート
                </p>
              )}
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(`/dashboard/text/${template.id}`)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-xl">{template.icon}</span>
                  <span className="text-gray-900">{template.name}</span>
                  <ArrowRight className="w-4 h-4 text-gray-300 ml-auto" />
                </button>
              ))}
              {query && filteredTemplates.length === 0 && (
                <p className="text-center py-8 text-gray-400">
                  「{query}」に一致するテンプレートはありません
                </p>
              )}
            </div>
          </div>

          {/* フッター */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">↑↓</kbd>
                移動
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">Enter</kbd>
                選択
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded">Esc</kbd>
              閉じる
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// キーボードショートカットヘルプ
export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  const shortcuts = [
    { keys: ['⌘', 'K'], description: 'クイック検索を開く' },
    { keys: ['⌘', 'Enter'], description: '生成を実行' },
    { keys: ['⌘', 'C'], description: '結果をコピー' },
    { keys: ['⌘', 'S'], description: 'お気に入りに保存' },
    { keys: ['Esc'], description: 'モーダルを閉じる' },
  ]

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
      >
        <Command className="w-3 h-3" />
        ショートカット
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">キーボードショートカット</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-600">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <kbd
                        key={i}
                        className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-sm font-mono"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  )
}


