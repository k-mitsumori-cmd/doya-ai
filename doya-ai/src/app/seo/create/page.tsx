'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ChevronDown, ChevronUp, ArrowRight, Loader2, Wand2, HelpCircle, X, CheckCircle2, Lightbulb, Zap, FileText, Edit3, Download } from 'lucide-react'
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

  // 入力状態
  const [mainKeyword, setMainKeyword] = useState('')
  const [relatedKeywords, setRelatedKeywords] = useState('')
  const [persona, setPersona] = useState('')
  const [tone, setTone] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // 処理状態
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const canSubmit = mainKeyword.trim().length >= 1

  // サンプル入力
  function fillSample() {
    const sample = SAMPLE_KEYWORDS[Math.floor(Math.random() * SAMPLE_KEYWORDS.length)]
    setMainKeyword(sample.main)
    setRelatedKeywords(sample.related)
    setPersona(sample.persona)
    setTone(sample.tone)
    setShowAdvanced(true) // 詳細設定も開く
  }

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
          </div>

          {/* フォーム */}
          <div className="px-6 sm:px-10 py-6 sm:py-8 space-y-5">
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
                      <h3 className="text-sm font-black text-gray-900 mb-1">「構成を作る」をクリック</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        AIがキーワードを分析し、SEOに最適な見出し構成を自動生成します。<br />
                        生成には10〜30秒ほどかかります。
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

