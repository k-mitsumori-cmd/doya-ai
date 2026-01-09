'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lightbulb, Sparkles, ArrowRight, Loader2, CheckCircle2, FileText, Target, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function InterviewPlanningPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [proposals, setProposals] = useState<any[]>([])
  const [formData, setFormData] = useState({
    genre: '',
    intervieweeName: '',
    intervieweeRole: '',
    intervieweeCompany: '',
    intervieweeBio: '',
    theme: '',
    purpose: '',
    targetAudience: '',
    tone: 'friendly',
    mediaType: 'blog',
  })

  const handleGenerateProposals = async () => {
    if (!formData.genre || !formData.intervieweeName.trim() || !formData.theme.trim()) {
      alert('インタビュージャンル、インタビュー対象者、取材テーマを入力してください')
      return
    }

    setLoading(true)
    try {
      // まずプロジェクトを作成
      const projectRes = await fetch('/api/interview/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${formData.intervieweeName} インタビュー企画`,
          genre: formData.genre,
          intervieweeName: formData.intervieweeName,
          intervieweeRole: formData.intervieweeRole,
          intervieweeCompany: formData.intervieweeCompany,
          intervieweeBio: formData.intervieweeBio,
          theme: formData.theme,
          purpose: formData.purpose,
          targetAudience: formData.targetAudience,
          tone: formData.tone,
          mediaType: formData.mediaType,
          status: 'PLANNING',
        }),
      })

      if (!projectRes.ok) throw new Error('プロジェクト作成に失敗しました')
      const projectData = await projectRes.json()
      const projectId = projectData.project.id

      // 企画提案を生成
      const proposalsRes = await fetch('/api/interview/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          ...formData,
        }),
      })

      if (!proposalsRes.ok) throw new Error('企画提案の生成に失敗しました')
      const proposalsData = await proposalsRes.json()
      setProposals(proposalsData.proposals || [])

      // プロジェクトIDを保存（後で使用）
      ;(window as any).__lastPlanningProjectId = projectId
    } catch (error) {
      console.error('Failed to generate proposals:', error)
      alert(`エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectProposal = (proposal: any) => {
    const projectId = (window as any).__lastPlanningProjectId
    if (projectId) {
      router.push(`/interview/projects/${projectId}?proposal=${encodeURIComponent(JSON.stringify(proposal))}`)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* ヒーローセクション */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 mb-6 shadow-2xl shadow-purple-500/30"
        >
          <Lightbulb className="w-12 h-12 text-white" />
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
          企画立案
        </h1>
        <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
          AIが複数の企画案と質問リストを自動生成します
        </p>
      </motion.div>

      {/* 入力フォーム */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 mb-8"
      >
        <h2 className="text-2xl font-black text-slate-900 mb-6">インタビュー情報を入力</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              インタビュージャンル <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
            >
              <option value="">選択してください</option>
              <option value="CASE_STUDY">事例のインタビュー</option>
              <option value="PRODUCT_INTERVIEW">商品インタビュー</option>
              <option value="PERSONA_INTERVIEW">ペルソナインタビュー</option>
              <option value="OTHER">その他</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              インタビュー対象者 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="例：田中太郎"
              value={formData.intervieweeName}
              onChange={(e) => setFormData({ ...formData, intervieweeName: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              役職・職業
            </label>
            <input
              type="text"
              placeholder="例：代表取締役"
              value={formData.intervieweeRole}
              onChange={(e) => setFormData({ ...formData, intervieweeRole: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              所属企業
            </label>
            <input
              type="text"
              placeholder="例：株式会社○○"
              value={formData.intervieweeCompany}
              onChange={(e) => setFormData({ ...formData, intervieweeCompany: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              想定読者
            </label>
            <input
              type="text"
              placeholder="例：一般消費者、業界関係者"
              value={formData.targetAudience}
              onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              取材テーマ・目的 <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder="例：新商品の開発背景や想いを伝える記事を作成したい"
              rows={4}
              value={formData.theme}
              onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              トーン
            </label>
            <select
              value={formData.tone}
              onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
            >
              <option value="friendly">親しみやすい</option>
              <option value="professional">専門的</option>
              <option value="casual">カジュアル</option>
              <option value="formal">フォーマル</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              掲載媒体
            </label>
            <select
              value={formData.mediaType}
              onChange={(e) => setFormData({ ...formData, mediaType: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
            >
              <option value="blog">ブログ</option>
              <option value="news">ニュース</option>
              <option value="sns">SNS</option>
              <option value="pr">プレスリリース</option>
              <option value="other">その他</option>
            </select>
          </div>
        </div>

        <motion.button
          onClick={handleGenerateProposals}
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="mt-8 w-full px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white font-black rounded-2xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all inline-flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              AIが企画案を生成中...
            </>
          ) : (
            <>
              <Sparkles className="w-6 h-6" />
              企画案を生成する
              <ArrowRight className="w-6 h-6" />
            </>
          )}
        </motion.button>
      </motion.div>

      {/* 企画案一覧 */}
      {proposals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-black text-slate-900">生成された企画案</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {proposals.map((proposal, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-6 bg-white rounded-2xl border-2 border-slate-200 hover:border-purple-300 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={() => handleSelectProposal(proposal)}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-black text-slate-900 flex-1 group-hover:text-purple-600 transition-colors">
                    {proposal.title}
                  </h3>
                  <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
                <p className="text-slate-600 mb-4 line-clamp-2">{proposal.summary}</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Target className="w-4 h-4" />
                    <span className="font-bold">価値:</span>
                    <span>{proposal.value}</span>
                  </div>
                  {proposal.questions && proposal.questions.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-slate-500">
                      <FileText className="w-4 h-4 mt-0.5" />
                      <div>
                        <span className="font-bold">質問数:</span>
                        <span> {proposal.questions.length}個</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

