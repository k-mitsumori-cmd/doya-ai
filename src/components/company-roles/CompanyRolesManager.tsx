'use client'
// ============================================
// 会社のメンバーと権限（/home/roles）
// ============================================
// ⚠️ 誰が何を変えられるか（can・canChange・grantable）はサーバーが決めて渡す。ここは出すだけ。
// ⚠️ 役割を変える前に、できなくなることを確かめの画面に出す（confirmDialog）。
// ⚠️ 招待と外すのは料金のページ（/pricing のチームの管理）。ここは役割の変更・記録・決まり。
import { useCallback, useEffect, useState } from 'react'
import { confirmDialog } from '@/components/ds'
import { COMPANY_ROLE_DESCRIPTION, COMPANY_ROLE_LABEL, lostAbilities, type CompanyRole } from '@/lib/company-roles/roles'
import { POLICY_KEYS, POLICY_LABEL, type CompanyRolePolicy } from '@/lib/company-roles/policy'
import type { MigrationPlanRow } from '@/lib/company-roles/migration'
import styles from './CompanyRoles.module.css'

export interface MemberRow {
  id: string | null
  email: string
  name: string | null
  role: CompanyRole
  status: 'owner' | 'active' | 'invited'
  isSelf: boolean
  canChange: boolean
  grantable: CompanyRole[]
}

export interface CompanyRolesView {
  mode: 'shadow' | 'enforce'
  me: { role: CompanyRole; label: string; description: string }
  can: { viewMembers: boolean; changeRoles: boolean; viewEvents: boolean; changePolicy: boolean }
  members: MemberRow[]
  policy: CompanyRolePolicy
}

interface EventRow { id: string; kind: string; actorName: string | null; targetEmail: string; fromRole: string | null; toRole: string | null; note: string | null; createdAt: string }

async function call(path: string, init?: RequestInit): Promise<{ ok: boolean; data: any }> {
  const r = await fetch(path, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  return { ok: r.ok, data: await r.json().catch(() => ({})) }
}

const label = (r: string | null) => (r && r in COMPANY_ROLE_LABEL ? COMPANY_ROLE_LABEL[r as CompanyRole] : r ?? '')
const when = (iso: string) => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function eventText(e: EventRow): string {
  const who = e.actorName ?? '運営'
  switch (e.kind) {
    case 'role_changed': return `${who} が ${e.targetEmail} の役割を「${label(e.fromRole)}」から「${label(e.toRole)}」に変えました。`
    case 'invited': return `${who} が ${e.targetEmail} を「${label(e.toRole)}」として招待しました。`
    case 'joined': return `${e.targetEmail} が「${label(e.toRole)}」として参加しました。`
    case 'removed': return `${who} が ${e.targetEmail} を外しました。`
    case 'migrated': return `${e.targetEmail} の役割を、今までのツールの役割から「${label(e.toRole)}」に決めました。`
    case 'policy_changed': return `${who} が権限の決まりを変えました。`
    default: return `${who} が変更しました。`
  }
}

const TOOL_LABEL: Record<string, string> = { kintai: '勤怠', hr: 'HR', quote: '見積', income: '収入', expense: '支出', promane: 'プロマネ', sfa: '営業管理', shodan: '商談', aio: 'AI 検索の診断', mensetsu: '面接', aishodan: 'AI 商談' }

export function CompanyRolesManager({ initial, plan = [] }: { initial: CompanyRolesView; plan?: MigrationPlanRow[] }) {
  const [view, setView] = useState(initial)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const r = await call('/api/company/roles')
    if (r.ok) setView(r.data)
  }, [])

  const loadEvents = useCallback(async (before?: string) => {
    if (!view.can.viewEvents) return
    const r = await call(`/api/company/role-events${before ? `?before=${encodeURIComponent(before)}` : ''}`)
    if (!r.ok) return
    setEvents((cur) => (before && cur ? [...cur, ...r.data.events] : r.data.events))
    setNextCursor(r.data.next)
  }, [view.can.viewEvents])
  useEffect(() => { void loadEvents() }, [loadEvents])

  const changeRole = async (m: MemberRow, to: CompanyRole) => {
    if (!m.id || to === m.role || busy) return
    const lost = lostAbilities(m.role, to)
    const ok = await confirmDialog({
      title: `${m.name ?? m.email} さんを「${COMPANY_ROLE_LABEL[to]}」にします`,
      message: lost.length ? lost.join('') : COMPANY_ROLE_DESCRIPTION[to],
      confirmLabel: '役割を変える',
      tone: lost.length ? 'danger' : 'primary',
    })
    if (!ok) return
    setBusy(true); setMessage(null); setError(null)
    try {
      const r = await call(`/api/company/members/${encodeURIComponent(m.id)}/role`, { method: 'PATCH', body: JSON.stringify({ role: to }) })
      if (!r.ok) { setError(r.data.error ?? '役割を変えられませんでした。'); return }
      setMessage(`${m.name ?? m.email} さんの役割を「${COMPANY_ROLE_LABEL[to]}」に変えました。`)
      await Promise.all([reload(), loadEvents()])
    } finally {
      setBusy(false)
    }
  }

  const changePolicy = async (key: keyof CompanyRolePolicy, value: string) => {
    if (busy || view.policy[key] === value) return
    setBusy(true); setMessage(null); setError(null)
    try {
      const r = await call('/api/company/role-settings', { method: 'PUT', body: JSON.stringify({ policy: { [key]: value } }) })
      if (!r.ok) { setError(r.data.error ?? '決まりを変えられませんでした。'); return }
      setView((v) => ({ ...v, policy: r.data.policy }))
      setMessage('権限の決まりを変えました。')
      await loadEvents()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <header>
        <p className={styles.eyebrow}>会社の設定</p>
        <h1 className={styles.pageTitle}>メンバーと権限</h1>
        <p className={styles.subtitle}>会社の中で、誰が何をできるかを決めます。勤怠などのツールの中の権限は、ここで決めた役割より上にはなりません。</p>
      </header>

      {view.mode === 'shadow' ? (
        <p className={styles.shadowNote}>いまは確かめの期間です。ここで決めた役割で止めるはずだった操作を記録していますが、まだ止めていません。</p>
      ) : null}
      {message ? <p className={styles.message} role="status">{message}</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.card} aria-labelledby="my-role">
        <h2 id="my-role" className={styles.cardTitle}>あなたの役割</h2>
        <div className={styles.myRole}>
          <span className={styles.roleBadge}>{view.me.label}</span>
          <span className={styles.note}>{view.me.description}</span>
        </div>
      </section>

      <div className={styles.grid}>
        {view.can.viewMembers ? (
          <section className={styles.card} aria-labelledby="members">
            <h2 id="members" className={styles.cardTitle}>メンバー（{view.members.length}人）</h2>
            <ul className={styles.members}>
              {view.members.map((m) => (
                <li key={m.id ?? 'owner'} className={styles.member}>
                  <div className={styles.who}>
                    <p className={styles.name}>{m.name ?? m.email}{m.isSelf ? '（あなた）' : ''}</p>
                    {m.name ? <p className={styles.email}>{m.email}</p> : null}
                  </div>
                  <span className={styles.status}>{m.status === 'owner' ? '会社の持ち主' : m.status === 'invited' ? '招待中' : '参加'}</span>
                  {m.canChange && m.grantable.length ? (
                    <select
                      className={styles.select}
                      aria-label={`${m.name ?? m.email} さんの役割`}
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => void changeRole(m, e.target.value as CompanyRole)}
                    >
                      {[m.role, ...m.grantable.filter((r) => r !== m.role)].map((r) => <option key={r} value={r}>{COMPANY_ROLE_LABEL[r]}</option>)}
                    </select>
                  ) : (
                    <span className={styles.roleBadge}>{COMPANY_ROLE_LABEL[m.role]}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className={styles.note}>メンバーの招待と外すのは、料金のページの「チームの管理」で行います。</p>
          </section>
        ) : null}

        <section className={styles.card} aria-labelledby="policies">
          <h2 id="policies" className={styles.cardTitle}>権限の決まり</h2>
          <div className={styles.policies}>
            {POLICY_KEYS.map((key) => {
              const l = POLICY_LABEL[key]
              const options = Object.entries(l.options) as [string, string][]
              return (
                <label key={key} className={styles.policy}>
                  <span className={styles.policyTitle}>{l.title}</span>
                  {view.can.changePolicy ? (
                    <select className={styles.select} value={view.policy[key]} disabled={busy} onChange={(e) => void changePolicy(key, e.target.value)}>
                      {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
                    </select>
                  ) : (
                    <span className={styles.note}>{(l.options as Record<string, string>)[view.policy[key]]}</span>
                  )}
                </label>
              )
            })}
          </div>
          {!view.can.changePolicy ? <p className={styles.note}>決まりを変えられるのは、オーナーだけです。</p> : null}
        </section>
      </div>

      {plan.length ? (
        <section className={styles.card} aria-labelledby="plan">
          <h2 id="plan" className={styles.cardTitle}>今までのツールの役割から見た案</h2>
          <p className={styles.note}>各ツールで持っている役割をもとにした案です。案のとおりにするかは、オーナーが決めてください。自動では変えません。</p>
          <ul className={styles.members}>
            {plan.map((r) => {
              const m = view.members.find((x) => x.id === r.memberId)
              return (
                <li key={r.memberId} className={styles.member}>
                  <div className={styles.who}>
                    <p className={styles.name}>{m?.name ?? r.email}</p>
                    <p className={styles.email}>
                      今「{COMPANY_ROLE_LABEL[r.current]}」→ 案「{COMPANY_ROLE_LABEL[r.proposed]}」
                      {r.clampedNow.length ? `。今のままだと、${r.clampedNow.map((c) => TOOL_LABEL[c.tool] ?? c.tool).join('・')}の中の権限が下がります` : ''}
                    </p>
                  </div>
                  <span className={styles.status}>{r.clampedProposed.length ? `案でも下がる: ${r.clampedProposed.map((c) => TOOL_LABEL[c.tool] ?? c.tool).join('・')}` : ''}</span>
                  {m && m.canChange && r.current !== r.proposed && m.grantable.includes(r.proposed) ? (
                    <button type="button" className={styles.select} disabled={busy} onClick={() => void changeRole(m, r.proposed)}>案のとおりにする</button>
                  ) : <span />}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {view.can.viewEvents ? (
        <section className={styles.card} aria-labelledby="events">
          <h2 id="events" className={styles.cardTitle}>変更の記録</h2>
          {events === null ? <p className={styles.note}>読み込んでいます。</p> : events.length === 0 ? <p className={styles.note}>まだ変更はありません。</p> : (
            <ul className={styles.events}>
              {events.map((e) => (
                <li key={e.id} className={styles.event}>
                  <span className={styles.eventTime}>{when(e.createdAt)}</span>
                  <br />
                  {eventText(e)}
                  {e.kind === 'policy_changed' && e.note ? <span className={styles.eventTime}>（{e.note}）</span> : null}
                </li>
              ))}
            </ul>
          )}
          {nextCursor ? (
            <button type="button" className={`${styles.select} ${styles.more}`} onClick={() => void loadEvents(nextCursor)}>もっと見る</button>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
