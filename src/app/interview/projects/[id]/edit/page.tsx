'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useSearchParams } from 'next/navigation'
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

export default function EditPage() {
  const params = useParams()
  const searchParams = useSearchParams()
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
    if (newContent !== content) {
      handleContentChange(newContent)
      const newApplied = new Set(appliedSuggestions).add(idx)
      setAppliedSuggestions(newApplied)
      // スコアを修正数に応じて上昇
      if (proofResult) {
        const totalSuggestions = proofResult.suggestions.length
        const appliedCount = newApplied.size
        const bonus = Math.round((appliedCount / Math.max(totalSuggestions, 1)) * (100 - proofResult.score) * 0.8)
        setProofResult({ ...proofResult, score: Math.min(100, proofResult.score + bonus) })
      }
    }
  }

  const applyAllSuggestions = () => {
    if (!proofResult) return
    let newContent = content
    const newApplied = new Set(appliedSuggestions)
    proofResult.suggestions.forEach((s, idx) => {
      if (!newApplied.has(idx) && s.original && s.suggested) {
        const updated = newContent.replace(s.original, s.suggested)
        if (updated !== newContent) {
          newContent = updated
          newApplied.add(idx)
        }
      }
    })
    if (newContent !== content) {
      handleContentChange(newContent)
      setAppliedSuggestions(newApplied)
      // 全修正で最大スコアに近づける
      if (proofResult) {
        const bonus = Math.round((100 - proofResult.score) * 0.8)
        setProofResult({ ...proofResult, score: Math.min(100, proofResult.score + bonus) })
      }
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
          <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
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
    { key: 'preview', label: '📄' },
    { key: 'proofread', label: '✅' },
    { key: 'titles', label: '💡' },
    { key: 'factcheck', label: '🔍' },
    { key: 'sns', label: '📱' },
    { key: 'translate', label: '🌐' },
  ]
  const TAB_NAMES: Record<string, string> = {
    preview: 'プレビュー', proofread: '校正', titles: 'タイトル',
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
                <button className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors">
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
              {/* タイトル入力 */}
              <div className="bg-white border border-slate-200 rounded-t-xl px-6 py-4 shadow-sm">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="記事タイトルを入力..."
                  className="w-full text-2xl font-extrabold tracking-tight text-slate-900 outline-none placeholder:text-slate-300"
                />
              </div>

              {/* コンテンツエディタ */}
              <div className="bg-white border border-slate-200 border-t-0 shadow-sm">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="w-full min-h-[calc(100vh-400px)] px-6 py-6 text-[15px] leading-[1.75] text-slate-700 outline-none resize-none font-sans"
                  placeholder="ここに本文を入力してください。Markdown記法が使えます。"
                />
              </div>

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
                  { key: 'preview' as RightPanel, label: 'プレビュー', icon: 'visibility' },
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

                {/* ===== プレビュー ===== */}
                {rightPanel === 'preview' && (
                  <motion.div key="preview" variants={panelVariants} initial="hidden" animate="show" exit="exit">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                      <span className="material-symbols-outlined text-blue-600">visibility</span>
                      <h3 className="text-sm font-bold tracking-tight text-slate-900">プレビュー</h3>
                    </div>
                    {!content.trim() && (
                      <div className="text-center py-12">
                        <span className="material-symbols-outlined text-slate-300 text-[48px] mb-3 block">article</span>
                        <p className="text-sm text-slate-400">記事を入力するとプレビューが表示されます</p>
                      </div>
                    )}
                    <div className="prose prose-sm max-w-none">
                      {content.split('\n').map((line, i) => {
                        if (line.startsWith('### ')) return <h3 key={i} className="text-base font-bold text-slate-900 mt-5 mb-2">{line.slice(4)}</h3>
                        if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-slate-900 mt-6 mb-3">{line.slice(3)}</h2>
                        if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-slate-900 mt-6 mb-3">{line.slice(2)}</h1>
                        if (line.startsWith('> ')) return <blockquote key={i} className="border-l-4 border-blue-600 pl-4 text-slate-600 italic text-sm my-3 bg-blue-50 py-2">{line.slice(2)}</blockquote>
                        if (line.startsWith('- ')) return <li key={i} className="text-sm text-slate-700 ml-4 leading-relaxed">{line.slice(2)}</li>
                        if (line.trim() === '') return <br key={i} />
                        const b = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
                        return <p key={i} className="text-sm text-slate-700 leading-[1.8] mb-2" dangerouslySetInnerHTML={{ __html: b }} />
                      })}
                    </div>
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
