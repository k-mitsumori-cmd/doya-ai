'use client'
// 招待を受けて会社に参加する画面（/pricing/join）。参加の判定はサーバー（/api/pricing/members/accept）
import { useState } from 'react'
import Link from 'next/link'
import ds from '@/components/ds/tokens.module.css'
import base from './PricingNext.module.css'
import styles from './PricingV2.module.css'

export default function JoinInvite({ token, signedIn, email }: { token: string; signedIn: boolean; email: string | null }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const callback = `/pricing/join?token=${encodeURIComponent(token)}`

  const accept = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/pricing/members/accept', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok) setDone(typeof d.companyName === 'string' ? d.companyName : '')
      else setError(typeof d.error === 'string' ? d.error : '参加できませんでした。')
    } catch { setError('参加できたか確認できませんでした。画面を読み込み直してください。') } finally { setBusy(false) }
  }

  return (
    <div className={`${ds.ds} ${base.page}`} data-ui-next="true">
      <header className={base.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/character/hello-512.webp" alt="" width={160} height={160} className={base.heroArt} />
        <p className={base.eyebrow}>チームへの招待</p>
        <h1 className={base.title}>会社のチームに<wbr />参加します</h1>
        <p className={base.lead}>参加すると、会社のドヤパワーでドヤAIのツールを使えます。</p>
      </header>
      <section className={styles.joinBox}>
        {!token ? <p className={base.notice}>招待のリンクを確かめてください。</p>
          : done !== null ? (
            <>
              <p className={styles.manageHead}>{done ? `${done} に参加しました。` : '参加しました。'}</p>
              <Link href="/home" className={base.primary}>ドヤAIを使いはじめる</Link>
            </>
          ) : !signedIn ? (
            <>
              <p className={styles.manageSub}>招待を受けたメールアドレスで、ログインしてください。</p>
              <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`} className={base.primary}>ログインして参加する</Link>
            </>
          ) : (
            <>
              <p className={styles.manageSub}>{email} として参加します。招待を受けたメールアドレスと同じか、確かめてください。</p>
              <button type="button" className={base.primary} onClick={accept} disabled={busy}>{busy ? '参加しています…' : '参加する'}</button>
            </>
          )}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </section>
    </div>
  )
}
