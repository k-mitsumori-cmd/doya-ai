'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ImagePlus, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { Modal } from './ui'
import { IMAGE_MODELS, estimateCost, type ImageSize } from '@/lib/tenjikai/imagegen'
import { ds } from '@/lib/tenjikai/tokens'
import EmptyState from './EmptyState'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  prompt: string
  aspectRatio: string
  getReference?: () => Promise<string | undefined>
  onResult: (images: string[]) => void
  /** サーバーの実行記録に残す種類 */
  kind?: 'creative_image' | 'booth_render' | 'graphic_panel'
}

export default function ImageGenModal({ open, onClose, title, prompt: initialPrompt, aspectRatio, getReference, onResult, kind = 'creative_image' }: Props) {
  const [model, setModel] = useState(IMAGE_MODELS[0].id)
  const [size, setSize] = useState<ImageSize>('2K')
  const [count, setCount] = useState(1)
  const [prompt, setPrompt] = useState(initialPrompt)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  // 失敗の種類で出し分ける（統合仕様 §11。ステータスコードなどの技術的な文言は出さない）
  const [error, setError] = useState<{ tone: 'error' | 'forbidden' | 'disabled'; message: string }>()

  useEffect(() => {
    if (open) {
      setPrompt(initialPrompt)
      setAgreed(false)
      setError(undefined)
    }
  }, [open, initialPrompt])

  const est = estimateCost(model, size, count)

  const run = async () => {
    setBusy(true)
    setError(undefined)
    try {
      const referencePng = getReference ? await getReference() : undefined
      const res = await fetch('/api/tenjikai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model, size, aspectRatio, count, approved: true, expectedCostYen: est.totalYen, referencePng, kind }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 401) return setError({ tone: 'forbidden', message: 'ログインすると、画像を作れます。' })
      if (res.status === 403) return setError({ tone: 'disabled', message: '画像の生成は準備中です。いまは使えません。' })
      if (res.status >= 500) return setError({ tone: 'error', message: '画像を作れませんでした。時間をおいて、もう一度お試しください。' })
      if (!res.ok) return setError({ tone: 'error', message: typeof json.error === 'string' ? json.error : '画像を作れませんでした。' })
      onResult(json.images)
      onClose()
    } catch {
      setError({ tone: 'error', message: '通信できませんでした。接続を確かめて、もう一度お試しください。' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {IMAGE_MODELS.map((m) => (
            <button key={m.id} onClick={() => setModel(m.id)} className={clsx('rounded-[var(--r-sm)] border-2 p-3 text-left', model === m.id ? 'border-doya-500 bg-doya-50' : 'border-gray-200')}>
              <p className="text-sm font-black text-ink">{m.label}</p>
              <p className="font-mono text-[10px] text-gray-500">{m.id}</p>
              <p className="mt-1 text-[11px] text-gray-600">{m.note}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-500">解像度</span>
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
              {(['1K', '2K', '4K'] as ImageSize[]).map((s) => (
                <button key={s} onClick={() => setSize(s)} className={clsx('rounded-lg px-3 py-1 font-mono text-xs', size === s ? 'bg-white text-doya-600 shadow' : 'text-gray-500')}>{s}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-500">枚数</span>
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} onClick={() => setCount(n)} className={clsx('rounded-lg px-3 py-1 font-mono text-xs', count === n ? 'bg-white text-doya-600 shadow' : 'text-gray-500')}>{n}</button>
              ))}
            </div>
          </div>
          <span className="font-mono text-xs text-gray-500">比率 {aspectRatio}</span>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-black text-gray-500">プロンプト（編集できます）</span>
          <textarea id="imagegen-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} className="rounded-xl border-2 border-gray-200 p-3 text-xs leading-relaxed outline-none focus:border-doya-500" />
        </label>

        <div className="overflow-hidden rounded-[var(--r-sm)] border border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 border-b border-amber-200 px-4 py-2 text-xs font-black text-amber-800">
            <AlertTriangle className="h-4 w-4" /> 従量課金のAPIを使います。実行前に見込み額を確認してください
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 px-4 py-3 text-xs sm:grid-cols-5">
            <div><dt className="text-amber-700">モデル</dt><dd className="font-bold text-ink">{est.model.label}</dd></div>
            <div><dt className="text-amber-700">解像度</dt><dd className="font-mono text-ink">{size}</dd></div>
            <div><dt className="text-amber-700">単価</dt><dd className="font-mono text-ink">${est.unitUsd} ≒ ¥{est.unitYen}</dd></div>
            <div><dt className="text-amber-700">回数</dt><dd className="font-mono text-ink">{count}枚</dd></div>
            <div><dt className="text-amber-700">合計見込み</dt><dd className="font-mono text-base font-semibold text-ink">¥{est.totalYen.toLocaleString()}</dd></div>
          </dl>
          <p className="px-4 pb-3 text-[10px] text-amber-700">単価は目安（1ドル{150}円換算）です。最新の料金はGoogleの料金ページで確認してください。</p>
        </div>

        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          <input id="imagegen-agree" type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 accent-doya-500" />
          見込み額 ¥{est.totalYen.toLocaleString()} を確認しました
        </label>

        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-[var(--r-sm)] border border-gray-200 bg-white">
            <EmptyState
              compact
              tone={error.tone === 'disabled' ? 'empty' : error.tone}
              image={error.tone === 'disabled' ? '/empty/preparing.svg' : undefined}
              title={error.message}
              action={
                error.tone === 'forbidden'
                  ? { label: 'ログインする', href: '/auth/signin?callbackUrl=%2Ftenjikai' }
                  : error.tone === 'error'
                    ? { label: 'もう一度', onClick: () => void run() }
                    : undefined
              }
            />
          </motion.div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100">キャンセル</button>
          <button disabled={!agreed || busy} onClick={run} className="inline-flex items-center gap-2 rounded-xl bg-doya-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-doya-500/30 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            ¥{est.totalYen.toLocaleString()} で生成する
          </button>
        </div>
      </div>
    </Modal>
  )
}

// SVG要素をPNG（base64）に変換して、画像生成の参照画像に使う
export async function svgToPngBase64(svg: SVGSVGElement, width = 1280): Promise<string | undefined> {
  const vb = svg.viewBox.baseVal
  const ratio = vb && vb.width ? vb.height / vb.width : 0.75
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(Math.round(width * ratio)))
  const xml = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((ok, ng) => {
      img.onload = () => ok()
      img.onerror = () => ng(new Error('SVGの読み込みに失敗しました'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = Math.round(width * ratio)
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.fillStyle = ds.paper
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png').split(',')[1]
  } finally {
    URL.revokeObjectURL(url)
  }
}
