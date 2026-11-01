'use client'
// ============================================
// 招待のときに役割を選ぶ部品（新しい料金のメンバーの招待の欄で使う）
// ============================================
// ⚠️ 選べる役割（roles）はサーバーが決めて渡す（/api/company/roles の members[].grantable や、招待する人の grantableCompanyRoles）。ここは出すだけ。
// ⚠️ 375px では縦に並べる（いつも縦の一覧なので、幅で崩れない）。
import { useId, useState } from 'react'
import { COMPANY_ROLE_DESCRIPTION, COMPANY_ROLE_LABEL, type CompanyRole } from '@/lib/company-roles/roles'
import styles from './CompanyRoles.module.css'

export function RolePicker({ roles, value, onChange, legend = '役割', disabled }: {
  roles: readonly CompanyRole[]
  value: CompanyRole
  onChange: (role: CompanyRole) => void
  legend?: string
  disabled?: boolean
}) {
  const name = useId()
  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend className={styles.pickerLegend}>{legend}</legend>
      {roles.map((r) => (
        <label key={r} className={styles.option}>
          <input type="radio" name={name} value={r} checked={value === r} onChange={() => onChange(r)} />
          <span>
            <span className={styles.optionLabel}>{COMPANY_ROLE_LABEL[r]}</span>
            <span className={styles.optionText}>{COMPANY_ROLE_DESCRIPTION[r]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

/** 見本（/ds-preview/company-roles）。選んだ値を自分で持つ */
export function RolePickerPreview({ roles, legend }: { roles: readonly CompanyRole[]; legend?: string }) {
  const [value, setValue] = useState<CompanyRole>('member')
  return <RolePicker roles={roles} value={value} onChange={setValue} legend={legend} />
}
