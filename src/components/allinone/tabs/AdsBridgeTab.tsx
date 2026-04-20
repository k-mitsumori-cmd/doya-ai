'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, BarChart3, CircleDollarSign, Sparkles, Target, TrendingUp } from 'lucide-react'

/**
 * 広告運用提案ブリッジタブ
 * 分析結果を元に、媒体配分の初期値・クリエイティブ方針・予算目安を提示。
 * そのまま「ドヤ広告シミュAI」で提案資料生成に進める。
 */
export function AdsBridgeTab({ analysis }: { analysis: any }) {
  const personas = analysis.personas || []
  const topAges = personas.map((p: any) => p.age).filter(Boolean)
  const avgAge = topAges.length ? Math.round(topAges.reduce((a: number, b: number) => a + b, 0) / topAges.length) : null

  // 業種ヒューリスティック（タイトルや本文から簡易推定）で媒体配分の初期値を決める
  const text = `${analysis.title || ''} ${analysis.description || ''}`.toLowerCase()
  const isB2B = /b2b|saas|法人|エンタープライズ|dx|crm|erp|mrr|arr/i.test(text)
  const isEc = /ショップ|ec|購入|通販|オンラインストア/i.test(text)
  const isApp = /アプリ|app|ios|android/i.test(text)

  let allocation: Record<string, number>
  if (isB2B) {
    allocation = { Google: 35, Meta: 20, LinkedIn: 25, X: 10, Yahoo: 10 }
  } else if (isEc) {
    allocation = { Google: 25, Meta: 35, LINE: 15, TikTok: 15, Yahoo: 10 }
  } else if (isApp) {
    allocation = { Meta: 30, TikTok: 30, Google: 20, X: 10, LINE: 10 }
  } else {
    allocation = { Google: 30, Meta: 30, LINE: 15, X: 10, Yahoo: 15 }
  }

  const budgetHint = isB2B ? '月 100〜300万円' : isEc ? '月 50〜200万円' : '月 30〜100万円'

  const creativeHints = [
    {
      media: 'Meta (Facebook/Instagram)',
      tone: 'ストーリー性重視',
      format: '縦型リール / Carousel',
      hook: personas[0]?.painPoint ? `${personas[0].painPoint} に共感するフック` : '痛みからの提示',
    },
    {
      media: 'Google (検索/YDN)',
      tone: 'インテント直撃',
      format: '検索広告 + ディスカバリー',
      hook: analysis.seoAnalysis?.missingKeywords?.[0]
        ? `キーワード「${analysis.seoAnalysis.missingKeywords[0]}」に直接訴求`
        : 'ニーズ明確化',
    },
    {
      media: 'TikTok / Reels',
      tone: '若年層向けの遊び',
      format: '15秒縦型',
      hook: '3秒で惹きつける掴み',
    },
    {
      media: 'LINE',
      tone: 'コンバージョン特化',
      format: 'Smart Channel / 友達追加',
      hook: 'クーポン・限定情報・再訪施策',
    },
  ]

  const enc = encodeURIComponent

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-allinone-line bg-gradient-to-br from-allinone-ink via-allinone-inkSoft to-allinone-primaryDeep p-8 text-white"
      >
        <div className="relative z-10">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black">
            <Sparkles className="h-3 w-3" />
            AD OPERATION PROPOSAL
          </div>
          <h2 className="text-2xl font-black sm:text-3xl">
            この診断を、そのまま広告提案資料に。
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            分析結果・ペルソナ・コンテンツギャップから、媒体配分と予算・クリエイティブ方針を自動でプリセット。
            <strong className="text-white">ドヤ広告シミュAI</strong> に引き継げば、月次シミュレーション + PPTX/PDF 提案資料を10分で出力できます。
          </p>
          <Link
            href={`/adsim?siteUrl=${enc(analysis.url)}&allinoneId=${analysis.id}`}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-allinone-ink transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <BarChart3 className="h-4 w-4" />
            ドヤ広告シミュAIで提案資料を作る
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <span className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-allinone-primary/30 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-28 -left-20 h-60 w-60 rounded-full bg-allinone-cyan/30 blur-3xl" />
      </motion.div>

      {/* 媒体配分 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-allinone-line bg-white p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-allinone-primary" />
          <h3 className="text-lg font-black text-allinone-ink">推奨 媒体配分</h3>
          <span className="ml-2 rounded-full bg-allinone-surface px-2 py-0.5 text-[10px] font-black text-allinone-muted">
            {isB2B ? 'B2B 推奨' : isEc ? 'EC 推奨' : isApp ? 'アプリ 推奨' : '汎用 推奨'}
          </span>
        </div>
        <div className="space-y-3">
          {Object.entries(allocation).map(([media, pct], i) => (
            <motion.div
              key={media}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-black text-allinone-ink">{media}</span>
                <span className="font-mono font-black text-allinone-primary">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-allinone-line">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-allinone-primary to-allinone-cyan"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: i * 0.08 + 0.1, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* KPI目安 */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={CircleDollarSign}
          label="月予算目安"
          value={budgetHint}
          color="from-allinone-primary to-allinone-cyan"
        />
        <StatCard
          icon={Target}
          label="ターゲット年齢"
          value={avgAge ? `${avgAge - 5}〜${avgAge + 7}歳` : '—'}
          color="from-pink-500 to-rose-500"
        />
        <StatCard
          icon={TrendingUp}
          label="狙うべき KPI"
          value={isB2B ? 'CPA < ¥15,000' : isEc ? 'ROAS > 400%' : 'CPA < ¥5,000'}
          color="from-emerald-500 to-teal-500"
        />
      </div>

      {/* クリエイティブ方針 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-allinone-line bg-white p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-allinone-primary" />
          <h3 className="text-lg font-black text-allinone-ink">媒体別クリエイティブ方針</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {creativeHints.map((c, i) => (
            <motion.div
              key={c.media}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-allinone-line bg-allinone-surface p-4"
            >
              <div className="text-sm font-black text-allinone-ink">{c.media}</div>
              <div className="mt-1 text-xs text-allinone-muted">
                トーン: {c.tone} / フォーマット: {c.format}
              </div>
              <div className="mt-2 rounded-xl border border-dashed border-allinone-primary/40 bg-white p-2 text-xs text-allinone-ink">
                💡 {c.hook}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* バナー・動画連携 */}
      <div className="grid gap-4 md:grid-cols-2">
        <BridgeCard
          title="バナーを量産する"
          desc="キービジュアルから A/B/C バナー案を10パターン生成"
          href={`/banner?siteUrl=${enc(analysis.url)}`}
          cta="ドヤバナーAI"
        />
        <BridgeCard
          title="動画広告を作る"
          desc="シナリオから15〜60秒の縦型動画を自動生成"
          href={`/movie?siteUrl=${enc(analysis.url)}`}
          cta="ドヤムービーAI"
        />
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-allinone-line bg-white p-5"
    >
      <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-[10px] font-black uppercase tracking-wider text-allinone-muted">{label}</div>
      <div className="mt-1 text-xl font-black text-allinone-ink">{value}</div>
    </motion.div>
  )
}

function BridgeCard({
  title,
  desc,
  href,
  cta,
}: {
  title: string
  desc: string
  href: string
  cta: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 rounded-3xl border border-allinone-line bg-white p-5 transition hover:border-allinone-primary hover:shadow-lg"
    >
      <div>
        <div className="font-black text-allinone-ink">{title}</div>
        <div className="mt-1 text-sm text-allinone-muted">{desc}</div>
        <div className="mt-2 inline-flex items-center gap-1 text-xs font-black text-allinone-primary">
          {cta}
          <ArrowRight className="h-3 w-3 transition group-hover:translate-x-1" />
        </div>
      </div>
      <Sparkles className="h-8 w-8 text-allinone-primary opacity-30 transition group-hover:opacity-100 group-hover:scale-110" />
    </Link>
  )
}
