'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Upload, Sparkles, CheckCircle, Clock, Download, Zap, Loader2, ArrowRight, Settings, RefreshCw, MessageSquare, FileEdit, Users, Briefcase } from 'lucide-react'
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

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/interview/projects/${projectId}`)
      const data = await res.json()
      setProject(data.project)
    } catch (error) {
      console.error('Failed to fetch project:', error)
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

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-600">プロジェクトが見つかりません</p>
        <Link href="/interview/projects" className="mt-4 inline-block text-orange-600 hover:text-orange-700 font-bold">
          プロジェクト一覧に戻る
        </Link>
      </div>
    )
  }

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
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              バージョン {draft.version}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="font-bold">{draft.wordCount || 0}</span>文字
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              読了時間 {draft.readingTime || 0}分
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 transition-all inline-flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            エクスポート
                          </motion.button>
                        </div>
                      </div>
                      {draft.lead && (
                        <div className="mb-6 p-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border-l-4 border-orange-500">
                          <p className="text-lg font-bold text-slate-800 leading-relaxed">{draft.lead}</p>
                        </div>
                      )}
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

