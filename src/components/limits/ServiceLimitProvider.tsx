'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { LIMIT_EVENT, observeServiceLimits, type ServiceLimit } from '@/lib/service-limit-ui'
import { TrialNote, useTrialEligible, TRIAL_DAYS } from '@/components/TrialCallout'
import { HIGH_USAGE_CONTACT_URL } from '@/lib/pricing'
import { isPaidPlan, UNIFIED_PRO_PRICE_LABEL } from '@/lib/unified-plan'

export default function ServiceLimitProvider() {
  const { data: session, status } = useSession()
  const key = status + ':' + ((session?.user as any)?.id || session?.user?.email || '') + ':' + ((session?.user as any)?.plan || '')
  const account = useRef(key); account.current = key
  const [notice, setNotice] = useState<{ key: string; limit: ServiceLimit } | null>(null)
  const limit = notice?.key === key ? notice.limit : null
  const panel = useRef<HTMLDivElement>(null)
  const eligible = useTrialEligible()
  const paid = isPaidPlan((session?.user as any)?.plan)
  const dismiss = () => setNotice(null)

  useEffect(() => {
    let active = true
    const original = window.fetch
    const notify = (next: ServiceLimit) => {
      if (!active || account.current !== key) return
      // These four banner screens already own a richer quota modal.
      if (next.service === 'banner' && ['/banner/dashboard', '/banner/test', '/banner/dashboard/create', '/banner/dashboard/chat'].includes(window.location.pathname)) return
      setNotice({ key, limit: next })
    }
    const wrapped = observeServiceLimits(original, window.location.origin, notify)
    window.fetch = wrapped
    const receive = (event: Event) => notify((event as CustomEvent<ServiceLimit>).detail)
    window.addEventListener(LIMIT_EVENT, receive)
    return () => { active = false; if (window.fetch === wrapped) window.fetch = original; window.removeEventListener(LIMIT_EVENT, receive) }
  }, [key])

  useEffect(() => {
    if (!limit) return
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotice(null)
      if (e.key !== 'Tab') return
      const items = panel.current?.querySelectorAll<HTMLElement>('button, a[href]')
      const first = items?.[0], last = items?.[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler); previous?.focus() }
  }, [limit?.service, !!limit])

  if (!limit || status === 'loading') return null
  const guest = status === 'unauthenticated'
  const selfService = limit.kind !== 'owner' && limit.kind !== 'capacity'
  const href = guest ? `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}` : paid ? HIGH_USAGE_CONTACT_URL || '/pricing' : limit.pricingHref
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4" onClick={dismiss}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="service-limit-title" tabIndex={-1} onClick={e => e.stopPropagation()} className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
        <button type="button" aria-label="閉じる" onClick={dismiss} className="absolute right-4 top-3 p-2 text-xl">×</button>
        <p className="pr-8 text-sm font-bold text-violet-700">{limit.name}</p>
        <h2 id="service-limit-title" className="mt-3 text-xl font-bold">{limit.kind === 'feature' ? 'この機能を利用するには' : 'ご利用枠をご確認ください'}</h2>
        <p className="mt-3 text-sm leading-7">{limit.kind === 'owner' ? 'このサービスの契約者の利用枠に達しました。招待元の担当者に利用枠の確認を依頼してください。' : limit.kind === 'capacity' ? '登録できるワークスペース数に達しました。不要なワークスペースを整理してから、もう一度お試しください。' : guest ? '無料登録・ログイン後の利用条件をご確認いただけます。入力内容を確認してからお進みください。' : paid ? '有料プランにも利用枠があります。料金ページで条件を確認するか、追加のご利用についてご相談ください。' : `プロプラン（月額${UNIFIED_PRO_PRICE_LABEL}）で利用枠や機能を広げられます。対象の機能・上限は料金ページでご確認ください。`}</p>
        {selfService && !guest && !paid && <TrialNote className="mt-3" />}
        {selfService && <a href={href} className="mt-5 block rounded-xl bg-violet-700 px-4 py-3 text-center font-bold text-white">{guest ? '無料登録・ログインして続ける' : paid ? '追加の利用枠を相談する' : eligible ? `${TRIAL_DAYS}日間無料の対象プランを確認する` : 'プラン・利用条件を確認する'}</a>}
        {selfService && paid && <a href={limit.pricingHref} className="mt-3 block text-center text-sm text-violet-700 underline">料金・利用条件を確認する</a>}
        <button type="button" onClick={dismiss} className="mt-3 w-full rounded-xl p-3 text-sm text-slate-600">{selfService ? '閉じて作業に戻る' : '確認して作業に戻る'}</button>
      </div>
    </div>, document.body)
}
