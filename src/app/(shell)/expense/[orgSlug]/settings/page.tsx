'use client'

import { FxSection, MembersSection, OrgSection, PaymentMethodsSection } from '@/components/expense/SettingsSections'
import { ErrorBox, PageBody, PageHeader, useExpenseOrg } from '@/components/expense/ui'

export default function SettingsPage() {
  const { canAdmin } = useExpenseOrg()
  if (!canAdmin) return <PageBody><ErrorBox forbidden /></PageBody>
  return (
    <PageBody>
      <PageHeader title="設定" sub="組織、支払方法、為替レート、メンバーを設定します。" />
      <OrgSection />
      <PaymentMethodsSection />
      <FxSection />
      <MembersSection />
    </PageBody>
  )
}
