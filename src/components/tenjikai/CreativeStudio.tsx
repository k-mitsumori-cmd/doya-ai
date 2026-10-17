'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, ImagePlus, Printer } from 'lucide-react'
import { PageHeader, cardIn } from './ui'
import ImageGenModal from './ImageGenModal'
import { recommendPrinters, yen, type Creative, type SiteAnalysis } from '@/lib/tenjikai/engine'
import { buildCreativePrompt, nearestRatio } from '@/lib/tenjikai/imagegen'
import { ds } from '@/lib/tenjikai/tokens'

function QR({ size = 40, seed = 7 }: { size?: number; seed?: number }) {
  // 見た目用のダミーQR（実物は入稿時に差し込む）
  const n = 11
  const cells = []
  let h = seed
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      h = (h * 1103515245 + 12345) & 0x7fffffff
      const finder = (x < 3 && y < 3) || (x > n - 4 && y < 3) || (x < 3 && y > n - 4)
      if (finder || h % 3 === 0) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />)
    }
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} width={size} height={size} className="rounded bg-white" aria-hidden="true">
      <g fill={ds.ink}>{cells}</g>
    </svg>
  )
}

export function CreativePreview({ c, a }: { c: Creative; a: SiteAnalysis }) {
  const { primary, secondary, accent } = a.colors
  const [l1, l2] = a.headline.split('\n')
  switch (c.kind) {
    case 'backwall':
      return (
        <div className="flex h-full w-full flex-col justify-between p-[6%]" style={{ background: `linear-gradient(120deg, #fff 55%, ${primary}22)` }}>
          <div>
            <p className="font-display leading-[1.1]" style={{ color: secondary, fontSize: 'clamp(14px,2.6vw,28px)' }}>{l1}</p>
            <p className="font-display leading-[1.1]" style={{ color: primary, fontSize: 'clamp(14px,2.6vw,28px)' }}>{l2}</p>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="flex gap-1.5">
              {a.valueProps.map((v) => (
                <span key={v.title} className="rounded px-1.5 py-0.5 text-[8px] font-black text-white" style={{ background: primary }}>{v.title}</span>
              ))}
            </div>
            <span className="text-[10px] font-black" style={{ color: secondary }}>{a.brand}</span>
          </div>
        </div>
      )
    case 'rollup':
      return (
        <div className="flex h-full w-full flex-col items-center justify-between p-[10%] text-center text-white" style={{ background: `linear-gradient(180deg, ${primary}, ${secondary})` }}>
          <p className="font-display text-[13px] leading-tight">{c.copy}</p>
          <div className="h-[30%] w-full rounded-lg bg-white/15" />
          <div className="flex flex-col items-center gap-1">
            <QR size={30} seed={3} />
            <span className="text-[9px] font-black">{a.brand}</span>
          </div>
        </div>
      )
    case 'flyer':
      return (
        <div className="flex h-full w-full flex-col gap-[4%] bg-white p-[8%]">
          <div className="h-1.5 w-1/3 rounded" style={{ background: accent }} />
          <p className="font-display text-[12px] leading-tight" style={{ color: secondary }}>{l1}<span style={{ color: primary }}>{l2}</span></p>
          <p className="text-[7px] leading-snug text-gray-500">{a.subline}</p>
          <div className="grid gap-1">
            {a.valueProps.map((v, i) => (
              <div key={v.title} className="flex items-center gap-1">
                <span className="flex h-3 w-3 items-center justify-center rounded-full text-[6px] font-black text-white" style={{ background: primary }}>{i + 1}</span>
                <span className="text-[7px] font-bold text-ink">{v.title}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-end justify-between">
            <span className="text-[8px] font-black" style={{ color: primary }}>{a.brand}</span>
            <QR size={24} seed={5} />
          </div>
        </div>
      )
    case 'clearfile':
      return (
        <div className="relative h-full w-full overflow-hidden" style={{ background: `${primary}18` }}>
          <div className="absolute -right-[20%] -top-[10%] h-[70%] w-[90%] rotate-12 rounded-[var(--r)]" style={{ background: primary }} />
          <div className="absolute bottom-[8%] left-[8%]">
            <p className="font-display text-[14px]" style={{ color: secondary }}>{a.brand}</p>
            <p className="text-[7px] font-bold text-gray-600">{a.category}</p>
          </div>
          <div className="absolute left-0 top-0 h-full w-[6%]" style={{ background: accent }} />
        </div>
      )
    case 'card':
      return (
        <div className="flex h-full w-full items-center justify-between gap-2 bg-white p-[8%]" style={{ borderLeft: `6px solid ${primary}` }}>
          <div>
            <p className="text-[9px] font-black text-ink">{c.copy}</p>
            <p className="text-[7px] text-gray-500">{a.brand}</p>
          </div>
          <QR size={32} seed={9} />
        </div>
      )
    case 'loop':
      return <LoopPreview a={a} />
  }
}

function LoopPreview({ a }: { a: SiteAnalysis }) {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: a.colors.secondary }}>
      {a.valueProps.map((v, i) => (
        <motion.div
          key={v.title}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center text-white"
          animate={{ opacity: [0, 1, 1, 0], scale: [1.08, 1, 1, 0.98] }}
          transition={{ duration: 5, times: [0, 0.1, 0.9, 1], repeat: Infinity, repeatDelay: 10, delay: i * 5 }}
        >
          <span className="font-mono text-[8px] opacity-60">CUT {i + 1} / 0:{String(i * 5).padStart(2, '0')}</span>
          <p className="font-display text-[15px]" style={{ color: i === 1 ? a.colors.accent : '#fff' }}>{v.title}</p>
          <p className="px-4 text-[8px] opacity-80">{v.body}</p>
        </motion.div>
      ))}
      <div className="absolute bottom-0 left-0 h-0.5 w-full bg-white/20">
        <motion.div className="h-full" style={{ background: a.colors.primary }} animate={{ width: ['0%', '100%'] }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }} />
      </div>
    </div>
  )
}

export default function CreativeStudio({ creatives, analysis }: { creatives: Creative[]; analysis: SiteAnalysis }) {
  const [target, setTarget] = useState<Creative | null>(null)
  const [images, setImages] = useState<Record<string, string[]>>({})
  const [shown, setShown] = useState<Record<string, number>>({})
  const printTotal = creatives.reduce((s, c) => s + c.unitYen * c.qty, 0)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <PageHeader
        eyebrow="CREATIVE STUDIO"
        title="制作物スタジオ"
        desc="サイトの訴求点から、展示会に必要な制作物6点のコピーと構成を作りました。気に入ったものは画像生成で入稿用のデザイン案にできます。"
        right={
          <div className="rounded-[var(--r-sm)] border border-gray-200 bg-white px-4 py-3 text-right">
            <p className="text-[11px] font-black text-gray-500">制作・印刷の概算</p>
            <p className="font-mono text-xl font-semibold text-ink tabular">{yen(printTotal)}</p>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {creatives.map((c, i) => {
          const imgs = images[c.kind]
          const printers = recommendPrinters(c.kind)
          const ratio = c.widthMm / c.heightMm
          return (
            <motion.article key={c.kind} {...cardIn(i)} whileHover={{ y: -4 }} className="flex flex-col overflow-hidden rounded-[var(--r)] border border-gray-200 bg-white">
              <div className="flex h-56 items-center justify-center bg-[var(--track)] p-5">
                <motion.div
                  initial={{ rotateY: -18, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.08, type: 'spring', stiffness: 120 }}
                  className="overflow-hidden rounded-md bg-white shadow-[0_12px_30px_-12px_rgba(16,22,51,.45)]"
                  style={{ aspectRatio: `${c.widthMm} / ${c.heightMm}`, height: ratio > 1.2 ? 'auto' : '100%', width: ratio > 1.2 ? '100%' : 'auto', maxHeight: '100%', maxWidth: '100%' }}
                >
                  {imgs?.length ? <img src={imgs[shown[c.kind] ?? 0]} alt={`${c.name}の生成画像`} className="h-full w-full object-cover" /> : <CreativePreview c={c} a={analysis} />}
                </motion.div>
              </div>
              {imgs && imgs.length > 1 && (
                <div className="flex justify-center gap-1 py-2">
                  {imgs.map((_, k) => (
                    <button key={k} aria-label={`${k + 1}枚目`} onClick={() => setShown((s) => ({ ...s, [c.kind]: k }))} className={`h-1.5 w-5 rounded-full ${(shown[c.kind] ?? 0) === k ? 'bg-doya-500' : 'bg-gray-200'}`} />
                  ))}
                </div>
              )}
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black text-ink">{c.name}</h3>
                    <p className="font-mono text-[11px] text-gray-500">{c.size}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-ink tabular">{yen(c.unitYen * c.qty)}</p>
                    <p className="font-mono text-[10px] text-gray-500">{c.qty.toLocaleString()} × {yen(c.unitYen)}</p>
                  </div>
                </div>
                <p className="rounded-xl bg-doya-50 px-3 py-2 text-xs font-bold text-doya-700">「{c.copy}」</p>
                <p className="text-xs leading-relaxed text-gray-600">{c.purpose}</p>

                {printers.length > 0 && (
                  <div className="rounded-[var(--r-sm)] border border-gray-100 bg-gray-50/70 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black text-gray-500"><Printer className="h-3.5 w-3.5" />おすすめの印刷会社</p>
                    <ul className="flex flex-col gap-1.5">
                      {printers.map((p, k) => (
                        <li key={p.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 text-xs font-black text-ink">
                              {k === 0 && <span className="rounded bg-amber-400 px-1 text-[9px] text-amber-950">第一候補</span>}
                              {p.name}
                            </p>
                            <p className="text-[10px] leading-snug text-gray-500">{p.strength}</p>
                          </div>
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex flex-shrink-0 items-center gap-0.5 text-[10px] font-black text-doya-600 hover:underline">
                            サイト <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button onClick={() => setTarget(c)} className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border-2 border-doya-500 px-4 py-2.5 text-xs font-black text-doya-600 transition-colors hover:bg-doya-500 hover:text-white">
                  <ImagePlus className="h-4 w-4" /> {imgs?.length ? '画像を作り直す' : 'デザイン画像を生成'}
                </button>
              </div>
            </motion.article>
          )
        })}
      </div>
      <p className="text-[11px] text-gray-400">印刷会社のおすすめ理由はプロトタイプ用の仮置きです。価格・納期・入稿形式は各社のサイトで確認してください。</p>

      {target && (
        <ImageGenModal
          open={!!target}
          onClose={() => setTarget(null)}
          title={`${target.name}のデザイン画像を生成`}
          prompt={buildCreativePrompt(target, analysis)}
          aspectRatio={nearestRatio(target.widthMm, target.heightMm)}
          onResult={(imgs) => {
            setImages((m) => ({ ...m, [target.kind]: imgs }))
            setShown((s) => ({ ...s, [target.kind]: 0 }))
          }}
        />
      )}
    </div>
  )
}
