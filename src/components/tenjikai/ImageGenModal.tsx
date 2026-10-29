'use client'

// 画像を1つ作る確認の画面（制作物・面のグラフィック・完成予想図）。
// ⚠️ 原価・モデル・解像度は利用者に見せない（2026-10-19 ユーザー指示）。見せるのは、きょう作れる残りの枚数だけ。
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ImagePlus, Loader2 } from 'lucide-react'
import { Modal } from './ui'
import EmptyState from './EmptyState'
import { IMAGEGEN_DISABLED_MESSAGE, isImageGenDisabled, remainingLabel, requestImages, useImageQuota, type ImageGenFailure, type ImageGenKind } from './useImageGen'
import { ds } from '@/lib/tenjikai/tokens'
import { ShellCostBadge } from '@/components/shell/power'
import DoyaWorking, { type WorkingColors } from '@/components/shell/DoyaWorking'

/** 1枚作る間の、一言の目安（いま何をしている途中か。順に入れ替えて出す） */
const WORKING_STEPS = ['ブースの決まりの色を、壁に乗せています', '見出しを置く場所を空けています', '帯と円の形を整えています', 'もうすぐ、できあがります']

interface Props {
  open: boolean
  onClose: () => void
  title: string
  prompt: string
  aspectRatio: string
  getReference?: () => Promise<string | undefined>
  onResult: (images: string[]) => void | Promise<void>
  /** サーバーの実行記録に残す種類 */
  kind?: ImageGenKind
  /** 待っている間に塗る色（ブランドの色） */
  colors?: Partial<WorkingColors>
  /** 作れない理由（デザインの決まりを確定していないときなど）。あれば、ボタンを押せなくして出す */
  blockedReason?: string
}

export default function ImageGenModal({ open, onClose, title, prompt: initialPrompt, aspectRatio, getReference, onResult, kind = 'creative_image', colors, blockedReason }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ImageGenFailure>()
  const { quota, refresh } = useImageQuota()

  useEffect(() => {
    if (open) {
      setPrompt(initialPrompt)
      setError(undefined)
      void refresh()
    }
  }, [open, initialPrompt, refresh])

  const run = async () => {
    setBusy(true)
    setError(undefined)
    const referencePng = getReference ? await getReference().catch(() => undefined) : undefined
    const r = await requestImages({ prompt, aspectRatio, kind, referencePng })
    setBusy(false)
    void refresh()
    if (!r.ok) return setError(r)
    await onResult(r.images)
    onClose()
  }

  const left = remainingLabel(quota)
  const noneLeft = quota?.enabled && quota.remaining === 0
  // サーバーが画像の生成を止めている（準備中）。押す前に分かるように出す
  const disabled = isImageGenDisabled(quota) || !!blockedReason

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-5">
        {busy ? (
          <DoyaWorking compact title="ドヤくんが画像を作っています" caption="1枚作るのに、30秒ほどかかります。このままお待ちください。" steps={WORKING_STEPS} colors={colors} />
        ) : (
          <p className="text-[15px] leading-relaxed text-[var(--sub)]">ブースの案とサイトの内容から、画像を1枚作ります。できた画像は、この画面に表示されます。</p>
        )}
        {left && <p className="text-[13px] font-medium text-[var(--sub)]">{left}</p>}
        {disabled && !error && <p role="alert" className="rounded-[var(--r-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-900">{blockedReason ?? IMAGEGEN_DISABLED_MESSAGE}</p>}

        <details className="rounded-[var(--r-sm)] border border-gray-200 p-3">
          <summary className="cursor-pointer text-[13px] font-bold text-ink">画像への指示を見る・直す</summary>
          <textarea id="imagegen-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} className="mt-2 w-full rounded-xl border-2 border-gray-200 p-3 text-xs leading-relaxed outline-none focus:border-doya-500" />
        </details>

        {error && (
          <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="rounded-[var(--r-sm)] border border-gray-200 bg-white">
            <EmptyState
              compact
              tone={error.tone === 'forbidden' ? 'forbidden' : error.tone === 'error' ? 'error' : 'empty'}
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
          <button onClick={onClose} className="min-h-[44px] rounded-xl px-4 text-sm font-bold text-gray-500 hover:bg-gray-100">キャンセル</button>
          <button disabled={busy || noneLeft || disabled} onClick={run} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-doya-500 px-5 text-sm font-black text-white shadow-lg shadow-doya-500/30 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {busy ? '作っています' : '画像を作る'}
            <ShellCostBadge action="tenjikai.image" />
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
