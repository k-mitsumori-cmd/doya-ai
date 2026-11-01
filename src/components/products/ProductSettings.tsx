'use client'
// ============================================
// 使う製品と担当（/home/products）の画面
// ============================================
// 上: 会社で使う製品（スイッチ）。下: メンバーごとの担当の製品（複数）と、最初に開く製品（1つ）。
// - 変えたらその場で保存する（PUT）。失敗したら元に戻し、何が起きたかと直し方を出す。
// - 製品は見え方だけ。ツールの権限は変えない（画面にもそう書く）。
// 設計: docs/design/buddy-products-2026-11-01.md §5
import { useState } from 'react'
import { COMPANY_ROLE_LABEL, type CompanyRole } from '@/lib/company-roles/roles'
import { PRODUCTS, getProduct, type ProductId } from '@/lib/products'
import { ALWAYS_ON_PRODUCTS } from '@/lib/products/settings'
import { ShellIcon } from '@/components/shell/icons'
import type { MemberProductsRow } from '@/lib/products/settings.server'
import styles from './ProductSettings.module.css'

async function put(path: string, body: unknown): Promise<{ ok: boolean; data: any }> {
  try {
    const r = await fetch(path, { method: 'PUT', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: r.ok, data: await r.json().catch(() => ({})) }
  } catch {
    return { ok: false, data: { error: '通信できませんでした。電波のよい所で、もう一度お試しください。' } }
  }
}

const roleLabel = (r: string) => (r in COMPANY_ROLE_LABEL ? COMPANY_ROLE_LABEL[r as CompanyRole] : r)
const seesAll = (r: string) => r === 'owner' || r === 'admin'

export default function ProductSettings({ initial }: { initial: { enabled: ProductId[]; members: MemberProductsRow[] } }) {
  const [enabled, setEnabled] = useState<ProductId[]>(initial.enabled)
  const [members, setMembers] = useState<MemberProductsRow[]>(initial.members)
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const toggleProduct = async (id: ProductId) => {
    if (ALWAYS_ON_PRODUCTS.includes(id)) return
    const prev = enabled
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    setEnabled(next)
    setBusy(`p:${id}`)
    const r = await put('/api/company/products', { enabled: next })
    setBusy(null)
    if (r.ok) {
      setEnabled(r.data.enabled)
      setNote({ kind: 'ok', text: `${getProduct(id).name}を${next.includes(id) ? '使う' : '使わない'}ように保存しました。` })
    } else {
      setEnabled(prev)
      setNote({ kind: 'error', text: r.data?.error ?? '保存できませんでした。時間をおいて、もう一度お試しください。' })
    }
  }

  const saveMember = async (m: MemberProductsRow, products: ProductId[], defaultProduct: ProductId | null) => {
    // 担当から外した製品が既定なら、既定も外す（既定は担当の中から選ぶ）
    const def = defaultProduct && products.length > 0 && !products.includes(defaultProduct) ? null : defaultProduct
    const prev = members
    setMembers((list) => list.map((x) => (x.memberId === m.memberId ? { ...x, products, defaultProduct: def } : x)))
    setBusy(`m:${m.memberId}`)
    const r = await put(`/api/company/members/${encodeURIComponent(m.memberId)}/products`, { products, defaultProduct: def })
    setBusy(null)
    if (r.ok) {
      setMembers((list) => list.map((x) => (x.memberId === m.memberId ? { ...x, products: r.data.products, defaultProduct: r.data.defaultProduct } : x)))
      setNote({ kind: 'ok', text: `${m.name ?? m.email}さんの担当を保存しました。` })
    } else {
      setMembers(prev)
      setNote({ kind: 'error', text: r.data?.error ?? '保存できませんでした。時間をおいて、もう一度お試しください。' })
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>使う製品と担当</h1>
        <p className={styles.lead}>製品は、メニューとホームの見え方を部門ごとに分けるものです。ここで決めても、ツールが使えなくなることはありません。</p>
      </header>

      <p className={styles.status} role="status" data-kind={note?.kind}>{note?.text ?? ''}</p>

      <section className={styles.card} aria-labelledby="ps-company">
        <h2 id="ps-company" className={styles.cardTitle}>会社で使う製品</h2>
        <p className={styles.cardLead}>使わない製品は、切り替えの一覧の下に「会社で使っていない製品」として薄く出ます。</p>
        <ul className={styles.products}>
          {PRODUCTS.map((p) => {
            const locked = ALWAYS_ON_PRODUCTS.includes(p.id)
            const on = enabled.includes(p.id)
            return (
              <li key={p.id} className={styles.productRow}>
                <span className={styles.productIcon}><ShellIcon name={p.icon} size={18} strokeWidth={2} /></span>
                <span className={styles.productText}>
                  <b>{p.name}</b>
                  <small>{locked ? '設定とメンバーの入口なので、止められません' : p.hint}</small>
                </span>
                <label className={styles.switch} data-on={on ? 'true' : undefined}>
                  <input
                    id={`ps-product-${p.id}`}
                    type="checkbox"
                    role="switch"
                    checked={on}
                    disabled={locked || busy !== null}
                    onChange={() => void toggleProduct(p.id)}
                    aria-label={`${p.name}を使う`}
                  />
                  <span aria-hidden className={styles.knob} />
                </label>
              </li>
            )
          })}
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="ps-members">
        <h2 id="ps-members" className={styles.cardTitle}>メンバーの担当と、最初に開く製品</h2>
        <p className={styles.cardLead}>担当の製品は、切り替えの一覧で上に並びます。オーナーと管理者は、担当に関係なく全部の製品を見ます。本人が「既定にする」で選んだ製品は、ここで決めた製品より先に使います。</p>
        {members.length === 0 ? <p className={styles.empty}>参加しているメンバーがまだいません。招待した人は、参加したあとに決められます。</p> : (
          <ul className={styles.members}>
            {members.map((m) => {
              const disabled = busy !== null
              const choices = m.products.length ? m.products : PRODUCTS.map((p) => p.id)
              return (
                <li key={m.memberId} className={styles.member}>
                  <div className={styles.who}>
                    <b>{m.name ?? m.email}{m.isSelf ? <span className={styles.self}>あなた</span> : null}</b>
                    <small>{m.name ? `${m.email}・` : ''}{roleLabel(m.role)}{seesAll(m.role) ? '（全部の製品を見ます）' : ''}</small>
                  </div>
                  <fieldset className={styles.chips} disabled={disabled}>
                    <legend className={styles.srOnly}>{m.name ?? m.email}さんの担当の製品</legend>
                    {PRODUCTS.map((p) => {
                      const on = m.products.includes(p.id)
                      return (
                        <label key={p.id} className={styles.chip} data-on={on ? 'true' : undefined}>
                          <input
                            id={`ps-${m.memberId}-${p.id}`}
                            type="checkbox"
                            checked={on}
                            onChange={() => void saveMember(m, on ? m.products.filter((x) => x !== p.id) : PRODUCTS.map((x) => x.id).filter((x) => x === p.id || m.products.includes(x)), m.defaultProduct)}
                          />
                          {p.name}
                        </label>
                      )
                    })}
                  </fieldset>
                  <label className={styles.defaultPick}>
                    <span>最初に開く製品</span>
                    <select
                      id={`ps-${m.memberId}-default`}
                      value={m.defaultProduct ?? ''}
                      disabled={disabled}
                      onChange={(e) => void saveMember(m, m.products, (e.target.value || null) as ProductId | null)}
                    >
                      <option value="">決めない（最後に開いた製品）</option>
                      {choices.map((id) => <option key={id} value={id}>{getProduct(id).name}</option>)}
                    </select>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
