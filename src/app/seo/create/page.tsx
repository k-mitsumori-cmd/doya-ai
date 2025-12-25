'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ChevronDown, ChevronUp, ArrowRight, Loader2, Wand2, HelpCircle, X, CheckCircle2, Lightbulb, Zap, FileText, Edit3, Download, BookOpen, Trash2 } from 'lucide-react'
import Link from 'next/link'

// サンプルキーワードリスト
const SAMPLE_KEYWORDS = [
  { main: 'AI ライティング ツール', related: 'SEO記事作成, 自動文章生成, ChatGPT活用', persona: 'マーケティング担当者', tone: '専門的' },
  { main: '転職エージェント おすすめ', related: '転職サイト比較, 年収アップ, キャリアチェンジ', persona: '30代の転職希望者', tone: 'やさしい' },
  { main: 'プログラミング 独学', related: 'プログラミングスクール, 未経験エンジニア, 副業', persona: 'プログラミング初心者', tone: 'カジュアル' },
  { main: 'ダイエット 食事制限なし', related: '健康的に痩せる, 運動不足解消, 糖質制限', persona: '30代女性', tone: 'フレンドリー' },
  { main: 'クレジットカード 還元率', related: 'ポイント比較, 年会費無料, キャッシュレス', persona: '節約志向の20代', tone: '丁寧' },
  { main: 'ホームページ制作 費用', related: 'Web制作会社, WordPress, 個人事業主', persona: '中小企業経営者', tone: 'ビジネス' },
]

/**
 * DeepEditor風シンプル新規作成
 * 1画面＝1つの意思決定
 * 「操作」ではなく「進行」
 */
export default function SeoCreateSimplePage() {
  const router = useRouter()

  // Step（初見でも迷わない一本道）
  const [step, setStep] = useState<1 | 2>(1) // Step3はジョブ画面へ遷移するためここでは持たない
  const [preview, setPreview] = useState<null | {
    persona: string
    searchIntent: string
    keywords: string[]
    outline: any
  }>(null)
  const [previewing, setPreviewing] = useState(false)

  // 入力状態
  const [mainKeyword, setMainKeyword] = useState('')
  const [relatedKeywords, setRelatedKeywords] = useState('')
  const [persona, setPersona] = useState('')
  const [tone, setTone] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showKnowledge, setShowKnowledge] = useState(false)

  // 独自情報（学習）
  const [knowledgeTitle, setKnowledgeTitle] = useState('')
  const [knowledgeContent, setKnowledgeContent] = useState('')
  const [knowledgeItems, setKnowledgeItems] = useState<Array<{ id: string; title: string; content: string; createdAt: string }>>([])
  const [knowledgeLoading, setKnowledgeLoading] = useState(false)
  const [knowledgeBusy, setKnowledgeBusy] = useState(false)
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null)

  // 処理状態
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const canSubmit = mainKeyword.trim().length >= 1
  const canSaveKnowledge = knowledgeTitle.trim().length > 0 && knowledgeContent.trim().length > 0

  const knowledgeHint = useMemo(
    () =>
      '例：自社サービスの特徴/料金/強み、NG表現、公式URL、実績数値、用語の定義、競合との違い（一次情報ベース）',
    []
  )

  async function loadKnowledge() {
    setKnowledgeLoading(true)
    setKnowledgeError(null)
    try {
      const res = await fetch('/api/seo/knowledge', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) throw new Error(json?.error || `エラー (${res.status})`)
      setKnowledgeItems(Array.isArray(json.items) ? json.items : [])
    } catch (e: any) {
      setKnowledgeError(e?.message || '独自情報の読み込みに失敗しました')
      setKnowledgeItems([])
    } finally {
      setKnowledgeLoading(false)
    }
  }

  useEffect(() => {
    if (!showKnowledge) return
    loadKnowledge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showKnowledge])

  async function saveKnowledge() {
    if (!canSaveKnowledge || knowledgeBusy) return
    setKnowledgeBusy(true)
    setKnowledgeError(null)
    try {
      const res = await fetch('/api/seo/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: knowledgeTitle.trim(), content: knowledgeContent.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) throw new Error(json?.error || `エラー (${res.status})`)
      setKnowledgeTitle('')
      setKnowledgeContent('')
      await loadKnowledge()
    } catch (e: any) {
      setKnowledgeError(e?.message || '保存に失敗しました')
    } finally {
      setKnowledgeBusy(false)
    }
  }

  async function deleteKnowledge(id: string) {
    if (knowledgeBusy) return
    if (!confirm('この独自情報を削除しますか？')) return
    setKnowledgeBusy(true)
    setKnowledgeError(null)
    try {
      const res = await fetch(`/api/seo/knowledge/${id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) throw new Error(json?.error || `エラー (${res.status})`)
      await loadKnowledge()
    } catch (e: any) {
      setKnowledgeError(e?.message || '削除に失敗しました')
    } finally {
      setKnowledgeBusy(false)
    }
  }

  // サンプル入力
  function fillSample() {
    const sample = SAMPLE_KEYWORDS[Math.floor(Math.random() * SAMPLE_KEYWORDS.length)]
    setMainKeyword(sample.main)
    setRelatedKeywords(sample.related)
    setPersona(sample.persona)
    setTone(sample.tone)
    setShowAdvanced(true) // 詳細設定も開く
    setStep(1)
    setPreview(null)
  }

  function splitRelatedKeywords(raw: string): string[] {
    return (raw || '')
      .split(/[,、\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20)
  }

  const DEFAULT_LLMO = {
    tldr: true,
    conclusionFirst: true,
    faq: true,
    glossary: false,
    comparison: false,
    quotes: true,
    templates: false,
    objections: false,
  }

  async function handlePreview() {
    if (!canSubmit || previewing || loading) return
    setPreviewing(true)
    setError(null)
    try {
      const related = splitRelatedKeywords(relatedKeywords)
      const res = await fetch('/api/seo/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainKeyword: mainKeyword.trim(),
          relatedKeywords: related,
          persona: persona.trim() || undefined,
          tone: tone.trim() || '丁寧',
          targetChars: 10000,
          llmoOptions: DEFAULT_LLMO,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) throw new Error(json?.error || `エラー (${res.status})`)
      setPreview(json.preview)
      setStep(2)
    } catch (e: any) {
      setError(e?.message || 'プレビュー生成に失敗しました')
    } finally {
      setPreviewing(false)
    }
  }

  async function createArticle(opts: { createJob: boolean }) {
    const related = splitRelatedKeywords(relatedKeywords)
    const requestText =
      knowledgeItems.length > 0
        ? `以下の独自情報を考慮して記事を生成してください。\n\n${knowledgeItems
            .map((it) => `## ${it.title}\n${it.content}`)
            .join('\n\n')}`
        : undefined

    const derivedPersona = persona.trim() || String(preview?.persona || '').trim() || undefined
    const derivedIntent = String(preview?.searchIntent || '').trim() || ''

    const res = await fetch('/api/seo/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${mainKeyword.trim()}に関する記事`,
        keywords: [mainKeyword.trim(), ...related],
        persona: derivedPersona,
        tone: tone.trim() || '丁寧',
        targetChars: 10000,
        searchIntent: derivedIntent,
        llmoOptions: DEFAULT_LLMO,
        autoBundle: true,
        createJob: opts.createJob,
        requestText,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.success === false) throw new Error(json?.error || `エラーが発生しました (${res.status})`)
    return { articleId: json.articleId || json.article?.id || json.id, jobId: json.jobId || json.job?.id || null }
  }

  async function handleStartNow() {
    if (!canSubmit || loading) return
    setLoading(true)
    setError(null)
    try {
      const { articleId, jobId } = await createArticle({ createJob: true })
      if (jobId) {
        router.push(`/seo/jobs/${jobId}?auto=1`)
      } else if (articleId) {
        router.push(`/seo/articles/${articleId}`)
      } else {
        router.push('/seo')
      }
    } catch (e: any) {
      setError(e?.message || '記事の作成に失敗しました')
      setLoading(false)
    }
  }

  async function handleEditOutlineFirst() {
    if (!canSubmit || loading) return
    setLoading(true)
    setError(null)
    try {
      const { articleId } = await createArticle({ createJob: false })
      if (articleId) {
        router.push(`/seo/articles/${articleId}/outline`)
      } else {
        router.push('/seo')
      }
    } catch (e: any) {
      setError(e?.message || '記事の作成に失敗しました')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-white flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl"
      >
        {/* カード型フォーム */}
        <div className="bg-white rounded-3xl sm:rounded-[40px] border border-gray-100 shadow-2xl shadow-blue-500/5 overflow-hidden">
          {/* ヘッダー */}
          <div className="px-6 sm:px-10 pt-8 sm:pt-12 pb-6 sm:pb-8 text-center border-b border-gray-50 relative">
            {/* 使い方ボタン */}
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-black hover:bg-blue-100 transition-all"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              使い方
            </button>

            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-xl shadow-blue-500/30">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              どんな記事を作りますか？
            </h1>
            <p className="text-sm text-gray-400 font-bold mt-2">
              キーワードを入力するだけで、AIが構成から本文まで生成します
            </p>

            {/* Step indicator */}
            <div className="mt-5 flex items-center justify-center gap-2">
              {[
                { id: 1, label: 'Step1 入力' },
                { id: 2, label: 'Step2 プレビュー' },
                { id: 3, label: 'Step3 生成' },
              ].map((s) => {
                const active = (s.id === 1 && step === 1) || (s.id === 2 && step === 2)
                const done = s.id === 1 && step === 2
                return (
                  <div
                    key={s.id}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-colors ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600'
                        : done
                          ? 'bg-blue-50 text-blue-700 border-blue-100'
                          : 'bg-white text-gray-400 border-gray-200'
                    }`}
                  >
                    {s.label}
                  </div>
                )
              })}
            </div>
          </div>

          {/* フォーム */}
          <div className="px-6 sm:px-10 py-6 sm:py-8 space-y-5">
            {/* Step2: 生成前アウトプレビュー */}
            {step === 2 && preview && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
                  <p className="text-xs font-black text-blue-700 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    生成前プレビュー（ここで「成果が出そう」を確認できます）
                  </p>
                  <p className="text-[11px] font-bold text-blue-700/80 mt-1">
                    構成・検索意図・想定読者を確認してから生成できます。必要なら構成編集にも進めます。
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">目標</p>
                    <p className="text-lg font-black text-gray-900 mt-1">10,000字</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">想定読者</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 line-clamp-2">
                      {String(preview.persona || persona || '（未指定：生成時に最適化）')}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">検索意図</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 line-clamp-2">
                      {String(preview.searchIntent || '（推定中）')}
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-gray-900">構成プレビュー</p>
                      <p className="text-[11px] font-bold text-gray-500 mt-1">
                        H2: {Array.isArray(preview.outline?.sections) ? preview.outline.sections.length : 0} 個
                      </p>
                    </div>
                    <span className="text-[10px] font-black px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100 text-gray-500">
                      後で編集OK
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {(Array.isArray(preview.outline?.sections) ? preview.outline.sections : []).slice(0, 12).map((s: any, i: number) => (
                      <div key={i} className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-black text-gray-900 leading-snug">
                            {s?.h2 ? String(s.h2) : `見出し${i + 1}`}
                          </p>
                          {String(s?.intentTag || '').trim() ? (
                            <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black">
                              {String(s.intentTag)}
                            </span>
                          ) : null}
                        </div>
                        {Array.isArray(s?.h3) && s.h3.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {s.h3.slice(0, 6).map((h: any, j: number) => (
                              <li key={j} className="text-xs font-bold text-gray-600">
                                ・{String(h)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                    {Array.isArray(preview.outline?.sections) && preview.outline.sections.length > 12 && (
                      <p className="text-[11px] font-bold text-gray-400">
                        …他 {preview.outline.sections.length - 12} 件（生成後に全文表示）
                      </p>
                    )}
                  </div>
                </div>

                {Array.isArray(preview.outline?.diagramIdeas) && preview.outline.diagramIdeas.length > 0 && (
                  <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                    <p className="text-sm font-black text-gray-900">図解案（自動生成の候補）</p>
                    <div className="mt-3 space-y-2">
                      {preview.outline.diagramIdeas.slice(0, 2).map((d: any, i: number) => (
                        <div key={i} className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                          <p className="text-sm font-black text-gray-900">{String(d?.title || '図解')}</p>
                          <p className="text-xs font-bold text-gray-600 mt-1">{String(d?.description || '')}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] font-bold text-gray-400 mt-3">
                      ※ 図解/サムネ生成は有料プランで利用できます
                    </p>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <>
            {/* メインKW（必須） */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                  メインキーワード <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={fillSample}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 text-purple-600 text-[10px] font-black hover:from-purple-100 hover:to-indigo-100 hover:border-purple-200 transition-all group"
                >
                  <Wand2 className="w-3 h-3 group-hover:rotate-12 transition-transform" />
                  サンプル入力
                </button>
              </div>
              <input
                type="text"
                value={mainKeyword}
                onChange={(e) => setMainKeyword(e.target.value)}
                placeholder="例：AI ライティング ツール"
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-gray-900 font-bold text-base placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                autoFocus
              />
            </div>

            {/* 任意：関連KW・詳細設定 */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs font-black text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
              >
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                詳細設定（任意）
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 space-y-4 overflow-hidden"
                  >
                    {/* 関連KW */}
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                        関連キーワード
                      </label>
                      <textarea
                        value={relatedKeywords}
                        onChange={(e) => setRelatedKeywords(e.target.value)}
                        placeholder="カンマ区切り or 改行で複数入力&#10;例：SEO 記事作成, AIライティング, コンテンツマーケ"
                        rows={3}
                        className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-gray-900 font-bold text-sm placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                      />
                    </div>

                    {/* 想定読者 */}
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                        想定読者
                      </label>
                      <input
                        type="text"
                        value={persona}
                        onChange={(e) => setPersona(e.target.value)}
                        placeholder="例：SEO初心者のマーケ担当"
                        className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-gray-900 font-bold text-sm placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>

                    {/* 文体 */}
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                        文体・トーン
                      </label>
                      <input
                        type="text"
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        placeholder="例：やさしい、専門的、ビジネス"
                        className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-gray-900 font-bold text-sm placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>

                    {/* 独自情報（学習） */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowKnowledge((v) => !v)}
                        className="flex items-center justify-between w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all"
                      >
                        <span className="inline-flex items-center gap-2 text-xs font-black text-gray-700">
                          <BookOpen className="w-4 h-4 text-emerald-600" />
                          独自情報を学習させる（任意）
                        </span>
                        <span className="text-[10px] font-black text-gray-400">
                          {showKnowledge ? '閉じる' : '開く'}
                        </span>
                      </button>

                      <AnimatePresence>
                        {showKnowledge && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="mt-3 space-y-3 overflow-hidden"
                          >
                            <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100">
                              <p className="text-xs font-black text-emerald-800">この情報は次回以降の生成にも反映されます</p>
                              <p className="text-[10px] font-bold text-emerald-700/80 mt-1">{knowledgeHint}</p>
                            </div>

                            <div className="grid gap-3">
                              <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                  タイトル
                                </label>
                                <input
                                  value={knowledgeTitle}
                                  onChange={(e) => setKnowledgeTitle(e.target.value)}
                                  placeholder="例：料金体系（2025/01時点）"
                                  className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-gray-900 font-bold text-sm placeholder:text-gray-300 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                  内容
                                </label>
                                <textarea
                                  value={knowledgeContent}
                                  onChange={(e) => setKnowledgeContent(e.target.value)}
                                  placeholder="ここにコピペでOK（事実ベースの独自情報）"
                                  rows={5}
                                  className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-gray-900 font-bold text-sm placeholder:text-gray-300 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all resize-none"
                                />
                              </div>
                              {knowledgeError && (
                                <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-xs font-bold">
                                  {knowledgeError}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={saveKnowledge}
                                disabled={!canSaveKnowledge || knowledgeBusy}
                                className="h-12 rounded-2xl bg-emerald-600 text-white font-black text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                              >
                                {knowledgeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                学習として保存
                              </button>
                            </div>

                            <div className="pt-2">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                                保存済み（最新）
                              </p>
                              <div className="grid gap-2">
                                {knowledgeLoading ? (
                                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-gray-500 text-xs font-bold inline-flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    読み込み中...
                                  </div>
                                ) : knowledgeItems.length ? (
                                  knowledgeItems.slice(0, 6).map((it) => (
                                    <div
                                      key={it.id}
                                      className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-start justify-between gap-3"
                                    >
                                      <div className="min-w-0">
                                        <p className="text-sm font-black text-gray-900 truncate">{it.title}</p>
                                        <p className="text-xs font-bold text-gray-500 mt-1 line-clamp-2">
                                          {String(it.content || '').slice(0, 140)}
                                          {String(it.content || '').length > 140 ? '…' : ''}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => deleteKnowledge(it.id)}
                                        className="p-2 rounded-xl bg-gray-50 border border-gray-100 hover:bg-red-50 hover:border-red-100 transition-colors text-gray-500 hover:text-red-600"
                                        title="削除"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-gray-400 text-xs font-bold">
                                    まだ保存されていません
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
              </>
            )}

            {/* エラー */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold"
              >
                {error}
              </motion.div>
            )}
          </div>

          {/* CTA */}
          <div className="px-6 sm:px-10 pb-8 sm:pb-10 flex flex-col gap-3">
            {step === 1 ? (
              <button
                onClick={handlePreview}
                disabled={!canSubmit || previewing || loading}
                className="w-full h-14 sm:h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-base sm:text-lg shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-3"
              >
                {previewing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    プレビュー生成中...
                  </>
                ) : (
                  <>
                    アウトラインをプレビュー
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1)
                    setError(null)
                  }}
                  className="w-full h-12 rounded-xl bg-gray-50 border border-gray-100 text-gray-600 font-black text-sm hover:bg-gray-100 transition-colors"
                >
                  入力に戻る
                </button>

                <button
                  onClick={handleStartNow}
                  disabled={!canSubmit || loading}
                  className="w-full h-14 sm:h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-base sm:text-lg shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      生成を開始中...
                    </>
                  ) : (
                    <>
                      このまま生成する
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleEditOutlineFirst}
                  disabled={!canSubmit || loading}
                  className="w-full h-12 rounded-xl bg-white border border-gray-200 text-gray-800 font-black text-sm hover:bg-gray-50 transition-colors"
                >
                  構成を編集してから生成
                </button>
              </>
            )}

            <Link href="/seo/new" className="block">
              <button
                type="button"
                className="w-full h-12 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 font-black text-sm hover:bg-gray-100 transition-colors"
              >
                詳細モードで作成する
              </button>
            </Link>
          </div>
        </div>

        {/* 補足 */}
        <p className="text-center text-xs text-gray-400 font-bold mt-6">
          メインキーワードからAIが自動で見出し構成を生成します。<br />
          構成は後から自由に編集できます。
        </p>
      </motion.div>

      {/* 使い方モーダル */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowHelp(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* ヘッダー */}
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-black text-gray-900">使い方ガイド</h2>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* コンテンツ */}
              <div className="px-6 py-6 overflow-y-auto">
                {/* ステップ */}
                <div className="space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black flex-shrink-0">1</div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900 mb-1">メインキーワードを入力</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        記事で上位表示したいキーワードを入力します。<br />
                        例：「AI ライティング ツール」「転職エージェント おすすめ」
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black flex-shrink-0">2</div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900 mb-1">「アウトラインをプレビュー」をクリック</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        AIがキーワードを分析し、SEOに最適な「構成・検索意図・想定読者」をプレビューします。<br />
                        通常10〜30秒ほどで表示されます。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black flex-shrink-0">3</div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900 mb-1">構成を確認・編集</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        生成された見出し構成を確認し、必要に応じて並び替え・追加・削除ができます。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-black flex-shrink-0">4</div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900 mb-1">本文を生成</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        確定した構成に沿って、AIが各章の本文を生成します。<br />
                        10,000字の記事で約2〜5分かかります。
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-black flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-gray-900 mb-1">完成！</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        完成した記事を確認し、編集・出力（HTML/Wordなど）できます。
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-black text-amber-700 uppercase">Tips</h4>
                  </div>
                  <ul className="text-xs text-amber-800 space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      <span>「サンプル入力」ボタンで、試しにサンプルキーワードを入力できます</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      <span>詳細設定で関連KW・想定読者・文体を指定すると、より最適な記事が生成されます</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500">•</span>
                      <span>より細かい設定は「詳細モードで作成する」から行えます</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* フッター */}
              <div className="px-6 py-4 border-t border-gray-100">
                <button
                  onClick={() => setShowHelp(false)}
                  className="w-full h-12 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors"
                >
                  わかりました！
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}

