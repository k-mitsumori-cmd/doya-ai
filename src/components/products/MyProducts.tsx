'use client'
// ============================================
// 自分の担当（/home/my-products）の画面
// ============================================
// 本人が、自分の担当の製品（複数）と最初に開く製品（1つ）を決める（2026-11-02 の決定）。
// - 管理者が決めた担当を初期値にする。本人が変えたら本人の値を使い、「管理者が決めた担当に戻す」で戻せる。
// - 管理者が「本人に変えさせない」にしたときは、見るだけ（選べない）。
// - 会社で使っていない製品は薄く出す（選べる。ツールも開ける）。
// - 変えたらその場で保存する（PUT）。失敗したら元に戻し、何が起きたかと直し方を出す。
// 設計: docs/design/buddy-products-2026-11-01.md §5.3
import { useState } from 'react'
import { PRODUCTS, PRODUCT_DEFAULT_COOKIE, getProduct, type ProductId } from '@/lib/products'
import type { MyProductsSettings } from '@/lib/products/settings.server'
import styles from './ProductSettings.module.css'

const ONE_YEAR = 60 * 60 * 24 * 365

/** 切り替えの一覧の「既定にする」（cookie）を、ここで決めた既定にそろえる（cookie が先に使われるため） */
function syncDefaultCookie(id: ProductId | null) {
  try {
    document.cookie = id
      ? `${PRODUCT_DEFAULT_COOKIE}=${id}; path=/; max-age=${ONE_YEAR}; samesite=lax`
      : `${PRODUCT_DEFAULT_COOKIE}=; path=/; max-age=0; samesite=lax`
  } catch { /* 覚えられなくても動く */ }
}

type Values = { products: ProductId[]; defaultProduct: ProductId | null }

export default function MyProducts({ initial }: { initial: MyProductsSettings }) {
  const [self, setSelf] = useState<Values | null>(initial.self)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const { admin, locked, enabled } = initial
  const current: Values = !locked && self ? self : admin
  const usingSelf = !locked && self !== null

  const save = async (body: Values | { reset: true }, done: string) => {
    const prev = self
    setSelf('reset' in body ? null : body)
    setBusy(true)
    let ok = false
    let data: any = {}
    try {
      const r = await fetch('/api/company/me/products', { method: 'PUT', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      ok = r.ok
      data = await r.json().catch(() => ({}))
    } catch {
      data = { error: '通信できませんでした。電波のよい所で、もう一度お試しください。' }
    }
    setBusy(false)
    if (ok) {
      const next = 'reset' in body ? null : { products: data.products, defaultProduct: data.defaultProduct }
      setSelf(next)
      syncDefaultCookie(next ? next.defaultProduct : admin.defaultProduct)
      setNote({ kind: 'ok', text: done })
    } else {
      setSelf(prev)
      setNote({ kind: 'error', text: data?.error ?? '保存できませんでした。時間をおいて、もう一度お試しください。' })
    }
  }

  const toggle = (id: ProductId) => {
    const on = current.products.includes(id)
    const products = PRODUCTS.map((p) => p.id).filter((x) => (x === id ? !on : current.products.includes(x)))
    // 担当から外した製品が既定なら、既定も外す（既定は担当の中から選ぶ）
    const def = current.defaultProduct && products.length > 0 && !products.includes(current.defaultProduct) ? null : current.defaultProduct
    void save({ products, defaultProduct: def }, `${getProduct(id).name}を担当${on ? 'から外しました' : 'にしました'}。`)
  }

  const choices = current.products.length ? current.products : PRODUCTS.map((p) => p.id)

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>自分の担当</h1>
        <p className={styles.lead}>担当の製品は、切り替えの一覧で上に並びます。最初に開く製品は、ログインしたあとに開く製品です。担当でない製品のツールも、これまでどおり開けます。</p>
      </header>

      <p className={styles.status} role="status" data-kind={note?.kind}>{note?.text ?? ''}</p>

      <section className={styles.card} aria-labelledby="mp-products">
        <h2 id="mp-products" className={styles.cardTitle}>担当の製品</h2>
        <p className={styles.cardLead}>
          {locked
            ? '担当の製品は、管理者が決めています。変えたいときは、管理者に相談してください。'
            : usingSelf
              ? 'あなたが選んだ担当を使っています。'
              : admin.products.length
                ? '管理者が決めた担当です。変えると、あなたが選んだ担当を使います。'
                : 'まだ担当がありません。使う製品を選んでください。'}
          {initial.all ? ' オーナーと管理者は、担当に関係なく全部の製品を見ます。' : ''}
        </p>
        <fieldset className={styles.chips} disabled={locked || busy}>
          <legend className={styles.srOnly}>担当の製品</legend>
          {PRODUCTS.map((p) => {
            const on = current.products.includes(p.id)
            const unused = !enabled.includes(p.id)
            return (
              <label key={p.id} className={styles.chip} data-on={on ? 'true' : undefined} data-dim={unused ? 'true' : undefined} title={unused ? '会社で使っていない製品です' : undefined}>
                <input id={`mp-${p.id}`} type="checkbox" checked={on} onChange={() => toggle(p.id)} />
                {p.name}
                {unused ? <span className={styles.chipNote}>会社で未使用</span> : null}
              </label>
            )
          })}
        </fieldset>
        <label className={styles.defaultPick}>
          <span>最初に開く製品</span>
          <select
            id="mp-default"
            value={current.defaultProduct ?? ''}
            disabled={locked || busy}
            onChange={(e) => {
              const def = (e.target.value || null) as ProductId | null
              void save({ products: current.products, defaultProduct: def }, def ? `${getProduct(def).name}を最初に開くようにしました。` : '最初に開く製品を、最後に開いた製品にしました。')
            }}
          >
            <option value="">決めない（最後に開いた製品）</option>
            {choices.map((id) => <option key={id} value={id}>{getProduct(id).name}{enabled.includes(id) ? '' : '（会社で未使用）'}</option>)}
          </select>
        </label>
        {usingSelf && admin.products.length + (admin.defaultProduct ? 1 : 0) > 0 ? (
          <button type="button" className={styles.reset} disabled={busy} onClick={() => void save({ reset: true }, '管理者が決めた担当に戻しました。')}>
            管理者が決めた担当に戻す
          </button>
        ) : null}
      </section>
    </div>
  )
}
