'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Sparkles, Wand2, Globe, Loader2 } from 'lucide-react'
import { FloatingBadges } from './FloatingBadges'

const EXAMPLE_URLS = [
  'https://doya-ai.surisuta.jp',
  'https://apple.com',
  'https://stripe.com',
]

export function HeroSection() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [targetKeyword, setTargetKeyword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % EXAMPLE_URLS.length)
    }, 2800)
    return () => clearInterval(id)
  }, [])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      setError('URLを入力してください')
      inputRef.current?.focus()
      return
    }
    setError(null)
    setIsSubmitting(true)

    // ページ遷移しつつ、analyzing 画面側で SSE を開始するパターン
    const params = new URLSearchParams({ url: trimmed })
    if (targetKeyword.trim()) params.set('keyword', targetKeyword.trim())
    router.push(`/allinone/analyzing?${params.toString()}`)
  }

  return (
    <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
      {/* 背景グラデーションブロブ */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-10%] top-[-10%] h-[560px] w-[560px] animate-allinone-float-lg rounded-full bg-gradient-to-br from-allinone-primarySoft via-white to-cyan-50 blur-3xl" />
        <div className="absolute right-[-8%] top-[20%] h-[480px] w-[480px] animate-allinone-float-sm rounded-full bg-gradient-to-tr from-emerald-50 via-white to-allinone-primarySoft blur-3xl" />
        <div className="absolute bottom-[-20%] left-[20%] h-[420px] w-[720px] rounded-full bg-gradient-to-r from-allinone-primarySoft via-white to-cyan-50 blur-3xl" />
        {/* グリッドノイズ */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.05]">
          <defs>
            <pattern id="hero-grid" width="44" height="44" patternUnits="userSpaceOnUse">
              <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#7C5CFF" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* 上部バッジ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex justify-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-allinone-line bg-white/70 px-4 py-1.5 text-xs font-bold text-allinone-inkSoft shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-allinone-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-allinone-primary" />
            </span>
            URL 1本で、5軸の分析が 15秒で完了。
          </div>
        </motion.div>

        {/* ヒーローコピー */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mx-auto mt-8 max-w-4xl text-center text-[44px] font-black leading-[1.08] tracking-tight text-allinone-ink sm:text-[64px] sm:leading-[1.02]"
        >
          URLを入れるだけ。
          <br className="hidden sm:block" />
          <span className="relative inline-block">
            <span className="relative z-10 bg-gradient-to-r from-allinone-primary via-fuchsia-500 to-allinone-cyan bg-clip-text text-transparent">
              マーケ課題が、全部見える。
            </span>
            <span className="absolute inset-x-0 bottom-1 -z-10 h-5 rounded-full bg-gradient-to-r from-allinone-primarySoft via-white to-cyan-50 sm:bottom-2 sm:h-6" />
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mx-auto mt-6 max-w-2xl text-center text-base font-medium text-allinone-inkSoft sm:text-lg"
        >
          サイトのURLを1つ入れるだけで、<strong className="text-allinone-ink">サイト診断・SEO分析・ペルソナ生成・キービジュアル・アクションプラン・広告運用提案</strong>まで、
          ドヤAIが同時多角に可視化。あなたの"次の一手"がここで決まる。
        </motion.p>

        {/* 入力フォーム */}
        <motion.form
          onSubmit={onSubmit}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="relative mx-auto mt-10 max-w-3xl"
        >
          <div className="group relative rounded-[28px] bg-gradient-to-r from-allinone-primary via-fuchsia-500 to-allinone-cyan p-[2px] shadow-2xl shadow-allinone-primary/25 transition hover:shadow-allinone-primary/40">
            <div className="relative rounded-[26px] bg-white p-2 sm:p-3">
              <div className="flex items-stretch gap-2">
                <div className="relative flex flex-1 items-center gap-3 rounded-2xl bg-allinone-surface px-4 sm:px-5">
                  <Globe className="h-5 w-5 flex-none text-allinone-muted" />
                  <div className="relative flex-1 py-3 sm:py-4">
                    <input
                      ref={inputRef}
                      type="text"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value)
                        setError(null)
                      }}
                      placeholder=" "
                      className="peer relative z-10 w-full bg-transparent text-base font-medium text-allinone-ink placeholder-transparent outline-none sm:text-lg"
                      autoComplete="off"
                      spellCheck={false}
                      inputMode="url"
                    />
                    {!url && (
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={placeholderIndex}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.3 }}
                          className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-base font-medium text-allinone-mutedSoft sm:text-lg"
                        >
                          {EXAMPLE_URLS[placeholderIndex]}
                        </motion.span>
                      </AnimatePresence>
                    )}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group/btn relative inline-flex items-center gap-2 rounded-2xl bg-allinone-ink px-4 py-3 text-sm font-black text-white transition hover:bg-allinone-inkSoft sm:px-6 sm:text-base"
                >
                  <span className="hidden sm:inline">分析スタート</span>
                  <span className="inline sm:hidden">スタート</span>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                  )}
                  <span className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-allinone-primary to-allinone-cyan opacity-0 blur-md transition group-hover/btn:opacity-60" />
                </button>
              </div>

              {/* 補助: 注目キーワード */}
              <div className="mt-2 flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-xs text-allinone-muted sm:text-sm">
                <Wand2 className="h-4 w-4 text-allinone-primary" />
                <span className="hidden sm:inline">狙いたいキーワードがあれば（任意）:</span>
                <span className="sm:hidden">キーワード（任意）:</span>
                <input
                  type="text"
                  value={targetKeyword}
                  onChange={(e) => setTargetKeyword(e.target.value)}
                  placeholder="例: ウェビナー 集客"
                  className="flex-1 bg-transparent outline-none placeholder:text-allinone-mutedSoft"
                />
              </div>
            </div>

            {/* 光る輪郭 */}
            <span className="pointer-events-none absolute inset-0 -z-10 animate-allinone-sheen rounded-[28px] bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.5)_50%,transparent_70%)] bg-[length:200%_100%]" />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-center text-sm font-bold text-allinone-danger"
            >
              {error}
            </motion.p>
          )}

          <p className="mt-4 text-center text-xs text-allinone-muted">
            <Sparkles className="mr-1 inline h-3 w-3 text-allinone-primary" />
            認証不要・ゲストでも月3回まで無料でお試し
          </p>
        </motion.form>

        {/* 周囲の浮遊バッジ（バッジで「全部できる」を示す） */}
        <FloatingBadges />

        {/* サンプル遷移 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm"
        >
          <span className="text-allinone-muted">試してみる:</span>
          {EXAMPLE_URLS.map((u) => (
            <button
              key={u}
              onClick={() => setUrl(u)}
              type="button"
              className="rounded-full border border-allinone-line bg-white px-3 py-1.5 font-bold text-allinone-inkSoft transition hover:border-allinone-primary hover:text-allinone-primary"
            >
              {u.replace(/^https?:\/\//, '')}
            </button>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
