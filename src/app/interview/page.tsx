'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, Upload, FileText, Sparkles, ArrowRight, HelpCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function InterviewPage() {
  const router = useRouter()
  const [step, setStep] = useState<'start' | 'planning' | 'upload' | 'transcribe' | 'edit' | 'review'>('start')
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    intervieweeName: '',
    intervieweeRole: '',
    intervieweeCompany: '',
    theme: '',
    purpose: '',
    targetAudience: '',
    tone: 'friendly',
    mediaType: 'blog',
  })

  const handleCreateProject = async () => {
    if (!formData.title.trim()) {
      alert('プロジェクト名を入力してください')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/interview/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        throw new Error('Failed to create project')
      }

      const data = await res.json()
      router.push(`/interview/projects/${data.project.id}`)
    } catch (error) {
      console.error('Failed to create project:', error)
      alert('プロジェクトの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* ヒーローセクション */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 mb-6 shadow-lg shadow-orange-500/20"
        >
          <Mic className="w-10 h-10 text-white" />
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
          ドヤインタビューAI
        </h1>
        <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
          インタビュー素材から企画立案、文字起こし、編集、校閲まで一気通貫で高品質な記事を自動生成
        </p>
      </div>

      {/* ワークフロー説明 */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.06,
            },
          },
        }}
        className="grid md:grid-cols-3 gap-6 mb-12"
      >
        {[
          { icon: Sparkles, title: '企画立案', desc: 'AIが複数の企画案と質問リストを提案' },
          { icon: Upload, title: '素材アップロード', desc: '音声・動画・テキストをアップロード' },
          { icon: FileText, title: '記事生成', desc: '自動文字起こしから記事ドラフトまで' },
        ].map((item, idx) => (
          <motion.div
            key={idx}
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.3, ease: 'easeOut' },
              },
            }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center mb-4">
              <item.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2">{item.title}</h3>
            <p className="text-sm text-slate-600">{item.desc}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* 新規プロジェクト作成 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.2 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8"
      >
        <h2 className="text-2xl font-black text-slate-900 mb-6">新規プロジェクトを作成</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              プロジェクト名
            </label>
            <input
              type="text"
              placeholder="例：新商品インタビュー"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              インタビュー対象者
            </label>
            <input
              type="text"
              placeholder="例：田中太郎（株式会社○○ 代表取締役）"
              value={formData.intervieweeName}
              onChange={(e) => setFormData({ ...formData, intervieweeName: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              取材テーマ・目的
            </label>
            <textarea
              placeholder="例：新商品の開発背景や想いを伝える記事を作成したい"
              rows={4}
              value={formData.theme}
              onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all resize-none"
            />
          </div>
          <div className="flex items-center gap-4">
            <motion.button
              onClick={handleCreateProject}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-black rounded-xl hover:shadow-lg hover:shadow-orange-500/20 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  作成中...
                </>
              ) : (
                <>
                  企画提案を生成
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
            <Link
              href="/interview/projects"
              className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              既存プロジェクト
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ヘルプ */}
      <div className="mt-12 p-6 bg-slate-50 rounded-2xl border border-slate-200">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-black text-slate-900 mb-2">使い方</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              1. プロジェクト名とインタビュー対象者、取材テーマを入力<br />
              2. AIが企画案と質問リストを提案します<br />
              3. 音声・動画・テキストをアップロードして文字起こし<br />
              4. 構成案を作成し、記事ドラフトを生成<br />
              5. 校閲・修正を経て最終記事を出力
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

