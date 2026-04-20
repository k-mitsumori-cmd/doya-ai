'use client'

import { useState, useRef, useEffect } from 'react'
import { FileDown, ChevronDown, FileText, FileSpreadsheet, Presentation, Code } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function ExportMenu({ analysisId }: { analysisId: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const base = `/api/allinone/analysis/${analysisId}/report`
  const items = [
    { label: 'Markdown', icon: FileText, href: `${base}?format=md` },
    { label: 'Excel (.xlsx)', icon: FileSpreadsheet, href: `${base}?format=xlsx` },
    { label: 'PowerPoint (.pptx)', icon: Presentation, href: `${base}?format=pptx` },
    { label: 'JSON', icon: Code, href: `${base}?format=json` },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-allinone-line bg-white px-4 py-2 text-xs font-black text-allinone-ink transition hover:border-allinone-primary hover:text-allinone-primary"
      >
        <FileDown className="h-4 w-4" />
        資料出力
        <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-allinone-line bg-white shadow-xl"
          >
            <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-allinone-muted">
              レポート書き出し
            </div>
            {items.map((it) => {
              const Icon = it.icon
              return (
                <a
                  key={it.label}
                  href={it.href}
                  download
                  className="flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-allinone-ink hover:bg-allinone-surface"
                >
                  <Icon className="h-4 w-4 text-allinone-muted" />
                  {it.label}
                </a>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
