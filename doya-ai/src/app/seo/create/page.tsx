'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ChevronDown, ChevronUp, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'

/**
 * DeepEditor風シンプル新規作成
 * 1画面＝1つの意思決定
 * 「操作」ではなく「進行」
 */
export default function SeoCreateSimplePage() {
  const router = useRouter()

  // 入力状態
  const [mainKeyword, setMainKeyword] = useState('')
  const [relatedKeywords, setRelatedKeywords] = useState('')
  const [persona, setPersona] = useState('')
  const [tone, setTone] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 処理状態
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = mainKeyword.trim().length >= 1

  async function handleSubmit() {
    if (!canSubmit || loading) return
    setLoading(true)
    setError(null)

    try {
      // 関連KWをカンマ区切りで分割
      const related = relatedKeywords
        .split(/[,、\n]/)
        .map((s) => s.trim())
        .filter(Boolean)

      // 記事を作成（構成生成まで）
      const res = await fetch('/api/seo/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${mainKeyword}に関する記事`, // 仮タイトル（構成生成後に更新可能）
          keywords: [mainKeyword, ...related],
          persona: persona.trim() || undefined,
          tone: tone.trim() || '丁寧',
          targetChars: 10000,
          searchIntent: '',
          llmoOptions: {
            tldr: true,
            conclusionFirst: true,
            faq: true,
            glossary: false,
            comparison: false,
            quotes: true,
            templates: false,
            objections: false,
          },
          autoBundle: true,
          autoStart: true, // 構成生成を即開始
        }),
      })

      const json = await res.json()
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `エラーが発生しました (${res.status})`)
      }

      // ジョブページへ遷移（自動進行）
      const articleId = json.article?.id || json.id
      const jobId = json.jobId || json.article?.jobs?.[0]?.id
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
          <div className="px-6 sm:px-10 pt-8 sm:pt-12 pb-6 sm:pb-8 text-center border-b border-gray-50">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-xl shadow-blue-500/30">
              <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              どんな記事を作りますか？
            </h1>
            <p className="text-sm text-gray-400 font-bold mt-2">
              キーワードを入力するだけで、AIが構成から本文まで生成します
            </p>
          </div>

          {/* フォーム */}
          <div className="px-6 sm:px-10 py-6 sm:py-8 space-y-5">
            {/* メインKW（必須） */}
            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                メインキーワード <span className="text-red-400">*</span>
              </label>
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className="w-full h-14 sm:h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-base sm:text-lg shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  構成を生成中...
                </>
              ) : (
                <>
                  構成を作る
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

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
    </main>
  )
}

