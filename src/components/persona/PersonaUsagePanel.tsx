'use client'

import { useEffect, useState } from 'react'

type Quota = { used: number; reserved: number; limit: number; remaining: number | null }
type Usage = { planLabel: string; text: Quota; extraImages: Quota; resetAt: string }

export default function PersonaUsagePanel({ refreshKey }: { refreshKey: string }) {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let alive = true
    let current: AbortController | undefined
    const refresh = async () => {
      current?.abort()
      const controller = new AbortController()
      current = controller
      try {
        const response = await fetch('/api/persona/usage', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Usage unavailable')
        const data = await response.json()
        if (!data?.text || !data?.extraImages || !Number.isFinite(Date.parse(data.resetAt))) throw new Error('Invalid usage')
        if (alive && !controller.signal.aborted) { setUsage(data); setFailed(false) }
      } catch {
        if (alive && !controller.signal.aborted) { setUsage(null); setFailed(true) }
      }
    }
    void refresh()
    const interval = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { alive = false; current?.abort(); clearInterval(interval); window.removeEventListener('focus', refresh) }
  }, [refreshKey, retry])

  return <section aria-label="本日の利用枠" className="mb-6 rounded-xl border border-purple-200 bg-white p-4 text-sm text-gray-700">
    <p className="font-bold">本日の利用枠{usage ? `（${usage.planLabel}）` : ''}</p>
    {usage ? <>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
        <p>ペルソナ生成・文章変更：{usage.text.remaining === null ? '上限なし' : `残り${usage.text.remaining}回 / ${usage.text.limit}回`}{usage.text.reserved > 0 ? `・処理中${usage.text.reserved}回は予約済み` : ''}</p>
        <p>追加画像・再生成：残り{usage.extraImages.remaining}枚 / {usage.extraImages.limit}枚{usage.extraImages.reserved > 0 ? `・処理中${usage.extraImages.reserved}枚は予約済み` : ''}</p>
      </div>
      <p className="mt-2 text-xs text-gray-500">付属画像は最大16枚までペルソナ1件に含まれ、追加枠を消費しません。利用枠は毎日0時（日本時間）にリセットされます。</p>
      {(usage.text.remaining === 0 || usage.extraImages.remaining === 0) && <p className="mt-3">本日の利用枠が上限に達しました。<a href="/persona/pricing" className="ml-2 font-bold text-purple-700 underline">プランと利用枠を確認する</a></p>}
    </> : <p className="mt-2" role="status">{failed ? '利用状況を取得できませんでした。残り枠は未確認です。' : '利用状況を確認しています。'}{failed && <button type="button" onClick={() => setRetry(value => value + 1)} className="ml-2 text-purple-700 underline">再取得する</button>}</p>}
  </section>
}
