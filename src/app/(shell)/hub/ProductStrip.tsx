// ============================================
// 経営ホームの上に置く、製品のホームへのリンク（旗 PRODUCT_HUBS_ROLLOUT が on のときだけ）
// ============================================
// 経営ホームは「ドヤバディ 経営管理」のホーム。社長と管理者が、ここから各部門の製品へ移る（設計書 §4.5）。
// 部署の切り替え（すべて・マーケ・セールス…）の代わりに出す。
import Link from 'next/link'
import { PRODUCTS } from '@/lib/products'
import { ShellIcon } from '@/components/shell/icons'
import styles from './hub.module.css'

export default function ProductStrip() {
  return (
    <nav className={styles.strip} aria-label="製品のホーム">
      <span className={styles.stripLabel}>部門ごとに見る</span>
      <div className={styles.others}>
        {PRODUCTS.filter((p) => p.id !== 'management').map((p) => (
          <Link key={p.id} href={p.home} className={styles.other} prefetch={false}>
            <ShellIcon name={p.icon} size={16} strokeWidth={2} />
            {p.name}
          </Link>
        ))}
      </div>
    </nav>
  )
}
