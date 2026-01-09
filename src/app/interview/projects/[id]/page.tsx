'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Upload, Sparkles, CheckCircle, Clock, Download, Zap, Loader2, ArrowRight, Settings, RefreshCw, MessageSquare, FileEdit, Users, Briefcase, Edit, Save, X, FileDown, FileCode, FileType, AlertCircle } from 'lucide-react'
import Link from 'next/link'

type ArticleType = 'INTERVIEW' | 'BUSINESS_REPORT' | 'INTERNAL_INTERVIEW' | 'CASE_STUDY'
type DisplayFormat = 'QA' | 'MONOLOGUE'

export default function InterviewProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'transcription' | 'draft' | 'review'>('overview')
  const [showArticleTypeSelector, setShowArticleTypeSelector] = useState(false)
  const [selectedArticleType, setSelectedArticleType] = useState<ArticleType>('INTERVIEW')
  const [selectedDisplayFormat, setSelectedDisplayFormat] = useState<DisplayFormat>('QA')
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState<string>('')
  const [showExportMenu, setShowExportMenu] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchProject = async () => {
    try {
      setError(null)
      
      // ゲストIDを取得
      let guestId = null
      if (typeof window !== 'undefined') {
        guestId = localStorage.getItem('interview-guest-id')
      }
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (guestId) {
        headers['x-guest-id'] = guestId
      }
      
      const res = await fetch(`/api/interview/projects/${projectId}`, {
        headers,
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData.error || `HTTP error! status: ${res.status}`
        
        if (res.status === 401) {
          throw new Error('認証が必要です。ログインしてください。')
        } else if (res.status === 404) {
          throw new Error('プロジェクトが見つかりません。')
        } else {
          throw new Error(errorMessage)
        }
      }
      
      const data = await res.json()
      
      if (!data.project) {
        throw new Error('プロジェクトデータが取得できませんでした')
      }
      
      setProject(data.project)
    } catch (error) {
      console.error('Failed to fetch project:', error)
      const errorMessage = error instanceof Error ? error.message : 'プロジェクトの取得に失敗しました'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) {
      fetchProject()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const handleGenerateArticle = async (articleType?: ArticleType, displayFormat?: DisplayFormat) => {
    if (!project) return

    const finalArticleType = articleType || selectedArticleType
    const finalDisplayFormat = displayFormat || selectedDisplayFormat

    setProcessing(true)
    try {
      // 1. 構成案生成
      if (!project.outline) {
        setProcessingStep('構成案を生成中...')
        const outlineRes = await fetch('/api/interview/outline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        })
        if (!outlineRes.ok) throw new Error('構成案生成に失敗しました')
        await fetchProject() // 再取得
      }

      // 2. 記事生成
      setProcessingStep('記事を生成中...')
      const draftRes = await fetch('/api/interview/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          articleType: finalArticleType,
          displayFormat: finalDisplayFormat,
        }),
      })
      if (!draftRes.ok) throw new Error('記事生成に失敗しました')

      await fetchProject() // 再取得
      setActiveTab('draft')
      setShowArticleTypeSelector(false)
    } catch (error) {
      console.error('Failed to generate article:', error)
      alert(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    } finally {
      setProcessing(false)
      setProcessingStep('')
    }
  }

  const handleRegenerateArticle = async () => {
    setShowArticleTypeSelector(true)
  }

  const handleExport = (draft: any, format: 'markdown' | 'html' | 'txt') => {
    let content = ''
    let filename = ''
    let mimeType = ''

    if (format === 'markdown') {
      content = `# ${draft.title || '無題'}\n\n${draft.lead ? `> ${draft.lead}\n\n` : ''}${draft.content}`
      filename = `${draft.title || 'article'}-${Date.now()}.md`
      mimeType = 'text/markdown'
    } else if (format === 'html') {
      content = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${draft.title || '無題'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.8; color: #333; }
    h1 { color: #f97316; border-bottom: 3px solid #f97316; padding-bottom: 0.5rem; }
    h2 { color: #ea580c; margin-top: 2rem; }
    blockquote { border-left: 4px solid #f97316; padding-left: 1rem; margin-left: 0; color: #666; font-style: italic; }
    p { margin: 1rem 0; }
    .meta { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <h1>${draft.title || '無題'}</h1>
  <div class="meta">
    ${draft.wordCount ? `文字数: ${draft.wordCount.toLocaleString()}文字 | ` : ''}
    ${draft.readingTime ? `読了時間: ${draft.readingTime}分 | ` : ''}
    バージョン: ${draft.version}
  </div>
  ${draft.lead ? `<blockquote>${draft.lead}</blockquote>` : ''}
  <div>${draft.content.split('\n').map((line: string) => {
    if (line.startsWith('Q:') || line.startsWith('Q：')) {
      return `<div style="background: #eff6ff; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; border-left: 4px solid #3b82f6;"><strong style="color: #1e40af;">${line}</strong></div>`
    }
    if (line.startsWith('A:') || line.startsWith('A：')) {
      return `<div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; border-left: 4px solid #64748b;">${line}</div>`
    }
    return `<p>${line || '&nbsp;'}</p>`
  }).join('')}</div>
</body>
</html>`
      filename = `${draft.title || 'article'}-${Date.now()}.html`
      mimeType = 'text/html'
    } else {
      content = `${draft.title || '無題'}\n\n${draft.lead ? `${draft.lead}\n\n` : ''}${draft.content}`
      filename = `${draft.title || 'article'}-${Date.now()}.txt`
      mimeType = 'text/plain'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowExportMenu(null)
  }

  const handleStartEdit = (draft: any) => {
    setEditingDraftId(draft.id)
    setEditedContent(draft.content)
  }

  const handleSaveEdit = async (draftId: string) => {
    try {
      const res = await fetch(`/api/interview/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent }),
      })
      if (res.ok) {
        await fetchProject()
        setEditingDraftId(null)
        setEditedContent('')
      } else {
        const errorData = await res.json().catch(() => ({}))
        alert(`保存に失敗しました: ${errorData.error || '不明なエラー'}`)
      }
    } catch (error) {
      console.error('Failed to save draft:', error)
      alert('保存に失敗しました')
    }
  }

  const handleCancelEdit = () => {
    setEditingDraftId(null)
    setEditedContent('')
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-600">読み込み中...</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-orange-100 mb-6">
            <AlertCircle className="w-12 h-12 text-orange-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-4">エラーが発生しました</h2>
          <p className="text-slate-600 mb-6">
            {error || 'プロジェクトが見つかりません'}
          </p>
        </div>
        <div className="flex gap-4 justify-center">
          <motion.button
            onClick={() => {
              setError(null)
              setLoading(true)
              fetchProject()
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            再試行する
          </motion.button>
          <Link
            href="/interview/projects"
            className="px-6 py-3 bg-slate-200 text-slate-700 font-black rounded-xl hover:bg-slate-300 transition-all inline-flex items-center gap-2"
          >
            <ArrowRight className="w-5 h-5 rotate-180" />
            プロジェクト一覧に戻る
          </Link>
        </div>
      </div>
    )
  }

  // エクスポートメニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showExportMenu && !(e.target as Element).closest('.export-menu-container')) {
        setShowExportMenu(null)
      }
    }
    if (showExportMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showExportMenu])

  return (
    <div className="max-w-7xl mx-auto">
      {/* ヘッダー */}
      <div className="mb-8">
        <Link href="/interview/projects" className="text-sm text-slate-600 hover:text-orange-600 mb-4 inline-block">
          ← プロジェクト一覧に戻る
        </Link>
        <h1 className="text-3xl font-black text-slate-900 mb-2">{project.title}</h1>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span className="px-3 py-1 bg-slate-100 rounded-lg font-bold">{project.status}</span>
          {project.intervieweeName && <span>対象者: {project.intervieweeName}</span>}
          <span>更新: {new Date(project.updatedAt).toLocaleDateString('ja-JP')}</span>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {[
          { id: 'overview', label: '概要', icon: FileText },
          { id: 'materials', label: '素材', icon: Upload },
          { id: 'transcription', label: '文字起こし', icon: FileText },
          { id: 'draft', label: 'ドラフト', icon: Sparkles },
          { id: 'review', label: '校閲', icon: CheckCircle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 記事タイプ選択モーダル */}
      <AnimatePresence>
        {showArticleTypeSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowArticleTypeSelector(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8">
                <h2 className="text-3xl font-black text-slate-900 mb-2">記事タイプを選択</h2>
                <p className="text-slate-600 mb-8">記事の形式と表示スタイルを選択してください</p>

                {/* 記事タイプ選択 */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <FileEdit className="w-5 h-5" />
                    記事タイプ
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { type: 'INTERVIEW' as ArticleType, label: 'インタビュー記事', icon: MessageSquare, desc: '質問と回答の形式で構成' },
                      { type: 'BUSINESS_REPORT' as ArticleType, label: '商談レポート', icon: Briefcase, desc: '商談内容を報告書形式で' },
                      { type: 'INTERNAL_INTERVIEW' as ArticleType, label: '社内インタビュー', icon: Users, desc: '社内メンバーへのインタビュー' },
                      { type: 'CASE_STUDY' as ArticleType, label: '事例取材記事', icon: FileText, desc: '使用感などの事例としてまとめる' },
                    ].map((item) => (
                      <motion.button
                        key={item.type}
                        onClick={() => setSelectedArticleType(item.type)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-6 rounded-2xl border-2 transition-all text-left ${
                          selectedArticleType === item.type
                            ? 'border-orange-500 bg-orange-50 shadow-lg'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <item.icon className={`w-8 h-8 mb-3 ${selectedArticleType === item.type ? 'text-orange-600' : 'text-slate-400'}`} />
                        <h4 className="font-black text-slate-900 mb-1">{item.label}</h4>
                        <p className="text-sm text-slate-600">{item.desc}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* 表示形式選択 */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    表示形式
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { format: 'QA' as DisplayFormat, label: 'Q&A形式', desc: '質問と回答を明確に分けて表示' },
                      { format: 'MONOLOGUE' as DisplayFormat, label: '一人で喋っている形式', desc: '回答者の発言を自然な文章として連続表示' },
                    ].map((item) => (
                      <motion.button
                        key={item.format}
                        onClick={() => setSelectedDisplayFormat(item.format)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-6 rounded-2xl border-2 transition-all text-left ${
                          selectedDisplayFormat === item.format
                            ? 'border-purple-500 bg-purple-50 shadow-lg'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <h4 className="font-black text-slate-900 mb-1">{item.label}</h4>
                        <p className="text-sm text-slate-600">{item.desc}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex gap-4 justify-end">
                  <button
                    onClick={() => setShowArticleTypeSelector(false)}
                    className="px-6 py-3 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    キャンセル
                  </button>
                  <motion.button
                    onClick={() => handleGenerateArticle()}
                    disabled={processing}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {processingStep}
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        記事を生成する
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* アクションボタン（素材がある場合） */}
      {project.materials && project.materials.length > 0 && project.transcriptions && project.transcriptions.length > 0 && !project.drafts?.length && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-8 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 rounded-3xl border-2 border-orange-200 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-orange-900 mb-2 flex items-center gap-2">
                <Sparkles className="w-6 h-6" />
                記事を生成しましょう
              </h3>
              <p className="text-orange-700 font-medium">
                文字起こしが完了しました。記事タイプと表示形式を選択して記事を生成します
              </p>
            </div>
            <motion.button
              onClick={() => setShowArticleTypeSelector(true)}
              disabled={processing}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-2xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {processingStep}
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  記事を生成する
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* コンテンツ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 mb-2">基本情報</h3>
              <dl className="space-y-2">
                {project.genre && (
                  <div>
                    <dt className="text-sm font-bold text-slate-600">インタビュージャンル</dt>
                    <dd className="text-slate-900">
                      {project.genre === 'CASE_STUDY' && '事例のインタビュー'}
                      {project.genre === 'PRODUCT_INTERVIEW' && '商品インタビュー'}
                      {project.genre === 'PERSONA_INTERVIEW' && 'ペルソナインタビュー'}
                      {project.genre === 'OTHER' && 'その他'}
                      {!['CASE_STUDY', 'PRODUCT_INTERVIEW', 'PERSONA_INTERVIEW', 'OTHER'].includes(project.genre) && project.genre}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-bold text-slate-600">インタビュー対象者</dt>
                  <dd className="text-slate-900">{project.intervieweeName || '未設定'}</dd>
                </div>
                {project.intervieweeRole && (
                  <div>
                    <dt className="text-sm font-bold text-slate-600">役職・職業</dt>
                    <dd className="text-slate-900">{project.intervieweeRole}</dd>
                  </div>
                )}
                {project.intervieweeCompany && (
                  <div>
                    <dt className="text-sm font-bold text-slate-600">所属企業</dt>
                    <dd className="text-slate-900">{project.intervieweeCompany}</dd>
                  </div>
                )}
              </dl>
            </div>
            {project.theme && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">取材テーマ</h3>
                <p className="text-slate-700">{project.theme}</p>
              </div>
            )}
            {project.purpose && (
              <div>
                <h3 className="text-lg font-black text-slate-900 mb-2">目的</h3>
                <p className="text-slate-700">{project.purpose}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'materials' && (
          <div>
            <h3 className="text-lg font-black text-slate-900 mb-4">アップロード済み素材</h3>
            <div className="space-y-4">
              {project.materials?.length > 0 ? (
                project.materials.map((material: any) => (
                  <div key={material.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{material.fileName}</p>
                        <p className="text-sm text-slate-600">
                          {material.type} • {material.fileSize ? `${(material.fileSize / 1024 / 1024).toFixed(2)} MB` : 'サイズ不明'}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">
                        {material.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-600">素材がアップロードされていません</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'transcription' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-slate-900">文字起こし</h3>
              {project.transcriptions && project.transcriptions.length > 0 && !project.drafts?.length && (
                <motion.button
                  onClick={() => setShowArticleTypeSelector(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  記事を生成する
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
            {project.transcriptions?.length > 0 ? (
              <div className="space-y-6">
                {project.transcriptions.map((transcription: any) => (
                  <motion.div
                    key={transcription.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 bg-gradient-to-br from-white to-slate-50 rounded-3xl border-2 border-slate-200 shadow-xl"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-black rounded-full">
                          {transcription.provider || 'manual'}
                        </span>
                        <span className="text-sm text-slate-600 font-medium">
                          {transcription.text.length.toLocaleString()}文字
                        </span>
                      </div>
                    </div>
                    <div className="prose prose-slate max-w-none">
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-base">
                        {transcription.text}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg font-medium">文字起こしがありません</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'draft' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-slate-900">記事ドラフト</h3>
              {project.drafts?.length > 0 && project.transcriptions && project.transcriptions.length > 0 && (
                <motion.button
                  onClick={handleRegenerateArticle}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-black rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  別の形式で再生成
                </motion.button>
              )}
            </div>
            {project.drafts?.length > 0 ? (
              <div className="space-y-6">
                {project.drafts.map((draft: any) => {
                  const articleTypeLabels: Record<string, string> = {
                    INTERVIEW: 'インタビュー記事',
                    BUSINESS_REPORT: '商談レポート',
                    INTERNAL_INTERVIEW: '社内インタビュー',
                    CASE_STUDY: '事例取材記事',
                  }
                  const displayFormatLabels: Record<string, string> = {
                    QA: 'Q&A形式',
                    MONOLOGUE: '一人で喋っている形式',
                  }

                  return (
                    <motion.div
                      key={draft.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-8 bg-gradient-to-br from-white to-slate-50 rounded-3xl border-2 border-slate-200 shadow-xl"
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h4 className="text-2xl font-black text-slate-900">{draft.title || '無題'}</h4>
                            {draft.articleType && (
                              <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-black rounded-full">
                                {articleTypeLabels[draft.articleType] || draft.articleType}
                              </span>
                            )}
                            {draft.displayFormat && (
                              <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-black rounded-full">
                                {displayFormatLabels[draft.displayFormat] || draft.displayFormat}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                              <FileText className="w-4 h-4 text-slate-600" />
                              <span className="font-black text-slate-700">バージョン {draft.version}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                              <span className="font-black text-blue-700">{draft.wordCount?.toLocaleString() || 0}</span>
                              <span className="text-blue-600">文字</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
                              <Clock className="w-4 h-4 text-purple-600" />
                              <span className="font-black text-purple-700">{draft.readingTime || 0}</span>
                              <span className="text-purple-600">分</span>
                            </div>
                            {draft.wordCount && (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                                <span className="text-emerald-600 text-xs">読みやすさ</span>
                                <span className="font-black text-emerald-700">
                                  {Math.min(100, Math.round((draft.wordCount / 2000) * 100))}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 relative">
                          {editingDraftId === draft.id ? (
                            <>
                              <motion.button
                                onClick={() => handleSaveEdit(draft.id)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black rounded-xl shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all inline-flex items-center gap-2"
                              >
                                <Save className="w-4 h-4" />
                                保存
                              </motion.button>
                              <motion.button
                                onClick={handleCancelEdit}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-5 py-2.5 bg-slate-500 text-white font-black rounded-xl hover:bg-slate-600 transition-all inline-flex items-center gap-2"
                              >
                                <X className="w-4 h-4" />
                                キャンセル
                              </motion.button>
                            </>
                          ) : (
                            <>
                              <motion.button
                                onClick={() => handleStartEdit(draft)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-black rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all inline-flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                編集
                              </motion.button>
                              <div className="relative export-menu-container">
                                <motion.button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowExportMenu(showExportMenu === draft.id ? null : draft.id)
                                  }}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-2"
                                >
                                  <Download className="w-4 h-4" />
                                  エクスポート
                                </motion.button>
                                {showExportMenu === draft.id && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border-2 border-slate-200 py-2 z-50 min-w-[200px]"
                                  >
                                    <button
                                      onClick={() => handleExport(draft, 'markdown')}
                                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
                                    >
                                      <FileCode className="w-5 h-5 text-purple-500" />
                                      <span className="font-bold text-slate-900">Markdown</span>
                                    </button>
                                    <button
                                      onClick={() => handleExport(draft, 'html')}
                                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
                                    >
                                      <FileType className="w-5 h-5 text-blue-500" />
                                      <span className="font-bold text-slate-900">HTML</span>
                                    </button>
                                    <button
                                      onClick={() => handleExport(draft, 'txt')}
                                      className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
                                    >
                                      <FileDown className="w-5 h-5 text-slate-500" />
                                      <span className="font-bold text-slate-900">テキスト</span>
                                    </button>
                                  </motion.div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {draft.lead && (
                        <div className="mb-6 p-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border-l-4 border-orange-500">
                          <p className="text-lg font-bold text-slate-800 leading-relaxed">{draft.lead}</p>
                        </div>
                      )}
                      {editingDraftId === draft.id ? (
                        <div className="space-y-4">
                          <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="w-full min-h-[400px] p-6 border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 leading-relaxed text-base font-medium resize-y"
                            placeholder="記事の内容を編集..."
                          />
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="font-bold">{editedContent.length.toLocaleString()}</span>文字
                            <span className="text-slate-400">|</span>
                            <span>読了時間: {Math.ceil(editedContent.length / 400)}分</span>
                          </div>
                        </div>
                      ) : (
                        <div className="prose prose-slate max-w-none">
                          <div className="text-slate-700 whitespace-pre-wrap leading-relaxed text-base">
                            {draft.content.split('\n').map((line: string, idx: number) => {
                              // Q&A形式の場合は、Q: と A: をスタイリング
                              if (draft.displayFormat === 'QA') {
                                if (line.startsWith('Q:') || line.startsWith('Q：')) {
                                  return (
                                    <div key={idx} className="mb-4 p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500">
                                      <p className="font-black text-blue-900 mb-2">{line}</p>
                                    </div>
                                  )
                                }
                                if (line.startsWith('A:') || line.startsWith('A：')) {
                                  return (
                                    <div key={idx} className="mb-6 p-4 bg-slate-50 rounded-xl border-l-4 border-slate-400">
                                      <p className="text-slate-800 leading-relaxed">{line}</p>
                                    </div>
                                  )
                                }
                              }
                              return <p key={idx} className="mb-4 leading-relaxed">{line || '\u00A0'}</p>
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <Sparkles className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 text-lg font-medium">ドラフトがありません</p>
                {project.transcriptions && project.transcriptions.length > 0 && (
                  <motion.button
                    onClick={() => setShowArticleTypeSelector(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="mt-6 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-2"
                  >
                    <Zap className="w-5 h-5" />
                    記事を生成する
                  </motion.button>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'review' && (
          <div>
            <h3 className="text-lg font-black text-slate-900 mb-4">校閲結果</h3>
            {project.reviews?.length > 0 ? (
              <div className="space-y-4">
                {project.reviews.map((review: any) => (
                  <div key={review.id} className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-bold text-slate-900">校閲レポート</p>
                        <p className="text-sm text-slate-600">
                          スコア: {review.score || 'N/A'} / 読みやすさ: {review.readabilityScore || 'N/A'}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(review.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                    <div className="text-slate-700 whitespace-pre-wrap">{review.report}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600">校閲結果がありません</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

