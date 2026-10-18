'use client'

// 契約の新規登録
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ContractForm from '@/components/income/ContractForm'
import { DetailSkeleton, PageHeader, PageShell } from '@/components/income/ui'

function Inner() {
  const sp = useSearchParams()
  return <ContractForm defaultClientId={sp.get('clientId') ?? undefined} />
}

export default function NewContractPage() {
  return (
    <PageShell>
      <PageHeader crumbs={[{ label: '収入管理', href: '/income' }, { label: '契約', href: '/income/contracts' }, { label: '新規契約' }]} title="新規契約" />
      <Suspense fallback={<DetailSkeleton cards={3} />}>
        <Inner />
      </Suspense>
    </PageShell>
  )
}
