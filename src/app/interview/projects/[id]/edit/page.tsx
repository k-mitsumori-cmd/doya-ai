'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Script from 'next/script'

type RightPanel = 'preview' | 'proofread' | 'titles' | 'factcheck' | 'sns' | 'translate' | 'revise'

interface RevisionHistoryItem {
  instruction: string
  timestamp: Date
  originalLength: number
  revisedLength: number
}


interface Suggestion {
  type: string
  original: string
  suggested: string
  reason: string
  severity: string
}

interface ProofreadResult {
  score: number
  summary: string
  suggestions: Suggestion[]
  checks: Record<string, boolean>
}

interface TitleSuggestion {
  title: string
  type: string
  reason: string
}

interface FactClaim {
  text: string
  category: string
  status: string
  detail: string
  severity: string
}

interface FactCheckResult {
  reliability: number
  summary: string
  claims: FactClaim[]
  warnings: string[]
}

interface SnsPost {
  platform: string
  content: string
  hashtags: string[]
  characterCount: number
  tip: string
}

interface TranslationResult {
  language: string
  languageName: string
  title: string
  content: string
  seoTitle: string
  seoDescription: string
  wordCount: number
}

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-600 border-blue-200',
  info: 'bg-slate-100 text-slate-500 border-slate-200',
}

const SEVERITY_LABELS: Record<string, string> = {
  high: '必須',
  medium: '推奨',
  low: '任意',
  info: '情報',
}

const TYPE_LABELS: Record<string, string> = {
  typo: '誤字脱字',
  inconsistency: '表記揺れ',
  grammar: '文法',
  style: '文体',
  fact: '事実確認',
  keyword: 'キーワード型',
  emotional: '感情型',
  question: '疑問型',
  number: '数字型',
  quote: '引用型',
}

const CLAIM_STATUS: Record<string, { label: string; color: string }> = {
  verified: { label: '確認済', color: 'bg-green-100 text-green-600' },
  suspicious: { label: '要確認', color: 'bg-yellow-100 text-yellow-700' },
  error: { label: '誤り', color: 'bg-red-100 text-red-600' },
  unverifiable: { label: '検証不能', color: 'bg-slate-100 text-slate-500' },
}

const CLAIM_CATEGORY: Record<string, string> = {
  number: '数値',
  name: '固有名詞',
  date: '日付',
  claim: '主張',
  quote: '引用',
  general: '一般',
}

const TITLE_PLATFORM_OPTIONS = [
  { value: 'seo', label: 'SEO' },
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'note', label: 'note' },
  { value: 'news_portal', label: 'ニュース' },
]

const SNS_PLATFORM_OPTIONS = [
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'twitter_thread', label: 'X スレッド' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'note', label: 'note' },
]

// プラットフォーム別ブランドカラー
const PLATFORM_COLORS: Record<string, { active: string; text: string; icon?: string }> = {
  seo: { active: 'bg-blue-600 text-white', text: 'text-blue-600' },
  twitter: { active: 'bg-black text-white', text: 'text-black', icon: '𝕏' },
  twitter_thread: { active: 'bg-black text-white', text: 'text-black', icon: '𝕏' },
  facebook: { active: 'bg-[#1877F2] text-white', text: 'text-[#1877F2]' },
  note: { active: 'bg-[#41C9B4] text-white', text: 'text-[#41C9B4]' },
  news_portal: { active: 'bg-red-600 text-white', text: 'text-red-600' },
  linkedin: { active: 'bg-[#0A66C2] text-white', text: 'text-[#0A66C2]' },
  instagram: { active: 'bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white', text: 'text-[#E1306C]' },
}

const TRANSLATE_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '简体中文' },
  { value: 'zh-tw', label: '繁體中文' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'th', label: 'ภาษาไทย' },
]

const panelVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15 } }
}

// ========================================
// Markdown ↔ HTML 変換ヘルパー
// ========================================
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inlineToHtml(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}

function stripCodeFences(md: string): string {
  // ```markdown ... ``` や ```json ... ``` のようなコードフェンスラッパーを除去
  let s = md.trim()
  const fenceStart = /^```\w*\s*\n/
  if (fenceStart.test(s) && s.endsWith('```')) {
    s = s.replace(fenceStart, '').replace(/\n?```$/, '')
  }
  return s
}

function markdownToHtml(md: string): string {
  const cleaned = stripCodeFences(md)
  const lines = cleaned.split('\n')
  const out: string[] = []
  let inCodeBlock = false
  let codeLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // コードブロック内
    if (inCodeBlock) {
      if (line.startsWith('```')) {
        out.push(`<pre><code>${codeLines.map(escapeHtml).join('\n')}</code></pre>`)
        codeLines = []
        inCodeBlock = false
      } else {
        codeLines.push(line)
      }
      continue
    }

    // コードブロック開始
    if (line.startsWith('```')) {
      inCodeBlock = true
      codeLines = []
      continue
    }

    if (line.startsWith('#### ')) { out.push(`<h4>${inlineToHtml(line.slice(5))}</h4>`); continue }
    if (line.startsWith('### ')) { out.push(`<h3>${inlineToHtml(line.slice(4))}</h3>`); continue }
    if (line.startsWith('## ')) { out.push(`<h2>${inlineToHtml(line.slice(3))}</h2>`); continue }
    if (line.startsWith('# ')) { out.push(`<h1>${inlineToHtml(line.slice(2))}</h1>`); continue }
    if (line.startsWith('> ')) { out.push(`<blockquote>${inlineToHtml(line.slice(2))}</blockquote>`); continue }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      // 連続リストアイテムをまとめる
      const items: string[] = [inlineToHtml(line.slice(2))]
      while (i + 1 < lines.length && (lines[i + 1].startsWith('- ') || lines[i + 1].startsWith('* '))) {
        i++
        items.push(inlineToHtml(lines[i].slice(2)))
      }
      out.push(`<ul>${items.map(t => `<li>${t}</li>`).join('')}</ul>`)
      continue
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [inlineToHtml(line.replace(/^\d+\.\s/, ''))]
      while (i + 1 < lines.length && /^\d+\.\s/.test(lines[i + 1])) {
        i++
        items.push(inlineToHtml(lines[i].replace(/^\d+\.\s/, '')))
      }
      out.push(`<ol>${items.map(t => `<li>${t}</li>`).join('')}</ol>`)
      continue
    }
    if (line.startsWith('---') || line.startsWith('***')) { out.push('<hr>'); continue }
    if (line.trim() === '') { out.push('<p><br></p>'); continue }
    out.push(`<p>${inlineToHtml(line)}</p>`)
  }

  // 閉じ忘れたコードブロック
  if (inCodeBlock && codeLines.length) {
    out.push(`<pre><code>${codeLines.map(escapeHtml).join('\n')}</code></pre>`)
  }

  return out.join('\n')
}

// プレビューのCSS
const RICH_EDITOR_STYLES = `
.rich-editor { min-height: 300px; }
.rich-editor h1 { font-size: 1.5rem; font-weight: 900; color: #0f172a; margin: 2.5rem 0 1.25rem; line-height: 1.25; }
.rich-editor h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 2.5rem 0 1rem; line-height: 1.375; padding-bottom: 0.5rem; border-bottom: 1px solid #f1f5f9; }
.rich-editor h3 { font-size: 1.125rem; font-weight: 700; color: #1e293b; margin: 2rem 0 0.75rem; line-height: 1.375; }
.rich-editor h4 { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 1.5rem 0 0.5rem; line-height: 1.375; }
.rich-editor p { font-size: 0.9375rem; color: #334155; line-height: 1.9; margin-bottom: 0.75rem; }
.rich-editor blockquote { border-left: 4px solid #3b82f6; padding: 0.75rem 1rem 0.75rem 1.25rem; margin: 1rem 0; background: rgba(59,130,246,0.04); border-radius: 0 0.5rem 0.5rem 0; color: #475569; font-style: italic; }
.rich-editor ul, .rich-editor ol { margin: 0.5rem 0; padding-left: 1.5rem; }
.rich-editor li { font-size: 0.9375rem; color: #334155; line-height: 1.8; margin-bottom: 0.25rem; }
.rich-editor ul li { list-style-type: disc; }
.rich-editor ol li { list-style-type: decimal; }
.rich-editor hr { margin: 2rem 0; border-color: #e2e8f0; }
.rich-editor strong { font-weight: 700; color: #0f172a; }
.rich-editor em { font-style: italic; }
.rich-editor code { background: #f1f5f9; color: #2563eb; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.8125rem; font-family: ui-monospace, monospace; }
.rich-editor a { color: #2563eb; text-decoration: underline; }
.rich-editor a:hover { color: #1d4ed8; }
.rich-editor pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0; overflow-x: auto; }
.rich-editor pre code { background: none; color: #334155; padding: 0; font-size: 0.8125rem; font-family: ui-monospace, monospace; }
`

export default function EditPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectId = params.id as string
  const initialDraftId = searchParams.get('draftId')

  const [draftId, setDraftId] = useState<string | null>(initialDraftId)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [projectInfo, setProjectInfo] = useState<any>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  // 左側: エディタ (リッチ) / Markdown 切替
  const [leftMode, setLeftMode] = useState<'edit' | 'preview'>('edit')

  // 右パネル
  const [rightPanel, setRightPanel] = useState<RightPanel>('proofread')

  // 校正
  const [proofLoading, setProofLoading] = useState(false)
  const [proofResult, setProofResult] = useState<ProofreadResult | null>(null)
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<number>>(new Set())

  // タイトル提案
  const [titlePlatform, setTitlePlatform] = useState('seo')
  const [titlesLoading, setTitlesLoading] = useState(false)
  const [suggestedTitles, setSuggestedTitles] = useState<TitleSuggestion[]>([])

  // ファクトチェック
  const [factLoading, setFactLoading] = useState(false)
  const [factResult, setFactResult] = useState<FactCheckResult | null>(null)

  // SNS投稿
  const [snsSelectedPlatforms, setSnsSelectedPlatforms] = useState<string[]>(['twitter'])
  const [snsTone, setSnsTone] = useState('professional')
  const [snsArticleUrl, setSnsArticleUrl] = useState('')
  const [snsLoading, setSnsLoading] = useState(false)
  const [snsPosts, setSnsPosts] = useState<SnsPost[]>([])

  // 翻訳
  const [translateLang, setTranslateLang] = useState('en')
  const [translateLoading, setTranslateLoading] = useState(false)
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null)

  // AI修正
  const [reviseInstruction, setReviseInstruction] = useState('')
  const [reviseLoading, setReviseLoading] = useState(false)
  const [revisedContent, setRevisedContent] = useState<string | null>(null)
  const [reviseError, setReviseError] = useState<string | null>(null)
  const [revisionHistory, setRevisionHistory] = useState<RevisionHistoryItem[]>([])
  const [contentBeforeRevision, setContentBeforeRevision] = useState<string | null>(null)

  // バナー画像
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [bannerGenerating, setBannerGenerating] = useState(false)
  const bannerAutoTriedRef = useRef(false)

  // エクスポートドロップダウン外クリック閉じ
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false)
      }
    }
    if (exportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [exportDropdownOpen])

  // ドラフト取得
  const fetchDraft = useCallback(async () => {
    if (!draftId) {
      try {
        const res = await fetch(`/api/interview/projects/${projectId}`)
        const data = await res.json()
        if (data.success) {
          setProjectInfo(data.project)
          if (data.project?.thumbnailUrl) {
            setBannerUrl(data.project.thumbnailUrl)
          }
          const latestDraft = data.project.drafts?.[0]
          if (latestDraft) {
            setDraftId(latestDraft.id)
          } else {
            setLoading(false)
            return
          }
        }
      } catch {
        setLoading(false)
        return
      }
    }
  }, [draftId, projectId])

  useEffect(() => {
    if (!draftId) {
      fetchDraft()
      return
    }

    fetch(`/api/interview/articles/${draftId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setContent(data.draft.content)
          setTitle(data.draft.title || '')
          setWordCount(data.draft.wordCount || data.draft.content.length)
          setProjectInfo(data.draft.project)
          if (data.draft.project?.thumbnailUrl) {
            setBannerUrl(data.draft.project.thumbnailUrl)
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [draftId, fetchDraft])

  const autoSave = useCallback(async (newContent: string) => {
    if (!draftId) return
    setSaving(true)
    try {
      await fetch(`/api/interview/articles/${draftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent, title }),
      })
      setLastSaved(new Date())
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }, [draftId, title])

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    setWordCount(newContent.length)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => autoSave(newContent), 2000)
  }

  const handleSave = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    await autoSave(content)
  }

  // バナー画像生成 (Nano Banana Pro)
  const generateBanner = useCallback(async () => {
    if (bannerGenerating) return
    setBannerGenerating(true)
    try {
      const res = await fetch(`/api/interview/projects/${projectId}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleContent: content.slice(0, 2000) }),
      })
      const data = await res.json()
      if (data.success && data.thumbnailUrl) {
        setBannerUrl(data.thumbnailUrl)
      }
    } catch (e) {
      console.error('[banner] generation failed:', e)
    } finally {
      setBannerGenerating(false)
    }
  }, [projectId, content, bannerGenerating])

  // バナー自動生成: 記事読み込み完了時にバナーが未生成なら自動で作成
  useEffect(() => {
    if (!loading && content.trim().length > 100 && !bannerUrl && !bannerGenerating && !bannerAutoTriedRef.current) {
      bannerAutoTriedRef.current = true
      generateBanner()
    }
  }, [loading, content, bannerUrl, bannerGenerating, generateBanner])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    alert('記事をクリップボードにコピーしました')
  }

  const handleExportMd = () => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'article'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportTxt = () => {
    const plainText = content
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^>\s+/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .replace(/---/g, '')
      .replace(/\n{3,}/g, '\n\n')
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'article'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 校正
  const handleProofread = async () => {
    if (!draftId) return
    setProofLoading(true)
    setProofResult(null)
    setAppliedSuggestions(new Set())
    setRightPanel('proofread')
    try {
      await handleSave()
      const res = await fetch(`/api/interview/articles/${draftId}/proofread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) {
        setProofResult({ score: data.score, summary: data.summary, suggestions: data.suggestions || [], checks: data.checks || {} })
      } else { alert(data.error || '校正に失敗しました') }
    } catch { alert('校正の実行中にエラーが発生しました') }
    finally { setProofLoading(false) }
  }

  const applySuggestion = (idx: number, suggestion: Suggestion) => {
    if (!suggestion.original || !suggestion.suggested) return
    const newContent = content.replace(suggestion.original, suggestion.suggested)
    const newApplied = new Set(appliedSuggestions).add(idx)
    if (newContent !== content) {
      // 置換が実際に行われた
      handleContentChange(newContent)
    }
    // テキストが見つからなくても適用済みとしてマーク（既に修正済みの可能性）
    setAppliedSuggestions(newApplied)
    // スコアを修正数に応じて上昇
    if (proofResult) {
      const totalSuggestions = proofResult.suggestions.length
      const appliedCount = newApplied.size
      const baseScore = proofResult.score
      const maxBonus = 100 - baseScore
      const bonus = Math.round((appliedCount / Math.max(totalSuggestions, 1)) * maxBonus * 0.8)
      setProofResult({ ...proofResult, score: Math.min(100, baseScore + bonus) })
    }
  }

  const applyAllSuggestions = () => {
    if (!proofResult) return
    let newContent = content
    const newApplied = new Set(appliedSuggestions)
    let appliedCount = 0
    proofResult.suggestions.forEach((s, idx) => {
      if (!newApplied.has(idx) && s.original && s.suggested) {
        // すべてのマッチを置換（同じ文字列が複数箇所にある場合も対応）
        const escaped = s.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const updated = newContent.replace(new RegExp(escaped, 'g'), s.suggested)
        if (updated !== newContent) {
          newContent = updated
          newApplied.add(idx)
          appliedCount++
        } else {
          // 完全一致でなくても適用済みとしてマーク（既に前の修正で変わった可能性）
          newApplied.add(idx)
          appliedCount++
        }
      }
    })
    if (appliedCount > 0) {
      handleContentChange(newContent)
      setAppliedSuggestions(newApplied)
      // 全修正で最大スコアに近づける
      const bonus = Math.round((100 - proofResult.score) * 0.8)
      setProofResult({ ...proofResult, score: Math.min(100, proofResult.score + bonus) })
    }
  }

  // タイトル提案
  const handleSuggestTitles = async () => {
    if (!draftId) return
    setTitlesLoading(true)
    setSuggestedTitles([])
    setRightPanel('titles')
    try {
      await handleSave()
      const res = await fetch(`/api/interview/articles/${draftId}/suggest-titles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: titlePlatform, count: 5 }),
      })
      const data = await res.json()
      if (data.success) setSuggestedTitles(data.titles || [])
      else alert(data.error || 'タイトル提案に失敗しました')
    } catch { alert('タイトル提案中にエラーが発生しました') }
    finally { setTitlesLoading(false) }
  }

  // ファクトチェック
  const handleFactCheck = async () => {
    if (!draftId) return
    setFactLoading(true)
    setFactResult(null)
    setRightPanel('factcheck')
    try {
      await handleSave()
      const res = await fetch(`/api/interview/articles/${draftId}/fact-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) {
        setFactResult({ reliability: data.reliability, summary: data.summary, claims: data.claims || [], warnings: data.warnings || [] })
      } else { alert(data.error || 'ファクトチェックに失敗しました') }
    } catch { alert('ファクトチェック中にエラーが発生しました') }
    finally { setFactLoading(false) }
  }

  // SNS投稿生成
  const handleSnsGenerate = async () => {
    if (!draftId || snsSelectedPlatforms.length === 0) return
    setSnsLoading(true)
    setSnsPosts([])
    setRightPanel('sns')
    try {
      await handleSave()
      const res = await fetch(`/api/interview/articles/${draftId}/sns-posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: snsSelectedPlatforms, tone: snsTone, articleUrl: snsArticleUrl }),
      })
      const data = await res.json()
      if (data.success) setSnsPosts(data.posts || [])
      else alert(data.error || 'SNS投稿生成に失敗しました')
    } catch { alert('SNS投稿生成中にエラーが発生しました') }
    finally { setSnsLoading(false) }
  }

  const toggleSnsPlatform = (p: string) => {
    setSnsSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const copySnsPost = async (text: string) => {
    await navigator.clipboard.writeText(text)
    alert('投稿文をコピーしました')
  }

  // 翻訳
  const handleTranslate = async () => {
    if (!draftId) return
    setTranslateLoading(true)
    setTranslationResult(null)
    setRightPanel('translate')
    try {
      await handleSave()
      const res = await fetch(`/api/interview/articles/${draftId}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: translateLang }),
      })
      const data = await res.json()
      if (data.success) {
        setTranslationResult({
          language: data.language, languageName: data.languageName,
          title: data.title, content: data.content,
          seoTitle: data.seoTitle, seoDescription: data.seoDescription,
          wordCount: data.wordCount,
        })
      } else { alert(data.error || '翻訳に失敗しました') }
    } catch { alert('翻訳中にエラーが発生しました') }
    finally { setTranslateLoading(false) }
  }

  const copyTranslation = async () => {
    if (!translationResult) return
    const text = `# ${translationResult.title}\n\n${translationResult.content}`
    await navigator.clipboard.writeText(text)
    alert('翻訳をコピーしました')
  }

  const exportTranslation = () => {
    if (!translationResult) return
    const text = `# ${translationResult.title}\n\n${translationResult.content}`
    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${translationResult.title || 'translated'}_${translationResult.language}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // AI修正
  const handleRevise = async () => {
    if (!draftId || !reviseInstruction.trim()) return
    setReviseLoading(true)
    setRevisedContent(null)
    setReviseError(null)
    setRightPanel('revise')
    try {
      await handleSave()
      const res = await fetch('/api/interview/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          articleContent: content,
          instruction: reviseInstruction.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setContentBeforeRevision(content)
        setRevisedContent(data.revisedContent)
      } else {
        setReviseError(data.error || 'AI修正に失敗しました')
      }
    } catch {
      setReviseError('AI修正の実行中にエラーが発生しました')
    } finally {
      setReviseLoading(false)
    }
  }

  const applyRevision = () => {
    if (!revisedContent) return
    const historyItem: RevisionHistoryItem = {
      instruction: reviseInstruction,
      timestamp: new Date(),
      originalLength: content.length,
      revisedLength: revisedContent.length,
    }
    setRevisionHistory((prev) => [historyItem, ...prev].slice(0, 5))
    handleContentChange(revisedContent)
    setRevisedContent(null)
    setContentBeforeRevision(null)
    setReviseInstruction('')
  }

  const revertRevision = () => {
    setRevisedContent(null)
    setContentBeforeRevision(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="space-y-4">
            <div className="h-8 bg-slate-200 rounded-lg w-1/3 animate-pulse" />
            <div className="h-[600px] bg-white border border-slate-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  if (!draftId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center py-20">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-blue-600 text-[48px]">description</span>
          </div>
          <p className="text-slate-900 font-bold text-lg mb-2">ドラフトがありません</p>
          <p className="text-slate-500 text-sm mb-6">先にAI記事生成を実行してください</p>
          <button
            onClick={() => router.push(`/interview/projects/${projectId}/skill`)}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
          >
            記事生成に戻る
          </button>
        </div>
      </div>
    )
  }

  const proofScoreColor =
    (proofResult?.score ?? 0) >= 80 ? 'text-green-600' :
    (proofResult?.score ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600'

  const factScoreColor =
    (factResult?.reliability ?? 0) >= 80 ? 'text-green-600' :
    (factResult?.reliability ?? 0) >= 60 ? 'text-yellow-600' : 'text-red-600'

  const TABS: { key: RightPanel; label: string }[] = [
    { key: 'preview', label: '💻' },
    { key: 'proofread', label: '✅' },
    { key: 'titles', label: '💡' },
    { key: 'factcheck', label: '🔍' },
    { key: 'sns', label: '📱' },
    { key: 'translate', label: '🌐' },
  ]
  const TAB_NAMES: Record<string, string> = {
    preview: 'Markdown', proofread: '校正', titles: 'タイトル',
    factcheck: 'ファクトチェック', sns: 'SNS投稿', translate: '翻訳',
  }

  return (
    <>
      <Script src="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      <div className="min-h-screen bg-slate-50">
        {/* ツールバー */}
        <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
          <div className="max-w-[1800px] mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push(`/interview/projects/${projectId}`)}
                  className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  <span className="text-sm font-medium">戻る</span>
                </button>
                <div className="h-5 w-px bg-slate-200"></div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">記事エディタ</h1>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">text_fields</span>
                      {wordCount.toLocaleString()}文字
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      約{Math.ceil(wordCount / 600)}分
                    </span>
                    {lastSaved && !saving && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          {lastSaved.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 保存
                        </span>
                      </>
                    )}
                    {saving && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                          保存中...
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>保存</span>
                </button>
                <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  <span>コピー</span>
                </button>
                <div className="relative" ref={exportDropdownRef}>
                  <button
                    onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span>エクスポート</span>
                    <span className="material-symbols-outlined text-[14px]">expand_more</span>
                  </button>
                  {exportDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-20 min-w-[180px]">
                      <button
                        onClick={() => { handleExportMd(); setExportDropdownOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-[18px] text-slate-500">description</span>
                        <div>
                          <p className="font-medium">Markdown (.md)</p>
                          <p className="text-[11px] text-slate-400">書式付きでエクスポート</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { handleExportTxt(); setExportDropdownOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-[18px] text-slate-500">text_snippet</span>
                        <div>
                          <p className="font-medium">テキスト (.txt)</p>
                          <p className="text-[11px] text-slate-400">プレーンテキストでエクスポート</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
                <div className="h-8 w-px bg-slate-200 mx-1"></div>
                <button onClick={handleProofread} disabled={proofLoading} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20">
                  <span className="material-symbols-outlined text-[18px]">spellcheck</span>
                  <span>校正</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツエリア */}
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          {/* ステッパー */}
          <div className="flex items-center gap-2 mb-6">
            {[
              { label: '素材アップ', icon: 'upload_file' },
              { label: '文字起こし', icon: 'transcribe' },
              { label: 'スキル選択', icon: 'book' },
              { label: 'AI生成', icon: 'auto_awesome' },
              { label: '編集', icon: 'edit' },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  i === 4
                    ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20'
                    : 'bg-green-50 text-green-600 border border-green-200 font-medium'
                }`}>
                  {i < 4 && <span className="material-symbols-outlined text-[16px]">check_circle</span>}
                  {i === 4 && <span className="material-symbols-outlined text-[16px]">edit</span>}
                  <span>{step.label}</span>
                </div>
                {i < 4 && <span className="material-symbols-outlined text-slate-300 text-[16px]">arrow_forward</span>}
              </div>
            ))}
          </div>

          <div className="flex gap-6">
            {/* エディタエリア */}
            <div className="flex-1 min-w-0">
              {/* モード切替バー */}
              <div className="bg-white border border-slate-200 rounded-t-xl px-4 py-2.5 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setLeftMode('edit')}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      leftMode === 'edit'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">article</span>
                    <span>プレビュー</span>
                  </button>
                  <button
                    onClick={() => setLeftMode('preview')}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      leftMode === 'preview'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">code</span>
                    <span>Markdown</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  {leftMode === 'edit' ? '記事プレビュー' : 'Markdownソースを編集'}
                </div>
              </div>

              {leftMode === 'edit' ? (
                /* リッチテキストエディタ */
                <div className="bg-white border border-slate-200 border-t-0 shadow-sm min-h-[calc(100vh-400px)] overflow-y-auto">
                  <style dangerouslySetInnerHTML={{ __html: RICH_EDITOR_STYLES }} />
                  <div className="max-w-[720px] mx-auto px-8 py-10">
                    {/* バナー画像 (Nano Banana Pro) */}
                    {bannerUrl ? (
                      <div className="relative group mb-8 -mx-8 -mt-10 overflow-hidden">
                        <img
                          src={bannerUrl}
                          alt="記事バナー"
                          className="w-full h-[200px] object-cover"
                          style={{ filter: 'brightness(0.92) contrast(1.08) saturate(1.1)' }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                        <button
                          onClick={generateBanner}
                          disabled={bannerGenerating}
                          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-bold text-slate-700 hover:bg-white shadow-lg flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">{bannerGenerating ? 'sync' : 'refresh'}</span>
                          {bannerGenerating ? '生成中...' : '再生成'}
                        </button>
                      </div>
                    ) : content.trim() ? (
                      <div className="mb-8 -mx-8 -mt-10">
                        <button
                          onClick={generateBanner}
                          disabled={bannerGenerating}
                          className="w-full h-[120px] bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50 border-b border-slate-200 flex flex-col items-center justify-center gap-2 hover:from-[#7f19e6]/5 hover:via-[#7f19e6]/10 hover:to-[#7f19e6]/5 transition-all group"
                        >
                          {bannerGenerating ? (
                            <>
                              <span className="material-symbols-outlined text-2xl text-[#7f19e6] animate-spin">progress_activity</span>
                              <span className="text-xs font-bold text-slate-500">Nano Banana Pro でバナー生成中...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-2xl text-slate-300 group-hover:text-[#7f19e6] transition-colors">add_photo_alternate</span>
                              <span className="text-xs font-bold text-slate-400 group-hover:text-[#7f19e6] transition-colors">バナー画像を生成</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : null}

                    {/* タイトル入力 */}
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="記事タイトルを入力..."
                      className="w-full text-3xl font-black tracking-tight text-slate-900 outline-none placeholder:text-slate-300 leading-[1.3] mb-8 pb-6 border-b-2 border-slate-100"
                    />

                    {/* レンダリング済みプレビュー */}
                    <div
                      className="rich-editor"
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
                    />
                  </div>
                </div>
              ) : (
                /* Markdown ソースコード */
                <>
                  {/* タイトル入力 */}
                  <div className="bg-white border border-slate-200 border-t-0 px-6 py-4 shadow-sm">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="記事タイトルを入力..."
                      className="w-full text-2xl font-extrabold tracking-tight text-slate-900 outline-none placeholder:text-slate-300"
                    />
                  </div>

                  {/* Markdown テキストエリア */}
                  <div className="bg-white border border-slate-200 border-t-0 shadow-sm">
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => handleContentChange(e.target.value)}
                      className="w-full min-h-[calc(100vh-400px)] px-6 py-6 text-[15px] leading-[1.75] text-slate-700 outline-none resize-none font-mono bg-slate-50/50"
                      placeholder="Markdown記法で本文を入力..."
                    />
                  </div>
                </>
              )}

              {/* インラインAI修正バー */}
              <div className="bg-white border border-slate-200 border-t-0 rounded-b-xl shadow-sm">
                {/* 修正結果インライン表示 */}
                <AnimatePresence>
                  {revisedContent && !reviseLoading && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-white border-t border-blue-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-600 text-[18px]">check_circle</span>
                            <span className="text-sm font-semibold text-slate-900">AI修正が完了</span>
                            <span className="text-xs text-slate-500">
                              ({content.length.toLocaleString()} → {revisedContent.length.toLocaleString()}文字)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={revertRevision}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">undo</span>
                              キャンセル
                            </button>
                            <button
                              onClick={applyRevision}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[14px]">done</span>
                              適用する
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 入力バー */}
                <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-3">
                  <span className="material-symbols-outlined text-blue-600 text-[20px] shrink-0">auto_fix_high</span>
                  <input
                    type="text"
                    value={reviseInstruction}
                    onChange={(e) => setReviseInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && reviseInstruction.trim() && !reviseLoading) {
                        e.preventDefault()
                        handleRevise()
                      }
                    }}
                    placeholder="AI修正指示を入力... 例:「です・ます調に統一して」「冒頭をもっと印象的に」"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6]/30 focus:border-blue-600 transition-all placeholder:text-slate-400"
                    disabled={reviseLoading}
                  />
                  <button
                    onClick={handleRevise}
                    disabled={reviseLoading || !reviseInstruction.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm shrink-0"
                  >
                    {reviseLoading ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        <span>修正中...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">send</span>
                        <span>修正</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 右サイドパネル */}
            <div className="w-[420px] shrink-0">
              {/* タブナビゲーション */}
              <div className="bg-white border border-slate-200 rounded-t-xl flex shadow-sm">
                {[
                  { key: 'proofread' as RightPanel, label: '校正', icon: 'spellcheck' },
                  { key: 'preview' as RightPanel, label: 'MD', icon: 'code' },
                  { key: 'revise' as RightPanel, label: 'AI修正', icon: 'edit_note' },
                  { key: 'titles' as RightPanel, label: 'タイトル', icon: 'title' },
                  { key: 'factcheck' as RightPanel, label: 'ファクト', icon: 'fact_check' },
                  { key: 'sns' as RightPanel, label: 'SNS', icon: 'share' },
                  { key: 'translate' as RightPanel, label: '翻訳', icon: 'translate' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setRightPanel(tab.key)}
                    title={tab.label}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs transition-all ${
                      rightPanel === tab.key
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 font-semibold'
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                    <span className="text-[10px]">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* パネルコンテンツ */}
              <div className="bg-white border border-slate-200 border-t-0 rounded-b-xl p-6 overflow-y-auto shadow-sm" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                <AnimatePresence mode="wait">

                {/* ===== Markdownソース ===== */}
                {rightPanel === 'preview' && (
                  <motion.div key="preview" variants={panelVariants} initial="hidden" animate="show" exit="exit">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">code</span>
                        <h3 className="text-sm font-bold tracking-tight text-slate-900">Markdownソース</h3>
                      </div>
                      <button
                        onClick={async () => { await navigator.clipboard.writeText(content); alert('Markdownをコピーしました') }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                      >
                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                        コピー
                      </button>
                    </div>
                    {!content.trim() ? (
                      <div className="text-center py-12">
                        <span className="material-symbols-outlined text-slate-300 text-[48px] mb-3 block">code</span>
                        <p className="text-sm text-slate-400">記事を入力するとMarkdownが表示されます</p>
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-[13px] text-slate-700 whitespace-pre-wrap leading-[1.7] font-mono break-all">
                          {content}
                        </pre>
                      </div>
                    )}
                  </div>
                  </motion.div>
                )}

                {/* ===== 校正 ===== */}
                {rightPanel === 'proofread' && (
                  <motion.div key="proofread" variants={panelVariants} initial="hidden" animate="show" exit="exit">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                      <span className="material-symbols-outlined text-blue-600">spellcheck</span>
                      <h3 className="text-sm font-bold tracking-tight text-slate-900">校正・校閲</h3>
                    </div>

                    {proofLoading && (
                      <div className="text-center py-12">
                        <div className="inline-block w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                        <p className="text-sm text-slate-600 font-medium">AIが校正しています...</p>
                        <p className="text-xs text-slate-400 mt-1">しばらくお待ちください</p>
                      </div>
                    )}

                    {!proofLoading && !proofResult && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-blue-600 text-[32px]">spellcheck</span>
                        </div>
                        <p className="text-sm text-slate-700 font-medium mb-2">記事の校正を開始</p>
                        <p className="text-xs text-slate-500 mb-6">誤字脱字、表記揺れ、文法をチェックします</p>
                        <button
                          onClick={handleProofread}
                          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2 mx-auto"
                        >
                          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                          <span>校正を実行</span>
                        </button>
                      </div>
                    )}

                    {proofResult && (
                      <>
                        {/* スコアエリア（一番上） */}
                        <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-2xl p-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className={`text-4xl font-black ${proofScoreColor}`}>{Math.round(proofResult.score)}</div>
                              <div className="text-xs text-slate-500 font-medium mt-1">校正スコア / 100</div>
                            </div>
                            <button
                              onClick={handleProofread}
                              disabled={proofLoading}
                              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[16px]">refresh</span>
                              <span>再校正</span>
                            </button>
                          </div>
                          {/* プログレスバー */}
                          <div className="mt-3 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                proofResult.score >= 80 ? 'bg-green-500' : proofResult.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(100, proofResult.score)}%` }}
                            />
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-4">
                          <p className="text-sm text-slate-700 leading-relaxed">{proofResult.summary}</p>
                        </div>

                        {proofResult.checks && Object.keys(proofResult.checks).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(proofResult.checks).map(([key, ok]) => (
                              <span
                                key={key}
                                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium ${
                                  ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">{ok ? 'check_circle' : 'cancel'}</span>
                                <span>{key}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold tracking-tight text-slate-900">修正候補</p>
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                              {appliedSuggestions.size}/{proofResult.suggestions.length}件適用済
                            </span>
                          </div>

                          {/* すべて修正ボタン */}
                          {proofResult.suggestions.length > 0 && appliedSuggestions.size < proofResult.suggestions.length && (
                            <button
                              onClick={applyAllSuggestions}
                              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-600 transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[18px]">done_all</span>
                              <span>すべて修正を適用（{proofResult.suggestions.length - appliedSuggestions.size}件）</span>
                            </button>
                          )}

                          {proofResult.suggestions.length === 0 && (
                            <div className="text-center py-8 bg-green-50 rounded-lg border border-green-100">
                              <span className="material-symbols-outlined text-green-600 text-[32px] mb-2 block">check_circle</span>
                              <p className="text-sm text-green-700 font-medium">修正候補はありません</p>
                            </div>
                          )}

                          {proofResult.suggestions.map((s, idx) => {
                            const isApplied = appliedSuggestions.has(idx)
                            return (
                              <div
                                key={idx}
                                className={`border rounded-lg p-4 space-y-2.5 transition-all ${
                                  isApplied ? 'border-green-200 bg-green-50 opacity-60' : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-md'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${SEVERITY_COLORS[s.severity] || SEVERITY_COLORS.low}`}>
                                    {SEVERITY_LABELS[s.severity] || s.severity}
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                                    {TYPE_LABELS[s.type] || s.type}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="line-through text-red-600 text-sm bg-red-50 px-1 rounded">{s.original}</span>
                                  <span className="material-symbols-outlined text-slate-400 text-[16px]">arrow_forward</span>
                                  <span className="text-green-600 font-semibold text-sm">{s.suggested}</span>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">{s.reason}</p>
                                {!isApplied ? (
                                  <button
                                    onClick={() => applySuggestion(idx, s)}
                                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">done</span>
                                    <span>この修正を適用</span>
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                    <span>適用済み</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        <button
                          onClick={handleProofread}
                          disabled={proofLoading}
                          className="w-full py-2 bg-slate-50 text-slate-500 rounded-lg text-xs font-medium hover:bg-slate-100 hover:text-slate-700 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">refresh</span>
                          <span>再校正する</span>
                        </button>
                      </>
                    )}
                  </div>
                  </motion.div>
                )}

                {/* ===== タイトル提案 ===== */}
                {rightPanel === 'titles' && (
                  <motion.div key="titles" variants={panelVariants} initial="hidden" animate="show" exit="exit">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                      <span className="material-symbols-outlined text-blue-600">title</span>
                      <h3 className="text-sm font-bold tracking-tight text-slate-900">タイトル提案</h3>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-3">プラットフォーム</p>
                      <div className="flex flex-wrap gap-2">
                        {TITLE_PLATFORM_OPTIONS.map((opt) => {
                          const colors = PLATFORM_COLORS[opt.value]
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setTitlePlatform(opt.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                titlePlatform === opt.value
                                  ? `${colors?.active || 'bg-blue-600 text-white'} shadow-sm`
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <button
                      onClick={handleSuggestTitles}
                      disabled={titlesLoading}
                      className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                      {titlesLoading ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                          <span>AIが考え中...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                          <span>タイトルを提案してもらう</span>
                        </>
                      )}
                    </button>

                    {titlesLoading && (
                      <div className="text-center py-8">
                        <div className="inline-block w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                        <p className="text-sm text-slate-600">AIがタイトルを生成中...</p>
                      </div>
                    )}

                    {suggestedTitles.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold tracking-tight text-slate-900">提案タイトル</p>
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{suggestedTitles.length}件</span>
                        </div>

                        {suggestedTitles.map((t, idx) => (
                          <div
                            key={idx}
                            className={`border rounded-lg p-4 transition-all ${
                              title === t.title ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-semibold text-slate-900 leading-snug flex-1">{t.title}</p>
                              <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-700">
                                {TYPE_LABELS[t.type] || t.type}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed mb-3">{t.reason}</p>
                            {title === t.title ? (
                              <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                <span>適用中</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => setTitle(t.title)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">done</span>
                                <span>このタイトルを使う</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!titlesLoading && suggestedTitles.length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-blue-600 text-[32px]">lightbulb</span>
                        </div>
                        <p className="text-sm text-slate-700 font-medium mb-1">タイトルを提案します</p>
                        <p className="text-xs text-slate-500">プラットフォームを選んで生成してください</p>
                      </div>
                    )}
                  </div>
                  </motion.div>
                )}

                {/* ===== ファクトチェック ===== */}
                {rightPanel === 'factcheck' && (
                  <motion.div key="factcheck" variants={panelVariants} initial="hidden" animate="show" exit="exit">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                      <span className="material-symbols-outlined text-blue-600">fact_check</span>
                      <h3 className="text-sm font-bold tracking-tight text-slate-900">ファクトチェック</h3>
                    </div>

                    {factLoading && (
                      <div className="text-center py-12">
                        <div className="inline-block w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                        <p className="text-sm text-slate-600 font-medium">AIが検証しています...</p>
                        <p className="text-xs text-slate-400 mt-1">事実関係を確認中</p>
                      </div>
                    )}

                    {!factLoading && !factResult && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-blue-600 text-[32px]">fact_check</span>
                        </div>
                        <p className="text-sm text-slate-700 font-medium mb-2">記事の事実関係を検証</p>
                        <p className="text-xs text-slate-500 mb-6">数値・固有名詞・日付・主張をAIがチェック</p>
                        <button
                          onClick={handleFactCheck}
                          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2 mx-auto"
                        >
                          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                          <span>ファクトチェック実行</span>
                        </button>
                      </div>
                    )}

                    {factResult && (
                      <>
                        <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-2xl p-6">
                          <div className="text-center">
                            <div className={`text-5xl font-black mb-2 ${factScoreColor}`}>{factResult.reliability}</div>
                            <div className="text-xs text-slate-500 font-medium">信頼性スコア / 100</div>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-4">
                          <p className="text-sm text-slate-700 leading-relaxed">{factResult.summary}</p>
                        </div>

                        {factResult.warnings.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
                            {factResult.warnings.map((w, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-yellow-600 text-[18px] mt-0.5">warning</span>
                                <p className="text-xs text-yellow-700 leading-relaxed flex-1">{w}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold tracking-tight text-slate-900">検証項目</p>
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{factResult.claims.length}件</span>
                          </div>

                          {factResult.claims.map((c, idx) => {
                            const st = CLAIM_STATUS[c.status] || CLAIM_STATUS.unverifiable
                            return (
                              <div key={idx} className="border border-slate-200 bg-white rounded-lg p-4 space-y-2.5 hover:border-blue-200 hover:shadow-md transition-all">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-1 rounded text-[11px] font-medium ${st.color}`}>
                                    {st.label}
                                  </span>
                                  <span className="px-2 py-1 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                                    {CLAIM_CATEGORY[c.category] || c.category}
                                  </span>
                                  <span className={`px-2 py-1 rounded text-[11px] font-medium border ${SEVERITY_COLORS[c.severity] || SEVERITY_COLORS.info}`}>
                                    {SEVERITY_LABELS[c.severity] || c.severity}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-900 font-semibold">「{c.text}」</p>
                                <p className="text-xs text-slate-500 leading-relaxed">{c.detail}</p>
                              </div>
                            )
                          })}
                        </div>

                        <button
                          onClick={handleFactCheck}
                          disabled={factLoading}
                          className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">refresh</span>
                          <span>再チェック</span>
                        </button>
                      </>
                    )}
                  </div>
                  </motion.div>
                )}

                {/* ===== SNS投稿 ===== */}
                {rightPanel === 'sns' && (
                  <motion.div key="sns" variants={panelVariants} initial="hidden" animate="show" exit="exit">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                      <span className="material-symbols-outlined text-blue-600">share</span>
                      <h3 className="text-sm font-bold tracking-tight text-slate-900">SNS投稿生成</h3>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-3">プラットフォーム (複数選択可)</p>
                      <div className="flex flex-wrap gap-2">
                        {SNS_PLATFORM_OPTIONS.map((opt) => {
                          const colors = PLATFORM_COLORS[opt.value]
                          return (
                            <button
                              key={opt.value}
                              onClick={() => toggleSnsPlatform(opt.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                snsSelectedPlatforms.includes(opt.value)
                                  ? `${colors?.active || 'bg-blue-600 text-white'} shadow-sm`
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {opt.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-3">トーン</p>
                      <div className="flex gap-2">
                        {[
                          { value: 'professional', label: 'プロフェッショナル' },
                          { value: 'casual', label: 'カジュアル' },
                          { value: 'humorous', label: 'ユーモラス' },
                        ].map((t) => (
                          <button
                            key={t.value}
                            onClick={() => setSnsTone(t.value)}
                            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              snsTone === t.value
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-2">記事URL（任意）</p>
                      <input
                        type="url"
                        value={snsArticleUrl}
                        onChange={(e) => setSnsArticleUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <button
                      onClick={handleSnsGenerate}
                      disabled={snsLoading || snsSelectedPlatforms.length === 0}
                      className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                      {snsLoading ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                          <span>生成中...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                          <span>SNS投稿文を生成</span>
                        </>
                      )}
                    </button>

                    {snsLoading && (
                      <div className="text-center py-8">
                        <div className="inline-block w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                        <p className="text-sm text-slate-600">AIが投稿文を生成中...</p>
                      </div>
                    )}

                    {snsPosts.length > 0 && (
                      <div className="space-y-3">
                        {snsPosts.map((post, idx) => {
                          const platformLabel = SNS_PLATFORM_OPTIONS.find((o) => o.value === post.platform)?.label || post.platform
                          const platformColor = PLATFORM_COLORS[post.platform]
                          return (
                            <div key={idx} className="border border-slate-200 bg-white rounded-lg p-4 space-y-3 hover:border-blue-200 hover:shadow-md transition-all">
                              <div className="flex items-center justify-between">
                                <span className={`text-sm font-semibold ${platformColor?.text || 'text-blue-600'}`}>{platformLabel}</span>
                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{post.characterCount}文字</span>
                              </div>
                              <pre className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-3">{post.content}</pre>
                              {post.hashtags?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {post.hashtags.map((tag, i) => (
                                    <span key={i} className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">#{tag}</span>
                                  ))}
                                </div>
                              )}
                              {post.tip && (
                                <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-2">
                                  <span className="material-symbols-outlined text-blue-600 text-[16px] mt-0.5">lightbulb</span>
                                  <p className="text-xs text-slate-600 leading-relaxed flex-1">{post.tip}</p>
                                </div>
                              )}
                              <button
                                onClick={() => copySnsPost(post.content)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                              >
                                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                <span>コピー</span>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {!snsLoading && snsPosts.length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-blue-600 text-[32px]">share</span>
                        </div>
                        <p className="text-sm text-slate-700 font-medium mb-1">SNS投稿文を生成</p>
                        <p className="text-xs text-slate-500">プラットフォームを選んで生成してください</p>
                      </div>
                    )}
                  </div>
                  </motion.div>
                )}

                {/* ===== 翻訳 ===== */}
                {rightPanel === 'translate' && (
                  <motion.div key="translate" variants={panelVariants} initial="hidden" animate="show" exit="exit">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                      <span className="material-symbols-outlined text-blue-600">translate</span>
                      <h3 className="text-sm font-bold tracking-tight text-slate-900">多言語翻訳</h3>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-3">翻訳先言語</p>
                      <div className="flex flex-wrap gap-2">
                        {TRANSLATE_LANGUAGES.map((lang) => (
                          <button
                            key={lang.value}
                            onClick={() => setTranslateLang(lang.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              translateLang === lang.value
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {lang.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleTranslate}
                      disabled={translateLoading}
                      className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                      {translateLoading ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                          <span>翻訳中...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">translate</span>
                          <span>翻訳する</span>
                        </>
                      )}
                    </button>

                    {translateLoading && (
                      <div className="text-center py-8">
                        <div className="inline-block w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                        <p className="text-sm text-slate-600 font-medium">AIが翻訳しています...</p>
                        <p className="text-xs text-slate-400 mt-1">Markdown構造を保持して翻訳中</p>
                      </div>
                    )}

                    {translationResult && (
                      <>
                        <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-blue-600">{translationResult.languageName}</span>
                            <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full">{translationResult.wordCount.toLocaleString()}文字</span>
                          </div>
                          <p className="text-base font-bold text-slate-900 leading-snug">{translationResult.title}</p>
                        </div>

                        {translationResult.seoTitle && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-slate-600 text-[16px]">search</span>
                              <p className="text-xs font-semibold text-slate-700">SEO最適化</p>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                              <p className="text-xs text-slate-700 font-medium">{translationResult.seoTitle}</p>
                              <p className="text-xs text-slate-500 leading-relaxed">{translationResult.seoDescription}</p>
                            </div>
                          </div>
                        )}

                        <div>
                          <p className="text-xs font-semibold text-slate-700 mb-2">翻訳結果</p>
                          <div className="bg-slate-50 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                            <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                              {translationResult.content.slice(0, 3000)}
                              {translationResult.content.length > 3000 && '\n\n...(以下省略 — コピーで全文取得)'}
                            </pre>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={copyTranslation}
                            className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[16px]">content_copy</span>
                            <span>全文コピー</span>
                          </button>
                          <button
                            onClick={exportTranslation}
                            className="flex-1 py-2.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[16px]">download</span>
                            <span>MDダウンロード</span>
                          </button>
                        </div>

                        <button
                          onClick={handleTranslate}
                          disabled={translateLoading}
                          className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">refresh</span>
                          <span>別の言語で再翻訳</span>
                        </button>
                      </>
                    )}

                    {!translateLoading && !translationResult && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-blue-600 text-[32px]">translate</span>
                        </div>
                        <p className="text-sm text-slate-700 font-medium mb-1">多言語に翻訳</p>
                        <p className="text-xs text-slate-500 mb-1">言語を選んで翻訳してください</p>
                        <p className="text-xs text-slate-400">Markdown構造を保持して翻訳されます</p>
                      </div>
                    )}
                  </div>
                  </motion.div>
                )}

                {/* ===== AI修正 ===== */}
                {rightPanel === 'revise' && (
                  <motion.div key="revise" variants={panelVariants} initial="hidden" animate="show" exit="exit">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                      <span className="material-symbols-outlined text-blue-600">edit_note</span>
                      <h3 className="text-sm font-bold tracking-tight text-slate-900">AI修正パネル</h3>
                    </div>

                    {/* 修正指示入力 */}
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-2">修正指示</p>
                      <textarea
                        value={reviseInstruction}
                        onChange={(e) => setReviseInstruction(e.target.value)}
                        placeholder={'修正指示を入力してください\n例: 「冒頭をもっとインパクトのある書き出しに変更してください」'}
                        className="w-full px-3 py-3 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none leading-relaxed"
                        rows={4}
                        disabled={reviseLoading}
                      />
                    </div>

                    <button
                      onClick={handleRevise}
                      disabled={reviseLoading || !reviseInstruction.trim()}
                      className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                      {reviseLoading ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                          <span>AIが修正中...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
                          <span>修正を適用</span>
                        </>
                      )}
                    </button>

                    {/* ローディング */}
                    {reviseLoading && (
                      <div className="text-center py-8">
                        <div className="inline-block w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                        <p className="text-sm text-slate-600 font-medium">AIが記事を修正しています...</p>
                        <p className="text-xs text-slate-400 mt-1">元の構成を維持しながら修正中</p>
                      </div>
                    )}

                    {/* エラー表示 */}
                    {reviseError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-red-600 text-[18px] mt-0.5">error</span>
                          <div>
                            <p className="text-sm text-red-700 font-medium">修正に失敗しました</p>
                            <p className="text-xs text-red-600 mt-1">{reviseError}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 修正結果プレビュー */}
                    {revisedContent && !reviseLoading && (
                      <>
                        <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-xl p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-600 text-[20px]">check_circle</span>
                            <p className="text-sm font-semibold text-slate-900">修正が完了しました</p>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">text_fields</span>
                              修正前: {content.length.toLocaleString()}文字
                            </span>
                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">text_fields</span>
                              修正後: {revisedContent.length.toLocaleString()}文字
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            差分: {revisedContent.length - content.length > 0 ? '+' : ''}{(revisedContent.length - content.length).toLocaleString()}文字
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-700 mb-2">修正後プレビュー</p>
                          <div className="bg-slate-50 rounded-lg p-4 max-h-[250px] overflow-y-auto">
                            <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                              {revisedContent.slice(0, 2000)}
                              {revisedContent.length > 2000 && '\n\n...(以下省略)'}
                            </pre>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={revertRevision}
                            className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[16px]">undo</span>
                            <span>元に戻す</span>
                          </button>
                          <button
                            onClick={applyRevision}
                            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[16px]">done</span>
                            <span>適用する</span>
                          </button>
                        </div>
                      </>
                    )}

                    {/* 修正履歴 */}
                    {revisionHistory.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <p className="text-sm font-bold tracking-tight text-slate-900">修正履歴</p>
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{revisionHistory.length}件</span>
                        </div>

                        {revisionHistory.map((item, idx) => (
                          <div
                            key={idx}
                            className="border border-slate-200 bg-white rounded-lg p-3 space-y-1.5 hover:border-blue-200 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500">
                                {item.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-xs text-slate-400">
                                {item.originalLength.toLocaleString()} → {item.revisedLength.toLocaleString()}文字
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                              {item.instruction}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 初期状態 */}
                    {!reviseLoading && !revisedContent && !reviseError && !reviseInstruction && revisionHistory.length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-blue-600 text-[32px]">edit_note</span>
                        </div>
                        <p className="text-sm text-slate-700 font-medium mb-2">AIで記事を修正</p>
                        <p className="text-xs text-slate-500 mb-1">自然言語で修正指示を入力すると</p>
                        <p className="text-xs text-slate-500">AIが記事を自動的に修正します</p>
                      </div>
                    )}
                  </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* 底部ナビゲーション */}
          <div className="max-w-[1800px] mx-auto px-6 py-8 flex items-center justify-center">
            <a
              href="/interview"
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all group"
            >
              <span className="material-symbols-outlined text-lg text-slate-400 group-hover:text-blue-500 transition-colors">add_circle</span>
              <span>他の記事を作成する</span>
              <span className="material-symbols-outlined text-lg text-slate-400 group-hover:text-blue-500 transition-colors">arrow_forward</span>
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
