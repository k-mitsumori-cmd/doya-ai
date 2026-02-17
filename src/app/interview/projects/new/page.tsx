'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

const GENRES = [
  { value: 'CASE_STUDY', label: '導入事例・ケーススタディ', icon: 'description' },
  { value: 'PRODUCT_INTERVIEW', label: '製品・サービスインタビュー', icon: 'storefront' },
  { value: 'PERSONA_INTERVIEW', label: '人物インタビュー', icon: 'person' },
  { value: 'PANEL_DISCUSSION', label: '対談・座談会', icon: 'groups' },
  { value: 'EVENT_REPORT', label: 'イベントレポート', icon: 'mic' },
  { value: 'OTHER', label: 'その他', icon: 'article' },
]

const TONES = [
  { value: 'friendly', label: 'フレンドリー' },
  { value: 'professional', label: 'ビジネス' },
  { value: 'casual', label: 'カジュアル' },
  { value: 'formal', label: 'フォーマル' },
]

const pageVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: 'easeOut' } }
}

const formVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut', staggerChildren: 0.06 } }
}

const fieldVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }
}

export default function NewProject() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [intervieweeName, setIntervieweeName] = useState('')
  const [intervieweeRole, setIntervieweeRole] = useState('')
  const [intervieweeCompany, setIntervieweeCompany] = useState('')
  const [genre, setGenre] = useState('')
  const [theme, setTheme] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [tone, setTone] = useState('friendly')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('プロジェクト名を入力してください')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/interview/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          intervieweeName: intervieweeName || null,
          intervieweeRole: intervieweeRole || null,
          intervieweeCompany: intervieweeCompany || null,
          genre: genre || null,
          theme: theme || null,
          targetAudience: targetAudience || null,
          tone,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.error || '作成に失敗しました')
        return
      }

      // サムネイル生成をバックグラウンドで実行（fire-and-forget）
      fetch(`/api/interview/projects/${data.project.id}/thumbnail`, { method: 'POST' }).catch(() => {})

      // 素材アップロード画面へ遷移
      router.push(`/interview/projects/${data.project.id}/materials`)
    } catch {
      setError('ネットワークエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div className="max-w-2xl mx-auto px-4 sm:px-0" variants={pageVariants} initial="hidden" animate="show">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-600">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">新規プロジェクト作成</h1>
          <p className="text-sm text-slate-500 mt-0.5">インタビュー記事プロジェクトの設定</p>
        </div>
      </div>

      <motion.form onSubmit={handleSubmit} className="space-y-6" variants={formVariants} initial="hidden" animate="show">
        {/* プロジェクト名 */}
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
            <span className="material-symbols-outlined text-[#7f19e6] text-lg">edit</span>
            プロジェクト名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 山田太郎氏インタビュー記事"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] outline-none transition-all"
          />
        </div>

        {/* ジャンル選択 */}
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
            <span className="material-symbols-outlined text-[#7f19e6] text-lg">category</span>
            ジャンル
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {GENRES.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setGenre(genre === g.value ? '' : g.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition-all ${
                  genre === g.value
                    ? 'border-[#7f19e6] bg-[#7f19e6]/5 text-[#7f19e6] font-medium'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className={`material-symbols-outlined text-lg ${genre === g.value ? 'text-[#7f19e6]' : 'text-slate-400'}`}>
                  {g.icon}
                </span>
                <span>{g.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* インタビュー対象者 */}
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
            <span className="material-symbols-outlined text-[#7f19e6] text-lg">person</span>
            インタビュー対象者（任意）
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">badge</span>
              <input
                type="text"
                value={intervieweeName}
                onChange={(e) => setIntervieweeName(e.target.value)}
                placeholder="名前"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] transition-all"
              />
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">business</span>
              <input
                type="text"
                value={intervieweeCompany}
                onChange={(e) => setIntervieweeCompany(e.target.value)}
                placeholder="会社名"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] transition-all"
              />
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">work</span>
              <input
                type="text"
                value={intervieweeRole}
                onChange={(e) => setIntervieweeRole(e.target.value)}
                placeholder="役職"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] transition-all"
              />
            </div>
          </div>
        </div>

        {/* テーマ */}
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
            <span className="material-symbols-outlined text-[#7f19e6] text-lg">topic</span>
            取材テーマ（任意）
          </label>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="例: DX推進の取り組みと成果について"
            rows={2}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] resize-none transition-all"
          />
        </div>

        {/* 想定読者 */}
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
            <span className="material-symbols-outlined text-[#7f19e6] text-lg">groups</span>
            想定読者（任意）
          </label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="例: IT企業の経営者・決裁者"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#7f19e6]/20 focus:border-[#7f19e6] transition-all"
          />
        </div>

        {/* トーン */}
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
            <span className="material-symbols-outlined text-[#7f19e6] text-lg">record_voice_over</span>
            トーン
          </label>
          <div className="flex gap-2 flex-wrap">
            {TONES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTone(t.value)}
                className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                  tone === t.value
                    ? 'border-[#7f19e6] bg-[#7f19e6]/5 text-[#7f19e6] font-medium'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* エラー */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-200">
            <span className="material-symbols-outlined text-lg">error</span>
            {error}
          </div>
        )}

        {/* 送信 */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 text-sm transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
            キャンセル
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-[#7f19e6] text-white rounded-lg hover:bg-[#6b12c9] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                作成中...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
                作成して素材アップへ
              </>
            )}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}