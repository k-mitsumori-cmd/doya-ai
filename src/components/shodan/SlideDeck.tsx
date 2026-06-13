'use client'

import { useState } from 'react'
import type { ProposalSlide } from '@/lib/shodan/types'

const sym = (name: string, size = 18) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>

function SlideView({ s, idx, total }: { s: ProposalSlide; idx: number; total: number }) {
  const isCover = s.type === 'cover'
  const isClosing = s.type === 'closing'
  return (
    <div className={`aspect-[16/9] w-full rounded-2xl border overflow-hidden flex flex-col ${
      isCover || isClosing ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white border-purple-300' : 'bg-white border-slate-200'
    }`}>
      {isCover || isClosing ? (
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12">
          <div className="text-[11px] font-black tracking-widest text-white/70 mb-2">{isCover ? 'PROPOSAL' : 'NEXT STEP'}</div>
          <h2 className="text-2xl sm:text-4xl font-black leading-tight">{s.title}</h2>
          {s.subtitle && <p className="text-sm sm:text-lg font-bold text-white/85 mt-3">{s.subtitle}</p>}
          {s.bullets && s.bullets.length > 0 && (
            <ul className="mt-5 space-y-1.5">
              {s.bullets.map((b, i) => <li key={i} className="flex items-start gap-2 text-sm sm:text-base font-bold text-white/95">{sym('chevron_right', 18)}{b}</li>)}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="px-6 sm:px-9 pt-6 sm:pt-8">
            <div className="inline-block text-[10px] font-black text-fuchsia-600 bg-fuchsia-50 px-2 py-0.5 rounded-full mb-2">{s.subtitle || 'POINT'}</div>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900 leading-tight border-b-2 border-purple-100 pb-3">{s.title}</h2>
          </div>
          <div className="flex-1 px-6 sm:px-9 py-4 sm:py-6">
            <ul className="space-y-2.5 sm:space-y-3">
              {(s.bullets || []).map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm sm:text-lg font-bold text-slate-700">
                  <span className="mt-0.5 grid place-items-center w-6 h-6 shrink-0 rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white text-xs">{i + 1}</span>
                  {b}
                </li>
              ))}
            </ul>
            {s.note && <p className="text-xs font-bold text-slate-400 mt-4">{s.note}</p>}
          </div>
        </>
      )}
      <div className={`px-6 sm:px-9 py-2 text-[10px] font-black flex justify-between ${isCover || isClosing ? 'text-white/60' : 'text-slate-300'}`}>
        <span>ドヤ商談準備</span><span>{idx + 1} / {total}</span>
      </div>
    </div>
  )
}

export default function SlideDeck({ slides, fileBase }: { slides: ProposalSlide[]; fileBase?: string }) {
  const [i, setI] = useState(0)
  if (!slides.length) return null
  const prev = () => setI((v) => Math.max(0, v - 1))
  const next = () => setI((v) => Math.min(slides.length - 1, v + 1))

  return (
    <div>
      {/* 操作 */}
      <div className="flex items-center justify-between mb-3 shodan-no-print">
        <div className="flex items-center gap-2">
          <button onClick={prev} disabled={i === 0} className="grid place-items-center w-9 h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">{sym('chevron_left', 22)}</button>
          <span className="text-sm font-black text-slate-500">{i + 1} / {slides.length}</span>
          <button onClick={next} disabled={i === slides.length - 1} className="grid place-items-center w-9 h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">{sym('chevron_right', 22)}</button>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50">{sym('print', 16)}印刷 / PDF</button>
      </div>

      {/* 表示中スライド */}
      <div className="shodan-no-print shadow-lg rounded-2xl"><SlideView s={slides[i]} idx={i} total={slides.length} /></div>

      {/* サムネイル */}
      <div className="shodan-no-print mt-3 flex gap-2 overflow-x-auto pb-1">
        {slides.map((s, idx) => (
          <button key={idx} onClick={() => setI(idx)}
            className={`shrink-0 w-28 aspect-[16/9] rounded-lg border-2 text-left p-2 overflow-hidden transition-all ${idx === i ? 'border-purple-500 ring-2 ring-purple-200' : 'border-slate-200 hover:border-purple-300'}`}>
            <div className="text-[8px] font-black text-purple-500">{idx + 1}</div>
            <div className="text-[9px] font-bold text-slate-600 leading-tight line-clamp-3">{s.title}</div>
          </button>
        ))}
      </div>

      {/* 印刷用：全スライドを縦に並べる（画面では非表示） */}
      <div className="shodan-print-only hidden">
        {slides.map((s, idx) => (
          <div key={idx} style={{ pageBreakAfter: 'always' }} className="mb-4">
            <SlideView s={s} idx={idx} total={slides.length} />
          </div>
        ))}
      </div>
    </div>
  )
}
