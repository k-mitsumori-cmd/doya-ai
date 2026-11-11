'use client'
import { parseCompanyMemberUsage, type CompanyMemberUsage } from '@/lib/pricing-v2/company-member-usage-view'
import { powerPackReturnMessage, powerPackThanksPoints } from '@/lib/pricing-v2/power-pack-return'
// ============================================
// チームの管理（人数・メンバー・ドヤパワーの追加購入）。新しい料金ページ（PricingV2）の中だけ
// ============================================
// ⚠️ 判定（持ち主か・人数の上限・据え置き）はすべてサーバー（/api/pricing/*）。ここは出すだけ。
// ⚠️ 人数を増やすと、その場で日割りを請求する。押す前に必ず確かめの文を出す（ConfirmDialog）。
// ⚠️ 招待のメールは送らない。招待のリンクを出し、持ち主が相手に渡す。
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { BillingResponseError, readBillingResponse } from '@/lib/billing-response-client'
import { parseTeamSeatsView, type PendingSeatChange } from '@/lib/pricing-v2/seat-operation-view'
import { Minus, Plus, Copy, Check } from 'lucide-react'
import { confirmDialog } from '@/components/ds'
import { CountUp } from '@/components/ds/motion'
import { POWER_PACK, TEAM_MONTHLY_POINTS_PER_SEAT, teamMonthly, withTax } from '@/lib/pricing-v2/plans'
import { claimThanksOnce, thanksStorage, type PaymentThanksView } from '@/lib/pricing-v2/payment-thanks'
import PaymentThanks from './PaymentThanks'
import { COMPANY_ROLE_LABEL, isMemberRowRole } from '@/lib/company-roles/roles'
import { companyInviteRole, COMPANY_INVITE_ROLE_LABEL, type CompanyInviteRole } from '@/lib/pricing-v2/company-invite-role'
import guestStyles from './CompanyInvite.module.css'
import base from './PricingNext.module.css'
import styles from './PricingV2.module.css'

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`

type Member = { id: string; email: string; role: string; status: string }

async function call(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetch(path, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const data = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, data }
}

function managedError(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === 'string' && data.error.length > 0 ? data.error : fallback
}
function managedMembers(raw: unknown): Member[] | null {
  if (!Array.isArray(raw)) return null
  const ids = new Set<string>(), result: Member[] = []
  for (const value of raw) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const member = value as Record<string, unknown>
    if (typeof member.id !== 'string' || !member.id || ids.has(member.id) || typeof member.email !== 'string' || typeof member.role !== 'string' || (typeof member.status !== 'string' || !['active', 'invited'].includes(member.status))) return null
    ids.add(member.id)
    result.push({ id: member.id, email: member.email, role: member.role, status: member.status as string })
  }
  return result
}

/** Session-keyed child resets immediately on logout/account switch. Old dialogs
 * and responses cannot submit or display the previous owner's operation.
 */
export function TeamManage({ membershipOnly = false }: { membershipOnly?: boolean } = {}) {
  const { data: session, status } = useSession()
  const actor = (session?.user as { id?: unknown } | undefined)?.id
  if (status !== 'authenticated' || typeof actor !== 'string' || !actor) return (
    <section id="manage" className={styles.manage} aria-labelledby="manage-title">
      <h2 id="manage-title" className={base.sectionTitle}>{membershipOnly ? '会社のメンバー' : 'チームの管理'}</h2>
      <p className={styles.manageSub} role="status">{status === 'loading' ? 'ログイン状態を確認しています…' : 'ログインして契約情報をご確認ください。'}</p>
    </section>
  )
  return <OwnerTeamManage key={`${actor}:${membershipOnly}`} actorId={actor} membershipOnly={membershipOnly} />
}

function OwnerTeamManage({ actorId, membershipOnly }: { actorId: string; membershipOnly: boolean }) {
  const [seats, setSeats] = useState<number | null>(null)
  const [used, setUsed] = useState<number | null>(null)
  const [draft, setDraft] = useState(1)
  const [pending, setPending] = useState<PendingSeatChange | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [memberUsage, setMemberUsage] = useState<CompanyMemberUsage | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [membersFailed, setMembersFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<CompanyInviteRole>('member')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteLabel, setInviteLabel] = useState<{ email: string; role: CompanyInviteRole } | null>(null)
  const [copied, setCopied] = useState(false)
  const [thanks, setThanks] = useState<PaymentThanksView | null>(null)
  const emailId = useId(), roleId = useId(), roleHelpId = useId()
  const disposed = useRef(false), loadVersion = useRef(0), mutating = useRef(false)
  const controllers = useRef(new Set<AbortController>())
  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    if (disposed.current) throw new BillingResponseError(true)
    const controller = new AbortController()
    controllers.current.add(controller)
    const headers = new Headers(init.headers)
    headers.set('Content-Type', 'application/json')
    headers.set('X-Doya-Owner', actorId)
    try { return await readBillingResponse(path, { ...init, headers }, controller.signal) }
    finally { controllers.current.delete(controller) }
  }, [actorId])

  const reload = useCallback(async () => {
    if (disposed.current) return
    const version = ++loadVersion.current
    setLoading(true)
    setMemberUsage(null)
    try {
      const [s, m] = await Promise.allSettled([membershipOnly ? Promise.resolve(null) : request('/api/pricing/seats'), request('/api/pricing/members')])
      if (disposed.current || version !== loadVersion.current) return
      const view = s.status === 'fulfilled' && s.value?.ok ? parseTeamSeatsView(s.value.data) : null
      const usage = m.status === 'fulfilled' && m.value.ok ? parseCompanyMemberUsage(m.value.data) : null
      setMemberUsage(usage)
      if (membershipOnly) {
        setSeats(null); setPending(null)
        setLoadFailed(usage === null)
      } else if (view?.kind === 'ready') {
        setSeats(view.seats); setUsed(view.used); setDraft(view.seats); setPending(null); setLoadFailed(false)
      } else if (view?.kind === 'pending') {
        setSeats(null); setUsed(null); setDraft(view.pending.requested); setPending(view.pending); setLoadFailed(false)
      } else {
        setSeats(null); setUsed(null); setLoadFailed(true)
        setMessage(s.status === 'fulfilled' && s.value ? managedError(s.value.data, '人数を読み込めませんでした。状態を再確認してください。') : '人数を読み込めませんでした。状態を再確認してください。')
      }
      const list = m.status === 'fulfilled' && m.value.ok ? managedMembers(m.value.data.members) : null
      setMembers(list ?? []); setMembersFailed(list === null)
      if (list === null && (view || membershipOnly)) setMessage(m.status === 'fulfilled' ? managedError(m.value.data, 'メンバー情報を読み込めませんでした。状態を再確認してください。') : 'メンバー情報を読み込めませんでした。状態を再確認してください。')
    } finally { if (!disposed.current && version === loadVersion.current) setLoading(false) }
  }, [request, membershipOnly])
  useEffect(() => {
    disposed.current = false
    const requests = controllers.current
    void reload()
    return () => { disposed.current = true; for (const controller of requests) controller.abort(); requests.clear() }
  }, [reload])

  const clearInvitePreview = () => { setInviteUrl(null); setInviteLabel(null); setCopied(false) }
  const beginAction = () => {
    if (disposed.current || mutating.current) return false
    mutating.current = true; setBusy(true); setMessage(null)
    return true
  }
  const endAction = () => { mutating.current = false; if (!disposed.current) setBusy(false) }
  const changeSeats = async () => {
    if (seats === null || draft === seats || pending || loading || loadFailed || !beginAction()) return
    const from = seats, requested = draft, up = requested > from
    try {
      const approved = await confirmDialog({
        title: `人数を${requested}人に${up ? '増やします' : '減らします'}`,
        message: up
          ? `今日から次の請求日までの日割りの額を、いま請求します。お支払いが済まないときは、人数は変わりません。毎月のドヤパワーは来月から ${(requested - from) * TEAM_MONTHLY_POINTS_PER_SEAT} 増え、今月は残りの日数の分を足します。`
          : '減らした分の返金はありません。人数はすぐに減ります。',
        confirmLabel: up ? '増やして請求する' : '減らす',
      })
      if (!approved || disposed.current) return
      const operationKey = crypto.randomUUID().replace(/-/g, '')
      const response = await request('/api/pricing/seats', { method: 'POST', body: JSON.stringify({ seats: requested, expectedSeats: from, operationKey }) })
      if (disposed.current) return
      setMessage(response.ok ? '人数変更の結果を確認しました。' : managedError(response.data, '人数変更の結果を確認できませんでした。'))
      // お礼は、人数を増やした請求が通った今回の操作だけ（やり直しの応答 replayed では出さない）
      if (response.ok && up && !response.data.replayed && claimThanksOnce(`seats:${operationKey}`, thanksStorage())) setThanks({ kind: 'seats', added: requested - from, seats: requested })
      await reload()
    } catch {
      if (!disposed.current) { setMessage('人数変更の結果を確認できませんでした。状態を再確認してください。'); await reload() }
    } finally { endAction() }
  }
  const recover = async () => {
    if (!pending || pending.action === 'wait' || loading || !beginAction()) return
    const original = pending
    try {
      if (original.action === 'resume') {
        const approved = await confirmDialog({
          title: `${original.requested}人への変更を再開します`,
          message: '元の人数変更を再開します。前回の処理が完了していれば重複の請求は行いません。まだ処理されていない場合は、日割り請求が発生することがあります。減らした分の返金はありません。',
          confirmLabel: '元の変更を再開する',
        })
        if (!approved || disposed.current) return
      }
      if (disposed.current) return
      const response = await request('/api/pricing/seats', { method: 'POST', body: JSON.stringify({ seats: original.requested, operationKey: original.operationKey, mode: original.action === 'check' ? 'check' : 'resume' }) })
      if (disposed.current) return
      setMessage(response.ok ? '元の人数変更の結果を確認しました。' : managedError(response.data, '変更結果を確認できませんでした。状態を再確認してください。'))
      await reload()
    } catch {
      if (!disposed.current) { setMessage('変更結果を確認できませんでした。状態を再確認してください。'); await reload() }
    } finally { endAction() }
  }
  const invite = async () => {
    if ((inviteRole !== 'guest' && (pending || loadFailed)) || loading || membersFailed || !email.trim() || !beginAction()) return
    const selectedRole = inviteRole
    clearInvitePreview()
    try {
      const response = await request('/api/pricing/members', { method: 'POST', body: JSON.stringify({ email, role: selectedRole }) })
      if (disposed.current) return
      const returnedMember = response.data.member
      const roleMatches = returnedMember !== null && typeof returnedMember === 'object' && !Array.isArray(returnedMember) && 'role' in returnedMember && returnedMember.role === selectedRole && 'email' in returnedMember && typeof returnedMember.email === 'string' && returnedMember.email.trim().toLowerCase() === email.trim().toLowerCase()
      if (response.ok && roleMatches && typeof response.data.inviteUrl === 'string' && response.data.inviteUrl.startsWith('https://')) {
        setInviteUrl(response.data.inviteUrl); setInviteLabel({ email: email.trim().toLowerCase(), role: selectedRole }); setEmail(''); await reload()
      } else setMessage(managedError(response.data, '招待の結果を確認できませんでした。状態を再確認してください。'))
    } catch { if (!disposed.current) setMessage('招待の結果を確認できませんでした。状態を再確認してください。') }
    finally { endAction() }
  }
  const remove = async (member: Member) => {
    if (!beginAction()) return
    try {
      const approved = await confirmDialog({ title: `${member.email} を外します`, message: 'この会社の所属を外します。各ツールで別に付与した権限は残ります。使用人数を減らすには、該当ツールの操作権限も確認してください。あとから招待し直せます。', confirmLabel: '外す', tone: 'danger' })
      if (!approved || disposed.current) return
      const response = await request(`/api/pricing/members?id=${encodeURIComponent(member.id)}`, { method: 'DELETE' })
      if (disposed.current) return
      if (!response.ok) setMessage(managedError(response.data, '外せませんでした。'))
      await reload()
    } catch { if (!disposed.current) setMessage('削除の結果を確認できませんでした。状態を再確認してください。') }
    finally { endAction() }
  }
  const minSeats = Math.max(1, used ?? 1)
  const copyInvite = async () => {
    try {
      if (!inviteUrl || !navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(inviteUrl)
      if (!disposed.current) setCopied(true)
    } catch { if (!disposed.current) setMessage('コピーできませんでした。リンク欄を選択してコピーしてください。') }
  }
  const diff = seats !== null ? (teamMonthly(draft) ?? 0) - (teamMonthly(seats) ?? 0) : 0
  const editingBlocked = busy || loading || loadFailed || pending !== null || seats === null
  const invitationBlocked = busy || loading || membersFailed || (inviteRole !== 'guest' && (loadFailed || pending !== null))
  return (
    <section id="manage" className={styles.manage} aria-labelledby="manage-title" aria-busy={loading || busy}>
      <h2 id="manage-title" className={base.sectionTitle}>{membershipOnly ? '会社のメンバー' : 'チームの管理'}</h2>
      <div className={`${styles.manageGrid} ${guestStyles.inviteGrid} ${membershipOnly ? guestStyles.membershipOnlyGrid : ''}`}>
        {!membershipOnly ? <div className={styles.manageCard}>
          <p className={styles.manageHead}>人数</p>
          {pending ? (
            <div className={base.notice}>
              <p className={styles.manageSub} role="status">{pending.previousSeats === null ? `${pending.requested}人への変更を確認中です。` : `${pending.previousSeats}人から${pending.requested}人への変更を確認中です。`}</p>
              <p className={styles.manageSub}>{pending.action === 'wait' ? '処理が続いています。少し待ってから状態を再確認してください。' : pending.action === 'check' ? '追加の請求は行わず、元の変更結果を確認します。確認できない場合は保留を維持します。' : '元の変更を再開できます。新しい人数変更やメンバーの追加は、確認完了後に再開できます。'}</p>
              {pending.action !== 'wait' ? <button type="button" className={base.primary} onClick={recover} disabled={busy || loading}>{pending.action === 'check' ? '元の変更結果を確認する' : '元の変更を再開する'}</button> : null}
            </div>
          ) : (
            <>
              <p className={styles.manageSub}>{seats === null ? (loadFailed ? '人数を読み込めませんでした。' : '読み込んでいます…') : `今の人数 ${seats}人・使っている人数 ${used ?? '—'}人（操作メンバーと有効な操作招待。持ち主を含み、閲覧専用ゲストは除きます）`}</p>
              <div className={styles.stepper}>
                <button type="button" className={styles.stepBtn} aria-label="1人減らす" onClick={() => setDraft(d => Math.max(minSeats, d - 1))} disabled={editingBlocked || draft <= minSeats}><Minus size={18} /></button>
                <span className={styles.seatValue}><span className={styles.seatNum}>{seats === null ? '—' : <CountUp value={draft} duration={280} initial="value" />}</span><span>人</span></span>
                <button type="button" className={styles.stepBtn} aria-label="1人増やす" onClick={() => setDraft(d => Math.min(49, d + 1))} disabled={editingBlocked || draft >= 49}><Plus size={18} /></button>
              </div>
              <p className={styles.manageSub}>{seats !== null && draft !== seats ? <>月額（税抜）が {diff > 0 ? '+' : '−'}<CountUp value={Math.abs(diff)} format={yen} duration={420} initial="value" /> 変わります（税込 <CountUp value={withTax(Math.abs(diff))} format={yen} duration={420} initial="value" />）</> : '50人以上は個別にお見積りします。'}</p>
              <button type="button" className={base.primary} onClick={changeSeats} disabled={editingBlocked || draft === seats}>人数を変える</button>
            </>
          )}
          <div className={base.planAction}><button type="button" className={base.secondary} onClick={() => { void reload() }} disabled={busy || loading}>状態を再確認する</button></div>
        </div> : null}
        <div className={`${styles.manageCard} ${guestStyles.memberPanel}`}>
          <p className={styles.manageHead}>招待と所属</p>
          <p className={guestStyles.help}>ここには会社への招待と所属を表示します。各ツールだけの操作メンバーも使用人数に含まれますが、この一覧には表示されません。</p>
          {membershipOnly ? <p className={guestStyles.help} role="status" aria-live="polite">
            {loading ? '会社全体の使用人数を確認しています…' : memberUsage ? '会社全体で使用中 ' + memberUsage.used.toLocaleString('ja-JP') + '人 / 上限 ' + memberUsage.limit.toLocaleString('ja-JP') + '人（持ち主、各ツールの操作メンバーと有効な操作招待を含み、同じアカウントは1人と数えます。閲覧専用ゲストは除きます）' : '会社全体の使用人数を確認できませんでした。一覧を再確認してください。'}
          </p> : null}
          <form className={guestStyles.inviteForm} onSubmit={event => { event.preventDefault(); void invite() }}>
            <label htmlFor={roleId} className={guestStyles.help}>招待する役割</label>
            <select id={roleId} className={guestStyles.roleSelect} value={inviteRole} aria-describedby={roleHelpId} disabled={busy || loading || membersFailed} onChange={event => { const role = companyInviteRole(event.target.value); if (role) { setInviteRole(role); clearInvitePreview() } }}>
              <option value="member">操作メンバー</option>
              <option value="admin">管理者</option>
              <option value="guest">ゲスト（閲覧のみ）</option>
            </select>
            <p id={roleHelpId} className={guestStyles.help}>{inviteRole === 'guest' ? 'この会社への招待では購入席を使わず、共有された画面の閲覧のみとなります。各ツールに操作権がある方は、その所属で席を使います。' : '操作メンバーと管理者は、会社と各ツールを通じて1人1席を使います。招待だけで自動請求は行いません。'}</p>
            <label htmlFor={emailId} className={guestStyles.help}>招待する方のメールアドレス</label>
            <div className={styles.inviteRow}>
              <input id={emailId} type="email" inputMode="email" autoComplete="off" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); clearInvitePreview() }} className={styles.textInput} placeholder="name@example.com" disabled={invitationBlocked} />
              <button type="submit" className={base.secondary} disabled={invitationBlocked || !email.trim()}>招待する</button>
            </div>
            {inviteRole !== 'guest' && (pending || loadFailed) && !loading ? <p className={guestStyles.help} role="status">操作メンバーの招待には、人数の確認が必要です。閲覧専用ゲストは役割を切り替えて招待できます。</p> : null}
          </form>
          {inviteUrl ? <div className={styles.inviteUrl}>
            <p className={styles.manageSub}>{inviteLabel ? `${inviteLabel.email}：${COMPANY_INVITE_ROLE_LABEL[inviteLabel.role]}の招待リンクです。` : ''}招待した方に渡してください（メールは送っていません）。</p>
            <div className={styles.inviteRow}>
              <input readOnly value={inviteUrl} className={styles.textInput} aria-label="招待のリンク" onFocus={event => event.currentTarget.select()} />
              <button type="button" className={base.secondary} onClick={() => { void copyInvite() }}>{copied ? <><Check size={16} />写しました</> : <><Copy size={16} />写す</>}</button>
            </div>
          </div> : null}
          <ul className={styles.memberList}>
            {loading ? <li className={styles.manageSub}>読み込んでいます…</li> : membersFailed ? <li className={styles.manageSub}>メンバー情報を読み込めませんでした。</li> : members.length === 0 ? <li className={styles.manageSub}>この会社への招待・参加はまだありません。</li> : members.map(member => <li key={member.id}>
              <span className={styles.memberEmail}>{member.email}</span>
              <span className={guestStyles.memberMeta}><span>{COMPANY_INVITE_ROLE_LABEL[member.role as CompanyInviteRole] ?? (isMemberRowRole(member.role) ? COMPANY_ROLE_LABEL[member.role] : '役割を確認してください')}</span><span className={styles.memberStatus}>{member.status === 'active' ? '参加' : '招待中'}</span></span>
              <button type="button" className={styles.linkBtn} onClick={() => { void remove(member) }} disabled={busy || loading}>外す</button>
            </li>)}
          </ul>
          <button type="button" className={base.secondary} onClick={() => { void reload() }} disabled={busy || loading}>一覧を再確認する</button>
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
    <div id="power-pack" className={styles.packBox}>
      <div>
        <p className={styles.manageHead}>ドヤパワーを追加で買う</p>
        <p className={styles.manageSub}>{POWER_PACK.points.toLocaleString('ja-JP')}ごとに {yen(POWER_PACK.price)}（税抜。税込 {yen(withTax(POWER_PACK.price))}）。買った分は6か月使えます。</p>
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
  const [thanks, setThanks] = useState<PaymentThanksView | null>(null)
  useEffect(() => {
    if (!sessionId) return
    let alive = true
    void call('/api/pricing/power-pack/confirm', { method: 'POST', body: JSON.stringify({ sessionId }) }).then((r) => {
      if (!alive) return
      setMessage(r.ok ? (powerPackReturnMessage(r.data) ?? 'ドヤパワーを付けられたか確認できませんでした。重ねて買わずに、画面を読み込み直してください。') : (r.data.error ?? 'ドヤパワーを付けられたか確認できませんでした。'))
      // お礼は、サーバーが支払いを確かめて付けたときに、その決済で1回だけ
      const thanksPoints = r.ok ? powerPackThanksPoints(r.data) : null
      if (thanksPoints !== null && claimThanksOnce(`pack:${sessionId}`, thanksStorage())) setThanks({ kind: 'pack', points: thanksPoints })
      // 戻り先の URL から決済の ID を消す（読み込み直しで同じ確認を繰り返さない。繰り返しても1回しか付かない）
      window.history.replaceState(null, '', '/pricing')
    }).catch(() => { if (alive) setMessage('ドヤパワーを付けられたか確認できませんでした。重ねて買わずに、画面を読み込み直してください。') })
    return () => { alive = false }
  }, [sessionId])
  return (
    <>
      {message ? <p className={base.notice} role="status">{message}</p> : null}
      <PaymentThanks view={thanks} onClose={() => setThanks(null)} />
    </>
  )
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
