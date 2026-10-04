'use client'

import { useEffect, useRef, useState } from 'react'
import { PERSONA_BANNER_SIZES } from '@/lib/persona/banner-size'
import { TrialNote } from '@/components/TrialCallout'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'

type Props = {
  projectId: string | null
  isPaid: boolean
  catchphrases: string[]
  initialImage?: string
  onUsageChanged: () => void
}

export default function PersonaBannerGenerator({ projectId, isPaid, catchphrases, initialImage, onUsageChanged }: Props) {
  const [catchphrase, setCatchphrase] = useState(catchphrases[0] || '')
  const [serviceName, setServiceName] = useState('')
  const [sizeKey, setSizeKey] = useState('google-responsive')
  const [image, setImage] = useState(initialImage || '')
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [quotaAction, setQuotaAction] = useState<'pricing' | 'contact' | null>(null)
  const [loading, setLoading] = useState(false)
  const pending = useRef<{ input: string; key: string } | null>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  const generate = async () => {
    if (!projectId || !isPaid || loading || !catchphrase.trim()) return
    const intent = image ? 'regenerate' : 'extra'
    const input = JSON.stringify({ projectId, intent, catchphrase: catchphrase.trim(), serviceName: serviceName.trim(), sizeKey })
    if (pending.current?.input !== input) pending.current = { input, key: crypto.randomUUID() }
    const requestKey = pending.current.key
    const active = new AbortController()
    controller.current = active
    setLoading(true)
    setError('')
    setErrorCode('')
    setQuotaAction(null)
    try {
      const response = await fetch('/api/persona/banner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: active.signal,
        body: JSON.stringify({ projectId, requestKey, slotKey: 'banner-default', intent,
          catchphrase: catchphrase.trim(), serviceName: serviceName.trim(), sizeKey }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        if (body?.code === 'REQUEST_CONFLICT') pending.current = null
        setErrorCode(typeof body?.code === 'string' ? body.code : '')
        setQuotaAction(body?.contactUrl === SUPPORT_CONTACT_URL ? 'contact' : body?.upgradeUrl === '/persona/pricing' ? 'pricing' : null)
        setError(typeof body?.error === 'string' ? body.error : 'バナー画像を生成できませんでした。時間を置いて再度お試しください。')
        return
      }
      if (typeof body?.image !== 'string' || !/^\/api\/persona\/images\/[a-zA-Z0-9_-]+$/.test(body.image)) throw new Error('画像の保存先を確認できませんでした。履歴から開き直してください。')
      pending.current = null
      setImage(body.image)
      onUsageChanged()
    } catch (cause) {
      if (!active.signal.aborted) setError(cause instanceof Error ? cause.message : 'バナー画像を生成できませんでした。')
    } finally {
      if (!active.signal.aborted) setLoading(false)
    }
  }

  return <section aria-label="ペルソナ向けバナー画像" className="rounded-xl border border-purple-200 bg-white p-5 export-hide">
    <h2 className="text-lg font-bold text-gray-900">ペルソナ向けバナー画像</h2>
    <p className="mt-1 text-sm text-gray-600">生成・再生成ごとに、追加画像枠を1枚使います。画像はこのペルソナの履歴に保存されます。</p>
    {!isPaid ? <div className="mt-4 rounded-lg bg-purple-50 p-4 text-sm text-purple-950">
      <p>バナー画像生成はプロプランで利用できます。</p>
      <a href="/persona/pricing" className="mt-2 inline-block font-bold text-purple-700 underline">プランを確認する</a>
      <TrialNote className="mt-2" />
    </div> : !projectId ? <p className="mt-4 text-sm text-gray-600">サーバーに保存したペルソナを開くと、バナー画像を生成できます。</p> : <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-gray-700 sm:col-span-2">キャッチコピー
          <input value={catchphrase} onChange={event => setCatchphrase(event.target.value)} maxLength={2000} disabled={loading} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
        </label>
        <label className="text-sm font-medium text-gray-700">サービス名（任意）
          <input value={serviceName} onChange={event => setServiceName(event.target.value)} maxLength={300} disabled={loading} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
        </label>
        <label className="text-sm font-medium text-gray-700">画像サイズ
          <select value={sizeKey} onChange={event => setSizeKey(event.target.value)} disabled={loading} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100">
            {Object.entries(PERSONA_BANNER_SIZES).map(([key, size]) => <option key={key} value={key}>{size.label}（{size.width}×{size.height}）</option>)}
          </select>
        </label>
      </div>
      <button type="button" onClick={() => void generate()} disabled={loading || !catchphrase.trim()} className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        {loading ? '生成中です…' : image ? 'バナーを再生成（追加枠1枚）' : 'バナーを生成（追加枠1枚）'}
      </button>
      {error && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <p>{error}</p>
        {(errorCode === 'DAILY_LIMIT_REACHED' || errorCode === 'PRO_REQUIRED') && quotaAction && <a href={quotaAction === 'contact' ? SUPPORT_CONTACT_URL : '/persona/pricing'} className="mt-2 inline-block font-bold underline">{quotaAction === 'contact' ? '追加の利用枠を相談する' : 'プランと利用枠を確認する'}</a>}
      </div>}
    </>}
    {image && <div className="mt-5">
      <p className="mb-2 text-sm font-medium text-gray-700">保存済みのバナー画像</p>
      <img src={image} alt="生成したペルソナ向けバナー画像" className="max-h-[500px] max-w-full rounded-lg border border-gray-200 object-contain" />
      <a href={image} download="persona-banner.png" className="mt-2 inline-block text-sm font-bold text-purple-700 underline">画像を保存する</a>
    </div>}
  </section>
}
