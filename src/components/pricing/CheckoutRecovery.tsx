'use client'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BillingResponseError, readBillingResponse } from '@/lib/billing-response-client'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'
import { parseCheckoutRecovery, recoveryBlocksNewPurchase, type CheckoutRecoveryView } from '@/lib/pricing-v2/checkout-recovery-view'
import styles from './CheckoutRecovery.module.css'

const COPY: Record<CheckoutRecoveryView['state'], string> = {
  none: '',
  creating: '決済画面の作成結果を確認中です。新しい申し込みを作らず、時間をおいてもう一度状況をご確認ください。解消しない場合はお問い合わせください。',
  ready: '途中のお申し込みがあります。決済画面の現在の状況をご確認ください。',
  open: '元の決済画面でお手続きを再開できます。現在選んでいる人数や支払い間隔へは変更されません。',
  complete: '決済画面でのお手続きは完了しています。契約の反映をご確認ください。新しい申し込みは作成しません。',
  expired: '元の決済画面の失効を確認しました。人数を選び直してお申し込みできます。',
  reconcile: '元のお申し込みの人数や結果を確認できません。新しい申し込みを作らず、お問い合わせください。',
  active: '有効なご契約があります。ページを更新して契約状況をご確認ください。新しい申し込みは作成しません。',
}
export default function CheckoutRecovery({ serverSignedIn, refreshKey, onBlockedChange }: {
  serverSignedIn: boolean; refreshKey: number; onBlockedChange: (blocked: boolean) => void
}) {
  const { data: session, status } = useSession()
  const router = useRouter(), titleId = useId()
  const ownerId = (session?.user as { id?: string } | undefined)?.id ?? ''
  const currentOwner = useRef(ownerId)
  currentOwner.current = status === 'authenticated' ? ownerId : ''
  const active = useRef<AbortController | null>(null)
  const [result, setResult] = useState<{ ownerId: string; value: CheckoutRecoveryView } | null>(null)
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [needsLogin, setNeedsLogin] = useState(false)
  const request = useCallback(async (method: 'GET' | 'POST') => {
    if (!ownerId || active.current) return
    const controller = new AbortController(), requestOwner = ownerId
    active.current = controller
    setBusy(true); setError(null); setNeedsLogin(false); setResult(null); onBlockedChange(true)
    try {
      const response = await readBillingResponse('/api/pricing/checkout-recovery', {
        method, headers: { 'x-doya-owner': ownerId, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        ...(method === 'POST' ? { body: JSON.stringify({ action: 'check' }) } : {}),
      }, controller.signal)
      if (controller.signal.aborted || currentOwner.current !== requestOwner || active.current !== controller) return
      if (!response.ok) {
        setNeedsLogin(response.status === 401 || response.status === 403)
        throw new Error(typeof response.data.error === 'string' ? response.data.error : '決済状況を確認できませんでした。もう一度ご確認ください。')
      }
      const value = parseCheckoutRecovery(response.data)
      if (!value) throw new Error('決済状況の応答を確認できませんでした。新しい申し込みを作らず、もう一度ご確認ください。')
      setResult({ ownerId: requestOwner, value }); onBlockedChange(recoveryBlocksNewPurchase(value))
    } catch (problem) {
      if (controller.signal.aborted || currentOwner.current !== requestOwner || active.current !== controller || problem instanceof BillingResponseError && problem.cancelled) return
      setError(problem instanceof BillingResponseError ? '決済状況を確認できませんでした。新しい申し込みを作らず、もう一度ご確認ください。' : problem instanceof Error ? problem.message : '決済状況を確認できませんでした。')
      onBlockedChange(true)
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false) }
    }
  }, [ownerId, onBlockedChange])
  useEffect(() => {
    active.current?.abort(); active.current = null; setResult(null); setError(null); setBusy(false); setNeedsLogin(false)
    if (status === 'loading') { onBlockedChange(serverSignedIn); return }
    if (status !== 'authenticated') { onBlockedChange(false); return }
    onBlockedChange(true)
    if (!ownerId) { setNeedsLogin(true); setError('ログイン情報を確認できません。再ログインしてください。'); return }
    void request('GET')
    return () => { active.current?.abort(); active.current = null }
  }, [status, ownerId, request, serverSignedIn, refreshKey, onBlockedChange])
  const value = status === 'authenticated' && result?.ownerId === ownerId ? result.value : null
  if (status === 'unauthenticated' || status === 'loading' && !serverSignedIn || value?.state === 'none') return null
  return <section className={styles.box} aria-labelledby={titleId} aria-busy={busy} data-checkout-recovery="true">
    <h2 id={titleId} className={styles.title}>お申し込みの状況</h2>
    {busy || status === 'loading' ? <div className={styles.loading} role="status"><span className={styles.skeleton} aria-hidden="true" /><p>決済状況を確認しています…</p></div> : null}
    {value ? <p className={styles.body} role="status">{COPY[value.state]}{value.seats === null ? '' : ' 元のお申し込みは' + value.seats + '人分です。'}</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <div className={styles.actions}>
      {value?.state === 'open' && value.url && !busy ? <a href={value.url} className={styles.primary}>元の決済画面を開く</a> : null}
      {needsLogin ? <Link href="/auth/signin?callbackUrl=%2Fpricing" className={styles.primary}>再ログインする</Link>
        : status === 'authenticated' ? <button type="button" onClick={() => void request('POST')} disabled={busy} className={styles.button}>{busy ? '確認しています…' : '決済状況を確認する'}</button> : null}
      {value?.state === 'complete' || value?.state === 'active' ? <button type="button" className={styles.button} onClick={() => router.refresh()}>契約状況を更新する</button> : null}
      {value?.state === 'reconcile' || value?.state === 'creating' || value?.state === 'complete' || value?.state === 'active' || error ? <a href={SUPPORT_CONTACT_URL} className={styles.button}>お問い合わせ</a> : null}
    </div>
  </section>
}
