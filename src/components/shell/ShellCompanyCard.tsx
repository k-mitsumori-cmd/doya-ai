'use client'
// ============================================
// 枠の左下の「登録会社」（UI 品質 B-1）
// ============================================
// どの画面でも同じ会社の名前を出す。会社の切り替えは作らない（1つのアカウントに会社は1つ）。
// 「会社情報」から、登録と直しの小さな画面（CompanyDialog）を開く。
import { useState } from 'react'
import { useAccountCompany } from './company-context'
import CompanyDialog from './CompanyDialog'
import styles from './ShellCompanyCard.module.css'

export default function ShellCompanyCard() {
  const company = useAccountCompany()
  const [open, setOpen] = useState(false)
  if (company === undefined) return null
  const dialog = <CompanyDialog open={open} onClose={() => setOpen(false)} />
  // 未登録（会社が無い、またはツールの組織の名前を仮に出しているだけ）のときは、登録済みと見分けがつく形にする。
  // ⚠️ 「株式会社◯◯ 登録する」と並べると、登録済みに見えた（2026-10-24 メインの全画面の点検）
  if (!company || company.source !== 'company') {
    return (
      <div className={`${styles.card} ${styles.pending}`}>
        <p className={styles.label}>登録会社（未登録）</p>
        {/* 候補の名前（ツールの組織の名前）はここに出さない。場面で変わって分かりにくいため（2026-10-24）。候補は登録の画面の中で選ぶ */}
        <p className={styles.empty}>まだ登録されていません</p>
        <button type="button" className={styles.registerPrimary} onClick={() => setOpen(true)}>会社を登録する</button>
        {dialog}
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
        <button type="button" className={styles.edit} onClick={() => setOpen(true)}>会社情報</button>
      </div>
      {dialog}
    </div>
  )
}

/** 会社情報の登録の小さな画面を開くボタン（経営ホームの帯から使う） */
export function CompanyRegisterButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{children}</button>
      <CompanyDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** 経営ホームの見出しの横・ツールの見出しの帯に出す、小さな会社名（B-2） */
export function ShellCompanyTag({ className }: { className?: string }) {
  const company = useAccountCompany()
  // 登録した会社だけを出す（ツールの組織の名前を仮に出すと、ツールごとに名前が変わって見える。2026-10-24）
  if (!company || company.source !== 'company') return null
  return <span className={`${styles.tag} ${className ?? ''}`}>{company.name}</span>
}
