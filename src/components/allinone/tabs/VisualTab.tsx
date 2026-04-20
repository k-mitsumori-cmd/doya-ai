'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Image as ImageIcon, Download, Sparkles } from 'lucide-react'
import type { KeyVisual } from '@/lib/allinone/types'
import { RegenerateButton } from './SiteTab'

export function VisualTab({
  visuals,
  siteUrl,
  onRegenerate,
  isRegenerating,
}: {
  visuals: KeyVisual[]
  siteUrl: string
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  const enc = encodeURIComponent

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-allinone-primarySoft px-2.5 py-1 text-[10px] font-black text-allinone-primary">
            <Sparkles className="h-3 w-3" />
            KEY VISUALS (3 案)
          </div>
          <h2 className="text-2xl font-black text-allinone-ink">キービジュアル自動設計</h2>
        </div>
        <RegenerateButton onClick={onRegenerate} loading={isRegenerating} />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {visuals.map((v, i) => (
          <VisualCard key={v.id} visual={v} index={i} siteUrl={siteUrl} />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-allinone-line bg-gradient-to-br from-allinone-ink via-allinone-inkSoft to-allinone-primaryDeep p-6 text-white"
      >
        <h3 className="text-lg font-black">このトンマナでバナーを量産するなら</h3>
        <p className="mt-1 text-sm text-white/70">
          ドヤバナーAI に URL とパレットを引き継いで、A/B/C 3案で一気に展開できます。
        </p>
        <Link
          href={`/banner?siteUrl=${enc(siteUrl)}`}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-allinone-ink transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          ドヤバナーAI で量産する
          <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    </div>
  )
}

function VisualCard({ visual, index, siteUrl }: { visual: KeyVisual; index: number; siteUrl: string }) {
  const [imageReady, setImageReady] = useState(!!visual.imageUrl)
  const [showByun, setShowByun] = useState(false)

  useEffect(() => {
    if (visual.imageUrl) {
      // スタガードで演出
      const timer = setTimeout(() => {
        setImageReady(true)
        setShowByun(true)
        setTimeout(() => setShowByun(false), 900)
      }, 120 * index)
      return () => clearTimeout(timer)
    }
  }, [visual.imageUrl, index])

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="group relative overflow-hidden rounded-3xl border border-allinone-line bg-white shadow-lg shadow-allinone-primary/5 transition hover:-translate-y-1 hover:shadow-xl"
    >
      {/* 画像枠 */}
      <div className="relative aspect-video overflow-hidden bg-allinone-surface">
        <AnimatePresence mode="wait">
          {visual.imageUrl && imageReady ? (
            <motion.img
              key={visual.imageUrl}
              src={visual.imageUrl}
              alt={visual.concept}
              initial={{
                opacity: 0,
                x: '120%',
                scale: 0.7,
                filter: 'blur(16px)',
              }}
              animate={{
                opacity: 1,
                x: '0%',
                scale: 1,
                filter: 'blur(0px)',
              }}
              transition={{
                duration: 0.9,
                ease: [0.2, 1.2, 0.3, 1],
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-allinone-primarySoft via-white to-cyan-50">
              <div className="text-center">
                <ImageIcon className="mx-auto h-8 w-8 animate-pulse text-allinone-primary" />
                <div className="mt-2 text-xs font-black text-allinone-muted">生成中…</div>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* ビュンエフェクト */}
        {showByun && (
          <>
            <motion.span
              initial={{ opacity: 0, x: '-60%', scaleX: 0.1 }}
              animate={{ opacity: [0, 1, 0], x: '120%', scaleX: 4 }}
              transition={{ duration: 0.8 }}
              className="pointer-events-none absolute inset-y-0 left-0 right-0 top-1/2 h-2 origin-left rounded-full bg-gradient-to-r from-transparent via-white to-transparent blur-md"
            />
            {[...Array(10)].map((_, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 1, scale: 0 }}
                animate={{
                  opacity: 0,
                  scale: 1.8,
                  x: `${Math.cos((i / 10) * Math.PI * 2) * 60}px`,
                  y: `${Math.sin((i / 10) * Math.PI * 2) * 60}px`,
                }}
                transition={{ duration: 0.9 }}
                className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-allinone-primary"
              />
            ))}
          </>
        )}

        {/* ラベル */}
        <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur">
          案 {visual.id}
        </div>
        {visual.imageUrl && (
          <a
            href={visual.imageUrl}
            download={`keyvisual-${visual.id}.png`}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-allinone-ink backdrop-blur transition hover:bg-white"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* 本文 */}
      <div className="p-5">
        <div className="text-xs font-black text-allinone-primary">{visual.concept}</div>
        <h3 className="mt-2 text-lg font-black leading-tight text-allinone-ink">{visual.headline}</h3>
        <p className="mt-1 text-sm text-allinone-inkSoft">{visual.subcopy}</p>

        {/* パレット */}
        <div className="mt-4 flex gap-1.5">
          {visual.palette.map((hex, i) => (
            <div
              key={hex + i}
              className="h-6 w-6 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: hex }}
              title={hex}
            />
          ))}
        </div>
      </div>
    </motion.article>
  )
}
