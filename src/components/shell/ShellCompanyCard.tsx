'use client'
// ============================================
// 枠の左下の「登録会社」（UI 品質 B-1）
// ============================================
// どの画面でも同じ会社の名前を出す。会社の切り替えは作らない（1つのアカウントに会社は1つ）。
// 会社が見つからなければ、登録への案内を出す。
import Link from 'next/link'
import { useAccountCompany } from './company-context'
import styles from './ShellCompanyCard.module.css'

/** 会社が見つからないときの案内の行き先（仮。会社の正本ができたら、その登録の画面にする） */
const REGISTER_HREF = '/sfa'

export default function ShellCompanyCard({ onNavigate }: { onNavigate?: () => void }) {
  const company = useAccountCompany()
  if (company === undefined) return null
  if (!company) {
    return (
      <div className={styles.card}>
        <p className={styles.label}>登録会社</p>
        <p className={styles.empty}>まだ登録されていません</p>
        <Link href={REGISTER_HREF} className={styles.register} onClick={onNavigate}>会社情報を登録する</Link>
      </div>
    )
  }
  return (
    <div className={styles.card}>
      <div className={styles.current} title={`登録会社: ${company.name}`}>
        <span className={styles.text}>
          <span className={styles.label}>登録会社</span>
          <span className={styles.name}>{company.name}</span>
        </span>
      </div>
    </div>
  )
}

/** 経営ホームの見出しの横・ツールの見出しの帯に出す、小さな会社名（B-2） */
export function ShellCompanyTag({ className }: { className?: string }) {
  const company = useAccountCompany()
  if (!company) return null
  return <span className={`${styles.tag} ${className ?? ''}`}>{company.name}</span>
}
