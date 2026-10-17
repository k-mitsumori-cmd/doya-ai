'use client'

// 契約の新規登録
import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import ContractForm from '@/components/income/ContractForm'
import { Loading, PageHeader, PageShell } from '@/components/income/ui'

function Inner() {
  const sp = useSearchParams()
  return <ContractForm defaultClientId={sp.get('clientId') ?? undefined} />
}

export default function NewContractPage() {
  return (
    <PageShell>
      <Link href="/income/contracts" className="mb-3 inline-flex items-center gap-1 text-xs font-black text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" />契約の一覧
      </Link>
      <PageHeader title="新規契約" />
      <Suspense fallback={<Loading />}>
        <Inner />
      </Suspense>
    </PageShell>
  )
}
