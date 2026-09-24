'use client'

import { useState } from 'react'

export function InviteDeliveryNotice({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setCopyFailed(false)
    } catch {
      setCopied(false)
      setCopyFailed(true)
    }
  }

  return (
    <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-bold">招待メールの送信を確認できませんでした。</p>
      <p className="mt-1">招待は作成済みです。下のリンクをコピーし、招待先の方に共有してください。</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input aria-label="招待リンク" readOnly value={url} onFocus={(event) => event.target.select()} className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-slate-900" />
        <button type="button" onClick={copy} className="rounded-lg bg-amber-900 px-4 py-2 font-bold text-white">
          {copied ? 'コピーしました' : 'リンクをコピー'}
        </button>
      </div>
      {copyFailed ? <p className="mt-2">コピーできませんでした。リンク欄を選択して手動でコピーしてください。</p> : null}
    </div>
  )
}
