'use client'
// ============================================
// 枠の左下の「登録会社」と、会社の切り替え（UI 品質 B-1）
// ============================================
// Vercel・Slack・Notion と同じく、左下のアカウント欄に今の会社を出し、押すと一覧から切り替えられる。
// ⚠️ 会社はツールごとの組織。切り替えは、その組織のツールの画面へ移るだけ（認可は各ツールが持つ）。
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { ALL_SHELL_TOOLS } from './tools'
import { useShellCompany } from './company-context'
import styles from './ShellCompanyCard.module.css'

const toolName = (id: string) => ALL_SHELL_TOOLS.find((t) => t.id === id)?.name ?? id

export default function ShellCompanyCard({ onNavigate }: { onNavigate?: () => void }) {
  const state = useShellCompany()
  const [open, setOpen] = useState(false)
  const listId = useId()
  const box = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  if (!state) return null
  const { companies, current } = state

  if (!current) {
    return (
      <div className={styles.card}>
        <p className={styles.label}>登録会社</p>
        <p className={styles.empty}>まだ登録されていません</p>
        <Link href="/sfa" className={styles.register} onClick={onNavigate}>会社情報を登録する</Link>
      </div>
    )
  }

  const multiple = companies.length > 1
  return (
    <div className={styles.card} ref={box}>
      {multiple ? (
        <button type="button" className={styles.current} aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)} title={`登録会社: ${current.name}`}>
          <span className={styles.text}>
            <span className={styles.label}>登録会社</span>
            <span className={styles.name}>{current.name}</span>
          </span>
          <ChevronsUpDown size={16} aria-hidden className={styles.chev} />
        </button>
      ) : (
        <div className={styles.current} title={`登録会社: ${current.name}`}>
          <span className={styles.text}>
            <span className={styles.label}>登録会社</span>
            <span className={styles.name}>{current.name}</span>
          </span>
        </div>
      )}
      {multiple && open ? (
        <ul id={listId} className={styles.menu} aria-label="会社を切り替える">
          {companies.map((c) => {
            const active = c.tool === current.tool && c.slug === current.slug
            return (
              <li key={`${c.tool}:${c.slug}`}>
                <Link href={c.href} className={styles.item} aria-current={active ? 'true' : undefined} onClick={() => { setOpen(false); onNavigate?.() }}>
                  <span className={styles.itemName}>{c.name}</span>
                  <span className={styles.itemTool}>{toolName(c.tool)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * ツールの見出しの帯・ホームの見出しの横に出す、小さな会社名（B-2）。
 * tool を渡したときは、そのツールの組織のときだけ出す（組織を持たないツールに、別のツールの会社名を出さない）
 */
export function ShellCompanyTag({ tool, className }: { tool?: string; className?: string }) {
  const state = useShellCompany()
  if (!state?.current) return null
  if (tool && state.current.tool !== tool) return null
  return <span className={`${styles.tag} ${className ?? ''}`}>{state.current.name}</span>
}
