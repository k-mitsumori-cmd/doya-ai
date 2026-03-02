'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Edit3,
  RefreshCw,
  Zap,
  Target,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  X,
} from 'lucide-react'
import { AiThinkingStrip } from '@seo/components/AiThinkingStrip'

type HeadingItem = {
  id: string
  sectionId?: string | null // 実際のSeoSectionのID（あれば）
  level: 2 | 3 | 4
  text: string
  content?: string
}

type OutlineEditorProps = {
  articleId: string
  finalMarkdown?: string
  headings: HeadingItem[]
  onUpdate?: () => void
}

type ActionType = 'edit' | 'regenerate' | 'seo' | 'cv'

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractSectionByHeading(mdRaw: string, level: 2 | 3 | 4, headingText: string) {
  const md = String(mdRaw || '').replace(/\r\n/g, '\n')
  const lines = md.split('\n')
  const headRe = new RegExp(`^#{${level}}\\s+${escapeRegExp(headingText)}\\s*$`)
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (headRe.test(lines[i])) {
      start = i
      break
    }
  }
  if (start < 0) return { start: -1, end: -1, content: '' }

  const nextRe = new RegExp(`^#{1,${level}}\\s+`)
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (nextRe.test(lines[i])) {
      end = i
      break
    }
  }
  const raw = lines.slice(start + 1, end).join('\n')
  const trimmed = raw.replace(/^\n+/, '').replace(/\n+$/, '')
  return { start, end, content: trimmed }
}

function replaceSectionByHeading(mdRaw: string, level: 2 | 3 | 4, headingText: string, newContentRaw: string) {
  const md = String(mdRaw || '').replace(/\r\n/g, '\n')
  const lines = md.split('\n')
  const headRe = new RegExp(`^#{${level}}\\s+${escapeRegExp(headingText)}\\s*$`)
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (headRe.test(lines[i])) {
      start = i
      break
    }
  }
  if (start < 0) return md
  const nextRe = new RegExp(`^#{1,${level}}\\s+`)
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (nextRe.test(lines[i])) {
      end = i
      break
    }
  }
  const newContent = String(newContentRaw || '').replace(/\r\n/g, '\n').replace(/\n+$/, '')
  const out = [
    ...lines.slice(0, start + 1),
    ...(newContent ? [''] : []),
    ...(newContent ? newContent.split('\n') : []),
    '',
    ...lines.slice(end),
  ]
  return out.join('\n').replace(/\n{4,}/g, '\n\n\n').trim() + '\n'
}

export function OutlineEditor({ articleId, finalMarkdown, headings, onUpdate }: OutlineEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeAction, setActiveAction] = useState<{ id: string; type: ActionType } | null>(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function applyByMarkdownEdit(heading: HeadingItem, type: Exclude<ActionType, 'edit'>) {
    // NOTE: セクション保存されていない見出しでも、記事Markdownを直接編集して反映できるようにする
    const actionLabel = type === 'regenerate' ? '再生成' : type === 'seo' ? 'SEO強化' : 'CV強化'
    const message = [
      `見出し「${heading.text}」の内容を${actionLabel}してください。`,
      '',
      '制約:',
      '- 見出しタイトルは変えない（配下の本文のみ改善）',
      '- できるだけ既存の構成を保ち、必要最小限の変更にする',
      '- 事実は捏造しない（元の文章に無い数字/固有名詞は増やさない）',
      '- 日本語として自然で、読みやすくする',
      type === 'seo'
        ? '- SEO: 検索意図に直結する要点、具体例、手順、注意点を補強し、関連キーワードを自然に入れる'
        : type === 'cv'
          ? '- CV: 読者の次の行動が明確になるように、具体的な判断材料・導線・チェック項目・CTAを自然に追加'
          : '- 文章の重複や冗長さを減らし、分かりやすく整理して書き直す',
    ]
      .filter(Boolean)
      .join('\n')

    const res = await fetch(`/api/seo/articles/${articleId}/chat-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, targetHeading: heading.text }),
    })
    const json = await res.json().catch(() => ({}))
    if (json?.code === 'PAID_ONLY') {
      throw new Error(json?.error || 'この操作は有料プラン限定です。')
    }
    if (!res.ok || json?.success === false) {
      throw new Error(json?.error || '処理に失敗しました')
    }
    const proposed = String(json?.proposedMarkdown || '')
    if (!proposed.trim()) throw new Error('AIの修正案が空でした')

    const saveRes = await fetch(`/api/seo/articles/${articleId}/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalMarkdown: proposed, normalize: true }),
    })
    const saveJson = await saveRes.json().catch(() => ({}))
    if (!saveRes.ok || saveJson?.success === false) {
      throw new Error(saveJson?.error || '保存に失敗しました')
    }
  }

  const handleAction = async (headingId: string, type: ActionType) => {
    const heading = headings.find((h) => h.id === headingId)
    if (!heading) return

    if (type === 'edit') {
      setActiveAction({ id: headingId, type })
      if (heading.sectionId) {
        setEditText(heading.content || '')
      } else {
        // sectionsが無いケースでも、finalMarkdown から見出し配下の本文を抜いて編集できるようにする
        const extracted = extractSectionByHeading(finalMarkdown || '', heading.level, heading.text)
        setEditText(extracted.content || '')
      }
      return
    }

    setLoading(true)
    setError(null)

    try {
      // セクションがあるなら従来通り section API を叩く。無ければ記事Markdown編集で適用する。
      if (!heading.sectionId) {
        await applyByMarkdownEdit(heading, type)
        onUpdate?.()
        return
      }

      const sectionId = heading.sectionId
      const endpoint =
        type === 'regenerate'
          ? `/api/seo/sections/${sectionId}/regenerate`
          : `/api/seo/sections/${sectionId}/${type}`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          headingPath: heading.text,
          enhanceType: type,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `処理に失敗しました`)
      }

      onUpdate?.()
    } catch (e: any) {
      setError(e?.message || '処理に失敗しました')
    } finally {
      setLoading(false)
      setActiveAction(null)
    }
  }

  const handleSaveEdit = async () => {
    if (!activeAction || activeAction.type !== 'edit') return
    const heading = headings.find((h) => h.id === activeAction.id)
    if (!heading) return

    setLoading(true)
    setError(null)

    try {
      // セクションがあれば section を更新、無ければ markdown を直接更新して保存する
      const res = heading.sectionId
        ? await fetch(`/api/seo/sections/${heading.sectionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: editText }),
          })
        : await fetch(`/api/seo/articles/${articleId}/content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              finalMarkdown: replaceSectionByHeading(finalMarkdown || '', heading.level, heading.text, editText),
              normalize: true,
            }),
          })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || '保存に失敗しました')
      }

      onUpdate?.()
      setActiveAction(null)
    } catch (e: any) {
      setError(e?.message || '保存に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">
        見出し構成
      </p>

      <AiThinkingStrip
        show={loading}
        compact
        title="AIが見出し単位で最適化中…"
        subtitle="SEO/LLMOの観点で、見出しごとの改善（再生成・強化・CV最適化）を実行しています"
        tags={['SEO', 'LLMO', '構造化']}
      />

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs font-bold mb-4">
          {error}
        </div>
      )}

      {headings.map((heading) => {
        const isExpanded = expandedId === heading.id
        const isEditing = activeAction?.id === heading.id && activeAction?.type === 'edit'

        return (
          <motion.div
            key={heading.id}
            layout
            className={`rounded-2xl border transition-all ${
              isExpanded ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-white'
            }`}
            style={{ marginLeft: heading.level === 3 ? 16 : heading.level === 4 ? 32 : 0 }}
          >
            {/* ヘッダー */}
            <div
              className="p-4 flex items-center gap-3 cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : heading.id)}
            >
              <span
                className={`flex-shrink-0 w-8 h-6 rounded text-[10px] font-black flex items-center justify-center ${
                  heading.level === 2
                    ? 'bg-blue-100 text-blue-600'
                    : heading.level === 3
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                H{heading.level}
              </span>

              <span className="flex-1 text-sm font-bold text-gray-800 truncate">
                {heading.text}
              </span>

              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>

            {/* 展開時のアクション */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-4 pb-4 overflow-hidden"
                >
                  {/* 編集モード */}
                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={6}
                        className="w-full p-4 rounded-xl bg-white border-2 border-blue-200 text-sm font-medium text-gray-800 focus:outline-none focus:border-blue-500 transition-all resize-none"
                        placeholder="この見出しの本文を編集..."
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={loading}
                          className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          保存
                        </button>
                        <button
                          onClick={() => setActiveAction(null)}
                          className="h-10 px-4 rounded-xl bg-gray-100 text-gray-600 text-xs font-black hover:bg-gray-200 transition-colors flex items-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => handleAction(heading.id, 'edit')}
                        disabled={loading}
                        className="h-10 rounded-xl bg-gray-100 text-gray-700 text-xs font-black hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        修正
                      </button>
                      <button
                        onClick={() => handleAction(heading.id, 'regenerate')}
                        disabled={loading}
                        className="h-10 rounded-xl bg-purple-50 text-purple-700 text-xs font-black hover:bg-purple-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {loading && activeAction?.id === heading.id && activeAction?.type === 'regenerate' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        再生成
                      </button>
                      <button
                        onClick={() => handleAction(heading.id, 'seo')}
                        disabled={loading}
                        className="h-10 rounded-xl bg-blue-50 text-blue-700 text-xs font-black hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {loading && activeAction?.id === heading.id && activeAction?.type === 'seo' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                        SEO強化
                      </button>
                      <button
                        onClick={() => handleAction(heading.id, 'cv')}
                        disabled={loading}
                        className="h-10 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {loading && activeAction?.id === heading.id && activeAction?.type === 'cv' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Target className="w-3.5 h-3.5" />
                        )}
                        CV強化
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}

      {headings.length === 0 && (
        <div className="p-8 text-center rounded-2xl bg-gray-50 border border-gray-100">
          <p className="text-gray-400 font-bold text-sm">見出しがありません</p>
        </div>
      )}
    </div>
  )
}

