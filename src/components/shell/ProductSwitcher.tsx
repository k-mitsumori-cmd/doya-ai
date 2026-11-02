'use client'
// ============================================
// 製品の切り替え（ドヤバディ マーケティング・セールス・人事・予実管理・経営管理）
// ============================================
// サイドバーのいちばん上（今のロゴの位置）と、スマホの上の帯に置く。押すと製品の一覧が開く。
// - パソコン: ボタンの下に開く。スマホ（767px 以下）: 下から出るシート（2026-10-29 の決定「画面を移らずに、横・下から出す」）
// - 一覧の下の「この製品を既定にする」で、ログインした直後とロゴで開く製品を選ぶ（cookie。段2で会社の表の値を先に使う）
// - Esc・外側のタップで閉じる。開いたら今の製品にフォーカスを移す
// ⚠️ 一覧は body へ出す（portal）。スマホの上の帯（backdrop-filter）と引き出し（transform）の中では position: fixed が画面に効かないため。
//    パソコンでは、ボタンの位置を測って、その下に出す（--pop-top / --pop-left）
// 設計: docs/design/buddy-products-2026-11-01.md §4.2
// ⚠️ 旗 PRODUCT_HUBS_ROLLOUT が on のときだけ使う（AppShell が決める）。製品は見え方だけで、ツールの権限は変えない。
import Link from 'next/link'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import ds from '@/components/ds/tokens.module.css'
import { Check, ChevronDown } from 'lucide-react'
import { DoyaLogoMark } from '@/components/brand/DoyaLogo'
import { brandName } from '@/lib/brand'
import { PRODUCT_DEFAULT_COOKIE, PRODUCT_IDS, getProduct, type ProductId } from '@/lib/products'
import { ShellIcon } from './icons'
import { productShellTools } from './tools'
import styles from './ProductSwitcher.module.css'

const ONE_YEAR = 60 * 60 * 24 * 365

export default function ProductSwitcher({ current, selfDefault, order, canManage = false, canEditSelf = false, locked = false, onSelect, variant, labelClassName }: {
  current: ProductId
  /** 並び（段2。担当を先に、会社が使っていない製品は others へ）。無ければ決まった並びで全部 */
  order?: { main: ProductId[]; others: ProductId[] }
  /** 管理者以上なら、使う製品の設定（/home/products）への案内を出す */
  canManage?: boolean
  /** 自分の担当の画面（/home/my-products）へ案内するか（段2の表を読めて、ロックされていない人） */
  canEditSelf?: boolean
  /** 管理者が「本人に変えさせない」にした人。「既定にする」を出さない */
  locked?: boolean
  /** 本人が既定にした製品（無ければ null） */
  selfDefault: ProductId | null
  /** 一覧から製品を選んだとき（ホームへ移る前に、枠の側で今の製品を変える） */
  onSelect: (id: ProductId) => void
  variant: 'sidebar' | 'topbar'
  /** アイコンだけのサイドバー（768〜1279px）で隠す文字に付ける class（AppShell の navLabel） */
  labelClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [def, setDef] = useState<ProductId | null>(selfDefault)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const listId = useId()
  const product = getProduct(current)
  const brand = brandName()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    // 開いたら今の製品にフォーカスを移す（キーボードでそのまま選べる）
    const t = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.focus())
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
      cancelAnimationFrame(t)
    }
  }, [open])

  const main = order?.main.length ? order.main : [...PRODUCT_IDS]
  const others = order?.others ?? []
  const renderItem = (id: ProductId, dim: boolean) => {
    const p = getProduct(id)
    const count = productShellTools(p.id).length
    const isCurrent = p.id === current
    return (
      <li key={p.id}>
        <Link
          href={p.home}
          className={styles.item}
          data-dim={dim ? 'true' : undefined}
          aria-current={isCurrent ? 'true' : undefined}
          onClick={() => { onSelect(p.id); setOpen(false) }}
          prefetch={false}
        >
          <span className={styles.itemIcon} data-product={p.id}><ShellIcon name={p.icon} size={18} strokeWidth={2} /></span>
          <span className={styles.itemText}>
            <b>{p.name}{def === p.id ? <span className={styles.defTag}>既定</span> : null}</b>
            <small>{p.hint}</small>
          </span>
          <span className={styles.itemMeta}>
            {isCurrent ? <Check size={16} aria-label="今の製品" /> : <span className={styles.count}>{p.id === 'management' ? '全体' : `${count}個`}</span>}
          </span>
        </Link>
      </li>
    )
  }

  const makeDefault = () => {
    try { document.cookie = `${PRODUCT_DEFAULT_COOKIE}=${current}; path=/; max-age=${ONE_YEAR}; samesite=lax` } catch { /* 覚えられなくても動く */ }
    setDef(current)
  }

  return (
    <div ref={wrapRef} className={styles.wrap} data-variant={variant}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setPos({ top: Math.round(r.bottom + 6), left: Math.round(r.left) })
          setOpen((v) => !v)
        }}
        title={`${brand} ${product.name}（製品を切り替える）`}
      >
        <DoyaLogoMark size={28} className={styles.mark} />
        <span className={`${styles.names} ${labelClassName ?? ''}`}>
          <small className={styles.brand}>{brand}</small>
          <strong className={styles.product}>{product.name}</strong>
        </span>
        <ChevronDown size={16} aria-hidden className={`${styles.chevron} ${labelClassName ?? ''}`} data-open={open} />
      </button>

      {mounted && open ? createPortal(
      <div className={`${ds.ds} ${styles.layer}`}>
      <div className={styles.scrim} aria-hidden onClick={() => setOpen(false)} />
      <div ref={panelRef} id={listId} className={styles.panel} role="dialog" aria-label="製品を切り替える" style={pos ? ({ '--pop-top': `${pos.top}px`, '--pop-left': `${pos.left}px` } as CSSProperties) : undefined}>
        <p className={styles.panelTitle}>製品を切り替える</p>
        <ul className={styles.list}>
          {main.map((id) => renderItem(id, false))}
        </ul>
        {others.length ? (
          <>
            <p className={styles.panelTitle}>会社で使っていない製品</p>
            <ul className={styles.list}>
              {others.map((id) => renderItem(id, true))}
            </ul>
          </>
        ) : null}
        <div className={styles.foot}>
          {locked
            ? <p className={styles.footNote}>最初に開く製品は、管理者が決めています</p>
            : def === current
              ? <p className={styles.footNote}>ログインしたあと、{product.name}を最初に開きます</p>
              : <button type="button" className={styles.defButton} onClick={makeDefault}>{product.name}を既定にする</button>}
          <p className={styles.footHint}>ほかの製品のツールも開けます</p>
          {canEditSelf ? <Link href="/home/my-products" className={styles.manage} onClick={() => setOpen(false)} prefetch={false}>自分の担当を決める</Link> : null}
          {canManage ? <Link href="/home/products" className={styles.manage} onClick={() => setOpen(false)} prefetch={false}>使う製品と担当を設定する</Link> : null}
        </div>
      </div>
      </div>, document.body) : null}
    </div>
  )
}
