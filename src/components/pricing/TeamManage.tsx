'use client'
// ============================================
// チームの管理（人数・メンバー・ドヤパワーの追加購入）。新しい料金ページ（PricingV2）の中だけ
// ============================================
// ⚠️ 判定（持ち主か・人数の上限・据え置き）はすべてサーバー（/api/pricing/*）。ここは出すだけ。
// ⚠️ 人数を増やすと、その場で日割りを請求する。押す前に必ず確かめの文を出す（ConfirmDialog）。
// ⚠️ 招待のメールは送らない。招待のリンクを出し、持ち主が相手に渡す。
import { useCallback, useEffect, useId, useState } from 'react'
import { Minus, Plus, Copy, Check } from 'lucide-react'
import { confirmDialog } from '@/components/ds'
import { POWER_PACK, TEAM_MONTHLY_POINTS_PER_SEAT, teamMonthly, withTax } from '@/lib/pricing-v2/plans'
import base from './PricingNext.module.css'
import styles from './PricingV2.module.css'

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`

type Member = { id: string; email: string; role: string; status: string }

async function call(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetch(path, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const data = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, data }
}

/** 人数とメンバー（チームの持ち主だけ） */
export function TeamManage() {
  const [seats, setSeats] = useState<number | null>(null)
  const [used, setUsed] = useState<number | null>(null)
  const [draft, setDraft] = useState<number>(1)
  const [members, setMembers] = useState<Member[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const emailId = useId()

  const reload = useCallback(async () => {
    const [s, m] = await Promise.all([call('/api/pricing/seats'), call('/api/pricing/members')])
    if (s.ok) { setSeats(s.data.seats); setUsed(s.data.used); setDraft(s.data.seats); setLoadFailed(false) } else { setLoadFailed(true); setMessage(s.data.error ?? '人数を読み込めませんでした。') }
    if (m.ok) setMembers(m.data.members ?? [])
  }, [])
  useEffect(() => { void reload() }, [reload])

  const changeSeats = async () => {
    if (seats === null || draft === seats || busy) return
    const up = draft > seats
    const ok = await confirmDialog({
      title: `人数を${draft}人に${up ? '増やします' : '減らします'}`,
      message: up
        ? `今日から次の請求日までの日割りの額を、いま請求します。お支払いが済まないときは、人数は変わりません。毎月のドヤパワーは来月から ${(draft - seats) * TEAM_MONTHLY_POINTS_PER_SEAT} 増え、今月は残りの日数の分を足します。`
        : '減らした分の返金はありません。人数はすぐに減ります。',
      confirmLabel: up ? '増やして請求する' : '減らす',
    })
    if (!ok) return
    setBusy(true); setMessage(null)
    try {
      // 確かめの画面の1回ごとに操作 ID を作る（同じ操作の二重送信は Stripe で1回にまとまる）
      const operationKey = crypto.randomUUID().replace(/-/g, '')
      const r = await call('/api/pricing/seats', { method: 'POST', body: JSON.stringify({ seats: draft, operationKey }) })
      setMessage(r.ok ? `人数を${r.data.seats}人にしました。` : (r.data.error ?? '人数を変えられたか確認できませんでした。'))
      await reload()
    } catch {
      setMessage('人数を変えられたか確認できませんでした。画面を読み込み直して、今の人数をご確認ください。')
    } finally { setBusy(false) }
  }

  const invite = async () => {
    if (busy || !email.trim()) return
    setBusy(true); setMessage(null); setInviteUrl(null); setCopied(false)
    try {
      const r = await call('/api/pricing/members', { method: 'POST', body: JSON.stringify({ email }) })
      if (r.ok) { setInviteUrl(r.data.inviteUrl); setEmail(''); await reload() } else setMessage(r.data.error ?? '招待できませんでした。')
    } catch { setMessage('招待できませんでした。時間をおいて再度お試しください。') } finally { setBusy(false) }
  }

  const remove = async (m: Member) => {
    const ok = await confirmDialog({ title: `${m.email} を外します`, message: '外した方は、この会社のドヤパワーを使えなくなります。あとから招待し直せます。', confirmLabel: '外す', tone: 'danger' })
    if (!ok) return
    setBusy(true); setMessage(null)
    try {
      const r = await call(`/api/pricing/members?id=${encodeURIComponent(m.id)}`, { method: 'DELETE' })
      if (!r.ok) setMessage(r.data.error ?? '外せませんでした。')
      await reload()
    } catch { setMessage('外せませんでした。時間をおいて再度お試しください。') } finally { setBusy(false) }
  }

  const minSeats = Math.max(1, used ?? 1)
  const diff = seats !== null ? (teamMonthly(draft) ?? 0) - (teamMonthly(seats) ?? 0) : 0

  return (
    <section className={styles.manage} aria-labelledby="manage-title">
      <h2 id="manage-title" className={base.sectionTitle}>チームの管理</h2>
      <div className={styles.manageGrid}>
        <div className={styles.manageCard}>
          <p className={styles.manageHead}>人数</p>
          <p className={styles.manageSub}>{seats === null ? (loadFailed ? '人数を読み込めませんでした。' : '読み込んでいます…') : `今の人数 ${seats}人・使っている人数 ${used ?? '—'}人（持ち主と招待中を含む）`}</p>
          <div className={styles.stepper}>
            <button type="button" className={styles.stepBtn} aria-label="1人減らす" onClick={() => setDraft((d) => Math.max(minSeats, d - 1))} disabled={busy || seats === null || draft <= minSeats}><Minus size={18} /></button>
            <span className={styles.seatValue}><span className={styles.seatNum}>{draft}</span><span>人</span></span>
            <button type="button" className={styles.stepBtn} aria-label="1人増やす" onClick={() => setDraft((d) => Math.min(49, d + 1))} disabled={busy || seats === null || draft >= 49}><Plus size={18} /></button>
          </div>
          <p className={styles.manageSub}>
            {seats !== null && draft !== seats ? `月額（税抜）が ${diff > 0 ? '+' : '−'}${yen(Math.abs(diff))} 変わります（税込 ${yen(withTax(Math.abs(diff)))}）` : '50人以上は個別にお見積りします。'}
          </p>
          <button type="button" className={base.primary} onClick={changeSeats} disabled={busy || seats === null || draft === seats}>人数を変える</button>
        </div>

        <div className={styles.manageCard}>
          <p className={styles.manageHead}>メンバー</p>
          <label htmlFor={emailId} className={styles.manageSub}>招待する方のメールアドレス</label>
          <div className={styles.inviteRow}>
            <input id={emailId} type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.textInput} placeholder="name@example.com" />
            <button type="button" className={base.secondary} onClick={invite} disabled={busy || !email.trim()}>招待する</button>
          </div>
          {inviteUrl ? (
            <div className={styles.inviteUrl}>
              <p className={styles.manageSub}>このリンクを、招待した方に渡してください（メールは送っていません）。</p>
              <div className={styles.inviteRow}>
                <input readOnly value={inviteUrl} className={styles.textInput} aria-label="招待のリンク" onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className={base.secondary} onClick={() => { void navigator.clipboard?.writeText(inviteUrl).then(() => setCopied(true)) }}>
                  {copied ? <><Check size={16} />写しました</> : <><Copy size={16} />写す</>}
                </button>
              </div>
            </div>
          ) : null}
          <ul className={styles.memberList}>
            {members.length === 0 ? <li className={styles.manageSub}>まだメンバーはいません。</li> : members.map((m) => (
              <li key={m.id}>
                <span className={styles.memberEmail}>{m.email}</span>
                <span className={styles.memberStatus}>{m.status === 'active' ? '参加' : '招待中'}</span>
                <button type="button" className={styles.linkBtn} onClick={() => remove(m)} disabled={busy}>外す</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {message ? <p className={base.notice} role="status">{message}</p> : null}
    </section>
  )
}

/** ドヤパワーの追加購入（有料の会社の持ち主。判定はサーバー） */
export function PowerPackBuy() {
  const [packs, setPacks] = useState(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const buy = async () => {
    if (busy) return
    setBusy(true); setMessage(null)
    try {
      const r = await call('/api/pricing/power-pack', { method: 'POST', body: JSON.stringify({ packs }) })
      if (r.ok && typeof r.data.url === 'string' && r.data.url.startsWith('https://')) { window.location.href = r.data.url; return }
      setMessage(r.data.error ?? '決済画面を開けませんでした。')
    } catch { setMessage('決済画面を開けたか確認できませんでした。重ねて買わずに、少し待ってからお試しください。') }
    setBusy(false)
  }
  return (
    <div className={styles.packBox}>
      <div>
        <p className={styles.manageHead}>ドヤパワーを追加で買う</p>
        <p className={styles.manageSub}>{POWER_PACK.points.toLocaleString('ja-JP')}ごとに {yen(POWER_PACK.price)}（税込 {yen(withTax(POWER_PACK.price))}）。買った分は6か月使えます。</p>
      </div>
      <div className={styles.packRow}>
        <div className={styles.stepper}>
          <button type="button" className={styles.stepBtn} aria-label="1つ減らす" onClick={() => setPacks((p) => Math.max(1, p - 1))} disabled={busy || packs <= 1}><Minus size={18} /></button>
          <span className={styles.seatValue}><span className={styles.seatNum}>{(packs * POWER_PACK.points).toLocaleString('ja-JP')}</span></span>
          <button type="button" className={styles.stepBtn} aria-label="1つ増やす" onClick={() => setPacks((p) => Math.min(10, p + 1))} disabled={busy || packs >= 10}><Plus size={18} /></button>
        </div>
        <button type="button" className={base.primary} onClick={buy} disabled={busy}>{busy ? '決済画面を準備しています…' : `${yen(withTax(packs * POWER_PACK.price))}（税込）で買う`}</button>
      </div>
      {message ? <p className={styles.error} role="alert">{message}</p> : null}
    </div>
  )
}

/** 追加購入の決済の直後（/pricing?power_pack=done&cs=...）に、ドヤパワーを付ける */
export function PowerPackReturn({ sessionId, canceled }: { sessionId: string | null; canceled: boolean }) {
  const [message, setMessage] = useState<string | null>(canceled ? '追加購入はキャンセルされました。' : sessionId ? 'お支払いを確かめています…' : null)
  useEffect(() => {
    if (!sessionId) return
    let alive = true
    void call('/api/pricing/power-pack/confirm', { method: 'POST', body: JSON.stringify({ sessionId }) }).then((r) => {
      if (!alive) return
      setMessage(r.ok ? `ドヤパワーを ${Number(r.data.points).toLocaleString('ja-JP')} 足しました。` : (r.data.error ?? 'ドヤパワーを付けられたか確認できませんでした。'))
      // 戻り先の URL から決済の ID を消す（読み込み直しで同じ確認を繰り返さない。繰り返しても1回しか付かない）
      window.history.replaceState(null, '', '/pricing')
    }).catch(() => { if (alive) setMessage('ドヤパワーを付けられたか確認できませんでした。重ねて買わずに、画面を読み込み直してください。') })
    return () => { alive = false }
  }, [sessionId])
  return message ? <p className={base.notice} role="status">{message}</p> : null
}

type BillingData = {
  subscription: null | { view: { tone: 'ok' | 'note' | 'bad'; title: string; body: string; action: { label: string; href: string } | null }; currentPeriodEnd: string }
  upcoming: null | { amount: number; at: string }
  invoices: { id: string; number: string | null; createdAt: string; total: number; status: string | null; url: string | null; pdf: string | null }[]
}

const jstDate = (iso: string) => new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' })
const INVOICE_STATUS: Record<string, string> = { paid: '支払い済み', open: '未払い', void: '取り消し', uncollectible: '回収できず' }

/** 請求のまとめ（支払いの状態・次回の請求・請求の履歴と領収書）。チームの人と据え置きの人 */
export function BillingSummary() {
  const [data, setData] = useState<BillingData | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    void call('/api/pricing/billing').then((r) => { if (alive) { if (r.ok) setData(r.data); else setFailed(true) } }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])
  const sub = data?.subscription
  return (
    <section className={styles.manage} aria-labelledby="billing-title">
      <h2 id="billing-title" className={base.sectionTitle}>請求</h2>
      {failed ? <p className={base.notice} role="status">請求の情報を読み込めませんでした。時間をおいて、画面を読み込み直してください。</p> : null}
      {sub ? (
        <div className={styles.billingState} data-tone={sub.view.tone}>
          <p className={styles.manageHead}>{sub.view.title}</p>
          {sub.view.body ? <p className={styles.manageSub}>{sub.view.body}</p> : null}
          {sub.view.action ? <a href={sub.view.action.href} className={base.secondary}>{sub.view.action.label}</a> : null}
        </div>
      ) : null}
      <div className={styles.manageGrid}>
        <div className={styles.manageCard}>
          <p className={styles.manageHead}>次回の請求</p>
          <p className={styles.manageSub}>
            {data === null && !failed ? '読み込んでいます…' : data?.upcoming ? `${jstDate(data.upcoming.at)} に ${yen(data.upcoming.amount)}（税込）` : '次回の請求の予定はありません。'}
          </p>
          <a href="/api/stripe/portal?returnTo=%2Fpricing" className={base.secondary}>お支払い方法・宛名を変える</a>
        </div>
        <div className={styles.manageCard}>
          <p className={styles.manageHead}>請求の履歴と領収書</p>
          <ul className={styles.memberList}>
            {(data?.invoices ?? []).length === 0
              ? <li className={styles.manageSub}>{data === null && !failed ? '読み込んでいます…' : 'まだ請求はありません。'}</li>
              : data!.invoices.map((i) => (
                <li key={i.id}>
                  <span className={styles.memberEmail}>{jstDate(i.createdAt)}・{yen(i.total)}</span>
                  <span className={styles.memberStatus}>{INVOICE_STATUS[i.status ?? ''] ?? '確認中'}</span>
                  {i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer" className={styles.linkBtnBlue}>表示</a> : null}
                  {i.pdf ? <a href={i.pdf} target="_blank" rel="noopener noreferrer" className={styles.linkBtnBlue}>PDF</a> : null}
                </li>
              ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
