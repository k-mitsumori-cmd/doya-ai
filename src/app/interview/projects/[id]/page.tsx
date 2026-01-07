'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { FileText, Upload, Sparkles, CheckCircle, Clock, Download, Zap, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function InterviewProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'transcription' | 'draft' | 'review'>('overview')

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

  const handleGenerateArticle = async () => {
    if (!project) return

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
        body: JSON.stringify({ projectId }),
      })
      if (!draftRes.ok) throw new Error('記事生成に失敗しました')

      await fetchProject() // 再取得
      setActiveTab('draft')
    } catch (error) {
      console.error('Failed to generate article:', error)
      alert(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    } finally {
      setProcessing(false)
      setProcessingStep('')
    }
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

      {/* アクションボタン（素材がある場合） */}
      {project.materials && project.materials.length > 0 && !project.drafts?.length && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-6 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border-2 border-orange-200 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-orange-900 mb-2">記事を生成しましょう</h3>
              <p className="text-orange-700">
                アップロードした素材から自動で記事を生成します
              </p>
            </div>
            <motion.button
              onClick={handleGenerateArticle}
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
            <h3 className="text-lg font-black text-slate-900 mb-4">文字起こし</h3>
            {project.transcriptions?.length > 0 ? (
              <div className="space-y-4">
                {project.transcriptions.map((transcription: any) => (
                  <div key={transcription.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-600 mb-2">
                      {transcription.provider || 'manual'} • {transcription.text.length}文字
                    </p>
                    <p className="text-slate-700 whitespace-pre-wrap">{transcription.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600">文字起こしがありません</p>
            )}
          </div>
        )}

        {activeTab === 'draft' && (
          <div>
            <h3 className="text-lg font-black text-slate-900 mb-4">記事ドラフト</h3>
            {project.drafts?.length > 0 ? (
              <div className="space-y-4">
                {project.drafts.map((draft: any) => (
                  <div key={draft.id} className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-black text-slate-900">{draft.title || '無題'}</h4>
                        <p className="text-sm text-slate-600">
                          バージョン {draft.version} • {draft.wordCount || 0}文字 • 読了時間 {draft.readingTime || 0}分
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-4 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors">
                          <Download className="w-4 h-4 inline mr-2" />
                          エクスポート
                        </button>
                      </div>
                    </div>
                    {draft.lead && (
                      <p className="text-lg font-bold text-slate-700 mb-4">{draft.lead}</p>
                    )}
                    <div className="text-slate-700 whitespace-pre-wrap">{draft.content}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-600">ドラフトがありません</p>
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

