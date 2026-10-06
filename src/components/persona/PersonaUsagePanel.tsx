'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { readBillingResponse } from '@/lib/billing-response-client'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'

type Quota = { used: number; reserved: number; limit: number; remaining: number | null }
type Usage = { planLabel: string; text: Quota; extraImages: Quota; resetAt: string }

/** Invalid allowance data must never imply a usable or unlimited allowance. */
export function parsePersonaUsage(value: unknown): Usage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (body.error !== undefined || body.code !== undefined || !['FREE', 'PRO'].includes(body.planLabel as string) ||
    typeof body.resetAt !== 'string' || body.resetAt.length > 64 || !Number.isFinite(Date.parse(body.resetAt))) return null
  const validQuota = (value: unknown, unlimited: boolean) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const q = value as Quota
    if (!Number.isSafeInteger(q.used) || q.used < 0 || !Number.isSafeInteger(q.reserved) || q.reserved < 0 ||
      !Number.isSafeInteger(q.limit) || q.limit < (unlimited ? -1 : 0)) return false
    return q.limit === -1 ? q.remaining === null : Number.isSafeInteger(q.remaining) && q.remaining === Math.max(0, q.limit - q.used - q.reserved)
  }
  return validQuota(body.text, true) && validQuota(body.extraImages, false) ? body as Usage : null
}

export default function PersonaUsagePanel({ refreshKey }: { refreshKey: string }) {
  const { data: session, status } = useSession()
  const user = session?.user as { id?: string; plan?: string } | undefined
  const allowed = status === 'authenticated' && Boolean(user?.id)
  const [retry, setRetry] = useState(0)
  const scope = JSON.stringify([status, user?.id, user?.plan, refreshKey, retry])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const context = useRef(key)
  context.current = key
  const [snapshot, setSnapshot] = useState<{ key: string; usage: Usage | null; failed: boolean } | null>(null)
  const usage = allowed && snapshot?.key === key ? snapshot.usage : null
  const failed = status === 'authenticated' && (!allowed || (snapshot?.key === key && snapshot.failed))
  useEffect(() => {
    if (!allowed) return
    let alive = true
    let pending: AbortController | null = null
    const refresh = () => {
      if (!alive || context.current !== key || pending) return
      const controller = new AbortController()
      pending = controller
      const current = () => alive && context.current === key && !controller.signal.aborted
      setSnapshot({ key, usage: null, failed: false })
      void Promise.resolve().then(async () => {
        if (!current()) return
        try {
          const response = await readBillingResponse('/api/persona/usage', { method: 'GET' }, controller.signal)
          if (!current()) return
          const next = response.ok ? parsePersonaUsage(response.data) : null
          setSnapshot({ key, usage: next, failed: !next })
          if (next) window.dispatchEvent(new window.CustomEvent('persona:usage-changed', { detail: { actor: user?.id } }))
        } catch {
          if (current()) setSnapshot({ key, usage: null, failed: true })
        } finally {
          if (pending === controller) pending = null
          controller.abort()
        }
      })
    }
    refresh()
    const interval = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { alive = false; pending?.abort(); window.clearInterval(interval); window.removeEventListener('focus', refresh) }
  }, [allowed, key, user?.id])

  return <section aria-label="本日の利用枠" className="mb-6 rounded-xl border border-purple-200 bg-white p-4 text-sm text-gray-700">
    <p className="font-bold">本日の利用枠{usage ? `（${usage.planLabel}）` : ''}</p>
    {usage ? <>
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
        <p>ペルソナ生成・文章変更：{usage.text.remaining === null ? '上限なし' : `残り${usage.text.remaining}回 / ${usage.text.limit}回`}{usage.text.reserved > 0 ? `・処理中${usage.text.reserved}回は予約済み` : ''}</p>
        <p>追加画像・再生成：残り{usage.extraImages.remaining}枚 / {usage.extraImages.limit}枚{usage.extraImages.reserved > 0 ? `・処理中${usage.extraImages.reserved}枚は予約済み` : ''}</p>
      </div>
      <p className="mt-2 text-xs text-gray-500">付属画像は最大16枚までペルソナ1件に含まれ、追加枠を消費しません。利用枠は毎日0時（日本時間）にリセットされます。</p>
      {(usage.text.remaining === 0 || usage.extraImages.remaining === 0) && <p className="mt-3">本日の利用枠が上限に達しました。<a href={usage.planLabel === 'PRO' ? SUPPORT_CONTACT_URL : '/persona/pricing'} className="ml-2 font-bold text-purple-700 underline">{usage.planLabel === 'PRO' ? '追加の利用枠を相談する' : 'プランと利用枠を確認する'}</a></p>}
    </> : <p className="mt-2" role="status">{failed ? '利用状況を取得できませんでした。残り枠は未確認です。' : '利用状況を確認しています。'}{failed && <button type="button" onClick={() => setRetry(value => value + 1)} className="ml-2 text-purple-700 underline">再取得する</button>}</p>}
  </section>
}
