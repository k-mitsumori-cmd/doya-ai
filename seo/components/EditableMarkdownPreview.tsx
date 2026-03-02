'use client'

import { useMemo, useState, useCallback } from 'react'
import { markdownToHtmlBasic } from '@seo/lib/markdown'
import { Edit3, Wand2, X, Loader2, CheckCircle2, MessageSquare } from 'lucide-react'

type Section = {
  id: string
  heading: string
  level: number
  startIndex: number
  endIndex: number
}

// Markdownからセクション情報を抽出
function extractSections(markdown: string): Section[] {
  const lines = (markdown || '').replace(/\r\n/g, '\n').split('\n')
  const sections: Section[] = []
  let currentSection: Section | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^(#{2,3})\s+(.+)$/)
    if (match) {
      // 前のセクションを閉じる
      if (currentSection) {
        currentSection.endIndex = i
        sections.push(currentSection)
      }
      // 新しいセクションを開始
      currentSection = {
        id: `section-${i}`,
        heading: match[2].trim(),
        level: match[1].length,
        startIndex: i,
        endIndex: lines.length,
      }
    }
  }

  // 最後のセクションを追加
  if (currentSection) {
    sections.push(currentSection)
  }

  return sections
}

// HTMLにセクションマーカーを追加
function addSectionMarkers(html: string, sections: Section[]): string {
  let result = html
  
  for (const section of sections) {
    const escapedHeading = section.heading
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    
    // H2/H3タグを探してdata属性を追加
    const tagName = section.level === 2 ? 'h2' : 'h3'
    const regex = new RegExp(`(<${tagName}[^>]*>)([^<]*${escapedHeading}[^<]*)(</${tagName}>)`, 'i')
    result = result.replace(regex, (match, open, content, close) => {
      // 既にdata属性がある場合はスキップ
      if (open.includes('data-section-id')) return match
      const newOpen = open.replace('>', ` data-section-id="${section.id}" data-section-heading="${section.heading}">`)
      return `${newOpen}${content}${close}`
    })
  }
  
  return result
}

type Props = {
  markdown: string
  articleId: string
  onUpdate?: () => void
}

export function EditableMarkdownPreview({ markdown, articleId, onUpdate }: Props) {
  const [selectedSection, setSelectedSection] = useState<Section | null>(null)
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const sections = useMemo(() => extractSections(markdown), [markdown])
  
  const html = useMemo(() => {
    const baseHtml = markdownToHtmlBasic(markdown || '')
    return addSectionMarkers(baseHtml, sections)
  }, [markdown, sections])

  const handleSectionClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const heading = target.closest('[data-section-id]') as HTMLElement
    if (heading) {
      const sectionId = heading.getAttribute('data-section-id')
      const sectionHeading = heading.getAttribute('data-section-heading')
      const section = sections.find(s => s.id === sectionId)
      if (section) {
        setSelectedSection(section)
        setInstruction('')
        setError(null)
        setSuccess(null)
      }
    }
  }, [sections])

  const handleEdit = async () => {
    if (!selectedSection || !instruction.trim()) return
    
    setBusy(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/seo/articles/${articleId}/vibe-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionHeading: selectedSection.heading,
          instruction: instruction.trim(),
        }),
      })

      const json = await res.json()
      
      if (!res.ok || !json.success) {
        throw new Error(json.error || '修正に失敗しました')
      }

      setSuccess(json.message || '修正しました')
      setSelectedSection(null)
      setInstruction('')
      
      // 親コンポーネントに更新を通知
      if (onUpdate) {
        setTimeout(() => onUpdate(), 500)
      }
    } catch (e: any) {
      setError(e?.message || '修正に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      {/* 使い方ヒント */}
      <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
        <div className="flex items-center gap-2 text-xs font-black text-blue-900">
          <MessageSquare className="w-4 h-4" />
          <span>見出しをクリック → 修正指示を入力 → AIが書き直します</span>
        </div>
      </div>

      {/* 成功メッセージ */}
      {success && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-sm font-black text-emerald-900">
          <CheckCircle2 className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* 編集パネル（選択時に表示） */}
      {selectedSection && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6 bg-white border-t border-gray-200 shadow-2xl shadow-black/20 animate-in slide-in-from-bottom duration-300">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">編集中のセクション</p>
                <h3 className="text-lg font-black text-gray-900">{selectedSection.heading}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSection(null)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-2">
                  どう修正しますか？（自然な言葉でOK）
                </label>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="例：もっと具体的な数字を入れて / 初心者向けに分かりやすく / 比較表を追加して / 文章を短くして"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-medium resize-none"
                  disabled={busy}
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleEdit}
                  disabled={busy || !instruction.trim()}
                  className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm shadow-lg shadow-blue-500/25 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      AIが修正中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      この指示で修正
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSection(null)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 記事本文（クリック可能） */}
      <div 
        onClick={handleSectionClick}
        className="editable-md-preview"
      >
        <div className="md-preview" dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      <style jsx global>{`
        .editable-md-preview .md-preview h2,
        .editable-md-preview .md-preview h3 {
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
        }
        .editable-md-preview .md-preview h2:hover,
        .editable-md-preview .md-preview h3:hover {
          background: linear-gradient(90deg, rgba(37, 99, 235, 0.08) 0%, transparent 100%);
          border-radius: 0.5rem;
          padding-right: 1rem;
        }
        .editable-md-preview .md-preview h2:hover::after,
        .editable-md-preview .md-preview h3:hover::after {
          content: '✏️ クリックで編集';
          position: absolute;
          right: 0.5rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.7rem;
          font-weight: 800;
          color: #2563eb;
          background: #eff6ff;
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          white-space: nowrap;
        }
        .editable-md-preview .md-preview h2[data-section-id],
        .editable-md-preview .md-preview h3[data-section-id] {
          border-left-color: #2563eb;
        }
        
        /* 既存のMarkdownPreviewスタイルを継承 */
        .editable-md-preview .md-preview {
          color: #0f172a;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP',
            'Yu Gothic', 'Meiryo', sans-serif;
          font-size: 15.5px;
          line-height: 2.05;
          letter-spacing: 0.015em;
          text-rendering: optimizeLegibility;
        }
        @media (min-width: 640px) {
          .editable-md-preview .md-preview {
            font-size: 16.5px;
          }
        }
        @media (min-width: 1024px) {
          .editable-md-preview .md-preview {
            font-size: 17.5px;
          }
        }
        .editable-md-preview .md-preview h1,
        .editable-md-preview .md-preview h2,
        .editable-md-preview .md-preview h3,
        .editable-md-preview .md-preview h4 {
          color: #0b1220;
          font-weight: 900;
          letter-spacing: -0.01em;
          scroll-margin-top: 96px;
        }
        .editable-md-preview .md-preview h1 {
          font-size: 1.6em;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
          margin: 0 0 1.25rem;
        }
        .editable-md-preview .md-preview h2 {
          font-size: 1.3em;
          margin: 1.85rem 0 0.55rem;
          padding-left: 0.75rem;
          border-left: 4px solid #2563eb;
        }
        .editable-md-preview .md-preview h3 {
          font-size: 1.12em;
          margin: 1.1rem 0 0.35rem;
        }
        .editable-md-preview .md-preview h4 {
          font-size: 1.02em;
          margin: 0.85rem 0 0.25rem;
          color: #1f2937;
        }
        .editable-md-preview .md-preview p {
          margin: 1.05rem 0;
          color: #0f172a;
        }
        .editable-md-preview .md-preview h2 + p {
          margin-top: 0.65rem;
        }
        .editable-md-preview .md-preview h3 + p {
          margin-top: 0.55rem;
        }
        .editable-md-preview .md-preview h4 + p {
          margin-top: 0.45rem;
        }
        .editable-md-preview .md-preview h2 + h3 {
          margin-top: 0.8rem;
        }
        .editable-md-preview .md-preview h3 + h4 {
          margin-top: 0.6rem;
        }
        .editable-md-preview .md-preview a {
          color: #2563eb;
          text-decoration: underline;
          text-underline-offset: 3px;
          font-weight: 800;
        }
        .editable-md-preview .md-preview a:hover {
          color: #1d4ed8;
        }
        .editable-md-preview .md-preview strong {
          color: #0b1220;
          font-weight: 900;
        }
        .editable-md-preview .md-preview em {
          color: #0f172a;
        }
        .editable-md-preview .md-preview ul,
        .editable-md-preview .md-preview ol {
          margin: 1rem 0 1.2rem;
          padding-left: 1.4rem;
          color: #0f172a;
        }
        .editable-md-preview .md-preview li {
          margin: 0.45rem 0;
        }
        .editable-md-preview .md-preview blockquote {
          margin: 1.2rem 0;
          padding: 0.9rem 1rem;
          background: #f8fafc;
          border-left: 4px solid #cbd5e1;
          color: #475569;
          border-radius: 0.75rem;
        }
        .editable-md-preview .md-preview code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          font-size: 0.95em;
          background: #fff1f2;
          color: #be123c;
          padding: 0.15rem 0.4rem;
          border-radius: 0.5rem;
          border: 1px solid #ffe4e6;
        }
        .editable-md-preview .md-preview pre {
          margin: 1.2rem 0;
          padding: 1rem 1.1rem;
          background: #0b1220;
          color: #e2e8f0;
          border-radius: 1rem;
          overflow-x: auto;
          box-shadow: 0 12px 30px rgba(2, 6, 23, 0.18);
        }
        .editable-md-preview .md-preview pre code {
          background: transparent;
          color: inherit;
          padding: 0;
          border: none;
          font-size: 0.9em;
        }
        .editable-md-preview .md-preview hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 2rem 0;
        }
        .editable-md-preview .md-preview img {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 1rem;
          box-shadow: 0 10px 24px rgba(2, 6, 23, 0.12);
          margin: 1.25rem auto;
        }
        .editable-md-preview .md-preview .table-wrapper {
          margin: 2rem 0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 1.25rem;
          background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
          box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.08),
            0 20px 40px -8px rgba(37, 99, 235, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(226, 232, 240, 0.8);
        }
        .editable-md-preview .md-preview table {
          width: 100%;
          border-collapse: collapse;
          border-spacing: 0;
          font-size: 0.92em;
          line-height: 1.65;
        }
        .editable-md-preview .md-preview thead th {
          background: linear-gradient(180deg, #1e40af 0%, #2563eb 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 0.95em;
          letter-spacing: 0.01em;
          padding: 1rem 1.1rem;
          text-align: left;
          white-space: nowrap;
          border-bottom: none;
          text-transform: none;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.22);
        }
        .editable-md-preview .md-preview thead th:first-child {
          border-top-left-radius: 1.25rem;
          padding-left: 1.5rem;
        }
        .editable-md-preview .md-preview thead th:last-child {
          border-top-right-radius: 1.25rem;
          padding-right: 1.5rem;
        }
        .editable-md-preview .md-preview tbody td {
          padding: 1rem 1.1rem;
          border-bottom: 1px solid #f1f5f9;
          color: #0f172a;
          vertical-align: top;
          background: #ffffff;
          transition: background 0.15s ease;
        }
        .editable-md-preview .md-preview tbody td:first-child {
          padding-left: 1.5rem;
          font-weight: 600;
          color: #1e293b;
        }
        .editable-md-preview .md-preview tbody td:last-child {
          padding-right: 1.5rem;
        }
        .editable-md-preview .md-preview tbody tr:nth-child(even) td {
          background: #f8fafc;
        }
        .editable-md-preview .md-preview tbody tr:hover td {
          background: #eef6ff;
        }
        .editable-md-preview .md-preview tbody tr:last-child td {
          border-bottom: none;
        }
        .editable-md-preview .md-preview tbody tr:last-child td:first-child {
          border-bottom-left-radius: 1.25rem;
        }
        .editable-md-preview .md-preview tbody tr:last-child td:last-child {
          border-bottom-right-radius: 1.25rem;
        }
        .editable-md-preview .md-preview td strong {
          color: #0f172a;
          font-weight: 700;
        }
        .editable-md-preview .md-preview td code {
          font-size: 0.85em;
          background: #e0f2fe;
          color: #0369a1;
          padding: 0.15rem 0.4rem;
          border-radius: 0.375rem;
          border: 1px solid #bae6fd;
        }
        @media (max-width: 768px) {
          .editable-md-preview .md-preview .table-wrapper {
            margin: 1.5rem -1rem;
            border-radius: 0;
            border-left: none;
            border-right: none;
            box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.08);
          }
          .editable-md-preview .md-preview thead th:first-child,
          .editable-md-preview .md-preview thead th:last-child,
          .editable-md-preview .md-preview tbody tr:last-child td:first-child,
          .editable-md-preview .md-preview tbody tr:last-child td:last-child {
            border-radius: 0;
          }
          .editable-md-preview .md-preview thead th,
          .editable-md-preview .md-preview tbody td {
            padding: 0.75rem 0.9rem;
            font-size: 0.9em;
          }
          .editable-md-preview .md-preview thead th:first-child,
          .editable-md-preview .md-preview tbody td:first-child {
            padding-left: 1rem;
          }
          .editable-md-preview .md-preview thead th:last-child,
          .editable-md-preview .md-preview tbody td:last-child {
            padding-right: 1rem;
          }
        }
      `}</style>
    </div>
  )
}

