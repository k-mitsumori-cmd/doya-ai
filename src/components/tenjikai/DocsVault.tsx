'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, FileSpreadsheet, FileText, FileUp, Image as ImageIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { PageHeader, cardIn } from './ui'
import { daysUntil, type Deadline, type ProjectInput } from '@/lib/tenjikai/engine'

type DocKind = '出展規約' | 'マニュアル' | '申請書' | '見積・請求' | 'デザイン' | 'その他'

interface Doc {
  id: string
  name: string
  kind: DocKind
  size: string
  note: string
  sample?: boolean
}

function guessKind(name: string): DocKind {
  if (/規約|規程|rule/i.test(name)) return '出展規約'
  if (/マニュアル|manual|搬入/i.test(name)) return 'マニュアル'
  if (/申請|申込|届/i.test(name)) return '申請書'
  if (/見積|請求|quote|invoice/i.test(name)) return '見積・請求'
  if (/\.(png|jpe?g|ai|psd|svg)$/i.test(name)) return 'デザイン'
  return 'その他'
}

const ICON: Record<DocKind, React.ElementType> = { 出展規約: FileText, マニュアル: FileText, 申請書: FileSpreadsheet, '見積・請求': FileSpreadsheet, デザイン: ImageIcon, その他: FileText }

const SAMPLE_DOCS: Doc[] = [
  { id: 'd1', name: '出展規約_2027.pdf', kind: '出展規約', size: '2.4 MB', note: '高さ制限 2.7m・通路側の壁は開口50%以上', sample: true },
  { id: 'd2', name: '搬入出マニュアル.pdf', kind: 'マニュアル', size: '5.1 MB', note: '搬入は会期前日 13:00〜20:00 / 車両登録が必要', sample: true },
  { id: 'd3', name: '電気工事申込書.xlsx', kind: '申請書', size: '86 KB', note: '提出期限を締切表に追加しました', sample: true },
]

export default function DocsVault({ deadlines, input }: { deadlines: Deadline[]; input: ProjectInput }) {
  const [docs, setDocs] = useState<Doc[]>(SAMPLE_DOCS)
  const [drag, setDrag] = useState(false)
  const [done, setDone] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const add = (files: FileList | null) => {
    if (!files) return
    const next = Array.from(files).map((f, i) => ({
      id: `u${Date.now()}${i}`,
      name: f.name,
      kind: guessKind(f.name),
      size: f.size > 1e6 ? `${(f.size / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1e3))} KB`,
      note: '本番ではAIが締切と注意事項を抽出します',
    }))
    setDocs((d) => [...next, ...d])
  }

  const nextIdx = deadlines.findIndex((d) => daysUntil(d.date) >= 0 && !done.includes(d.id))

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
      <PageHeader eyebrow="DOCUMENTS & SCHEDULE" title="資料庫・締切" desc={`主催者から届く規約やマニュアル、各種申請書、見積書をここにまとめます。締切は会期初日（${input.eventStart}）から逆算しています。`} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-3">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files) }}
            animate={{ opacity: 1, y: 0, scale: drag ? 1.02 : 1, borderColor: drag ? '#7f19e6' : '#e5e7eb' }}
            className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed bg-white p-8 text-center"
          >
            <motion.div animate={{ y: drag ? -6 : [0, -4, 0] }} transition={drag ? {} : { duration: 2.4, repeat: Infinity }} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-doya-50 text-doya-600">
              <FileUp className="h-6 w-6" />
            </motion.div>
            <p className="text-sm font-black text-ink">資料をドラッグ＆ドロップ</p>
            <p className="text-[11px] text-gray-500">PDF・Excel・画像。種類は自動で振り分けます</p>
            <button onClick={() => fileRef.current?.click()} className="mt-1 rounded-xl border-2 border-doya-500 px-4 py-1.5 text-xs font-black text-doya-600 hover:bg-doya-50">ファイルを選ぶ</button>
            <input ref={fileRef} id="docs-upload" type="file" multiple className="hidden" onChange={(e) => add(e.target.files)} />
          </motion.div>

          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {docs.map((d) => {
                const Icon = ICON[d.kind]
                return (
                  <motion.li key={d.id} layout initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-50 text-doya-600"><Icon className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-black text-ink">
                        {d.name}
                        {d.sample && <span className="rounded bg-gray-100 px-1.5 text-[9px] font-bold text-gray-500">例</span>}
                      </p>
                      <p className="text-[11px] text-gray-500">{d.note}</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <span className="rounded-full bg-doya-50 px-2 py-0.5 text-[10px] font-black text-doya-700">{d.kind}</span>
                      <span className="font-mono text-[10px] text-gray-400">{d.size}</span>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        </div>

        <motion.div {...cardIn(1)} className="rounded-3xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black text-ink">締切表</h2>
            <span className="font-mono text-[11px] text-gray-500">{done.length} / {deadlines.length} 完了</span>
          </div>
          <ol className="relative flex flex-col gap-1">
            <span className="absolute bottom-3 left-[19px] top-3 w-0.5 bg-gray-100" aria-hidden="true" />
            <motion.span className="absolute left-[19px] top-3 w-0.5 bg-doya-500" animate={{ height: `${(done.length / deadlines.length) * 100}%` }} aria-hidden="true" />
            {deadlines.map((d, i) => {
              const isDone = done.includes(d.id)
              const left = daysUntil(d.date)
              const isNext = i === nextIdx
              return (
                <motion.li key={d.id} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                  <button onClick={() => setDone(isDone ? done.filter((x) => x !== d.id) : [...done, d.id])} className={clsx('relative flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors', isNext ? 'bg-amber-50 ring-2 ring-amber-300' : 'hover:bg-gray-50')}>
                    <motion.span animate={{ backgroundColor: isDone ? '#7f19e6' : '#ffffff', scale: isNext && !isDone ? [1, 1.12, 1] : 1 }} transition={isNext ? { scale: { duration: 1.6, repeat: Infinity } } : {}} className="relative z-10 flex h-6 w-6 flex-shrink-0 translate-x-[4px] items-center justify-center rounded-full border-2 border-doya-500">
                      {isDone && <Check className="h-3.5 w-3.5 text-white" />}
                    </motion.span>
                    <span className="w-14 flex-shrink-0 font-mono text-[11px] font-semibold text-doya-600">{d.daysBefore === 0 ? '当日' : `T-${d.daysBefore}`}</span>
                    <span className="min-w-0 flex-1">
                      <span className={clsx('block truncate text-xs font-black', isDone ? 'text-gray-400 line-through' : 'text-ink')}>{d.title}</span>
                      <span className="block text-[10px] text-gray-500">{d.owner}</span>
                    </span>
                    <span className="flex-shrink-0 text-right">
                      <span className="block font-mono text-[11px] text-ink">{d.date.replaceAll('-', '/')}</span>
                      <span className={clsx('block text-[10px] font-bold', left < 0 ? 'text-gray-400' : left <= 14 ? 'text-rose-600' : 'text-gray-500')}>{left < 0 ? '過ぎています' : `あと${left}日`}</span>
                    </span>
                  </button>
                </motion.li>
              )
            })}
          </ol>
        </motion.div>
      </div>
    </div>
  )
}
