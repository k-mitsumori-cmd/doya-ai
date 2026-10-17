'use client'

// ============================================
// ドヤポップアップ プレビュー
// ============================================
// ⚠️ 本番と同じ public/popup/embed.js で描く（React で描き直さない。見た目がずれるため）。
//    iframe の中に仮のページを作り、window.__DOYA_POPUP_PREVIEW__ に設定を渡すと、
//    embed.js は条件・頻度を見ずにすぐ表示し、計測もしない。
import { useEffect, useMemo, useState } from 'react'
import type { PopupDto } from '@/lib/popup/dto'

/** 画面の値を embed.js が読む形にする（dto.ts の toEmbedPopup と同じ項目） */
export function toPreviewPopup(p: PopupDto) {
  const c = p.creative
  return {
    id: p.id,
    kind: p.kind,
    layout: c.layout,
    eyebrow: c.eyebrow,
    headline: c.headline,
    sub: c.sub,
    bubbles: c.bubbles,
    buttonLabel: c.buttonLabel,
    buttonUrl: c.buttonUrl,
    note: c.note,
    links: c.links,
    colors: c.colors,
    image: p.kind === 'image' && p.imageUrl ? { url: p.imageUrl, width: c.imageWidth, height: c.imageHeight, alt: c.imageAlt } : null,
    trigger: p.trigger,
    targeting: p.targeting,
    frequency: p.frequency,
  }
}

/** </script> などで抜け出せないように、JSON の < > & をエスケープする */
function safeJson(v: unknown): string {
  return JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

function srcDoc(popup: ReturnType<typeof toPreviewPopup>, origin: string): string {
  // 仮のページ（サイトの上に出るイメージを掴めるように、本文らしい灰色の線を置く）
  const lines = (n: number) => Array.from({ length: n }, (_, i) => `<div class="l" style="width:${60 + ((i * 37) % 35)}%"></div>`).join('')
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:sans-serif;background:#f8f7f6}.h{height:48px;background:#fff;border-bottom:1px solid #eee}.w{padding:28px 24px;max-width:960px;margin:0 auto}.t{height:22px;width:45%;background:#e7e3e1;border-radius:6px;margin-bottom:22px}.l{height:11px;background:#ece8e6;border-radius:6px;margin:12px 0}.b{height:120px;background:#efebe9;border-radius:12px;margin:22px 0}</style>
</head><body><div class="h"></div><div class="w"><div class="t"></div>${lines(5)}<div class="b"></div>${lines(14)}</div>
<script>window.__DOYA_POPUP_PREVIEW__=${safeJson({ popup })};</script>
<script src="${origin}/popup/embed.js"></script></body></html>`
}

export default function PopupPreview({ popup, device, height = 560 }: { popup: PopupDto; device: 'pc' | 'sp'; height?: number }) {
  const preview = useMemo(() => toPreviewPopup(popup), [popup])
  const key = useMemo(() => safeJson(preview), [preview])
  // 打鍵ごとに iframe を作り直さないよう、少し待ってから反映する
  const [doc, setDoc] = useState<string | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setDoc(srcDoc(preview, window.location.origin)), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const width = device === 'sp' ? 375 : '100%'
  return (
    <div className="flex justify-center rounded-2xl border border-slate-200 bg-slate-100 p-3">
      {doc ? (
        <iframe
          key={`${device}:${key}`}
          title="ポップアップのプレビュー"
          srcDoc={doc}
          style={{ width, height, border: 0, borderRadius: 14, background: '#fff', boxShadow: '0 1px 3px rgba(15,23,42,.08)' }}
        />
      ) : (
        <div style={{ width, height }} className="animate-pulse rounded-[14px] bg-white" />
      )}
    </div>
  )
}
