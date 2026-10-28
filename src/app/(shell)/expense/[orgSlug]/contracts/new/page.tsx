'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import ContractForm from '@/components/expense/ContractForm'
import { readAmountParam } from '@/app/(shell)/home/quick-request'
import { ErrorBox, Loading, PageBody, PageHeader, useExpenseOrg } from '@/components/expense/ui'

function Inner() {
  const { orgSlug } = useParams() as { orgSlug: string }
  const { canManage, base } = useExpenseOrg()
  const router = useRouter()
  const sp = useSearchParams()
  const preset = sp.get('preset') === 'contractor' ? 'contractor' : undefined
  // 経営ホームの「すぐ登録する依頼」から来たときは、金額を入れた状態で開く（保存は本人が押す）
  const draftUnitPrice = readAmountParam(sp.get('amount'))
  if (!canManage) return <PageBody><ErrorBox forbidden /></PageBody>
  return (
    <PageBody>
      <Link href={`${base}/${preset ? 'contractors' : 'contracts'}`} className="inline-flex min-h-[44px] items-center gap-1 text-[13px] font-medium text-[var(--sub)] hover:text-[var(--ink)]"><ArrowLeft className="h-4 w-4" />戻る</Link>
      <PageHeader title={preset ? '業務委託を追加' : '支出契約を追加'} sub="登録すると、12か月先までの支払予定を自動で作成します。" />
      <ContractForm key={orgSlug} mode="create" preset={preset} draftUnitPrice={draftUnitPrice} onSaved={(id) => router.push(`${base}/contracts/${id}`)} />
    </PageBody>
  )
}
export default function NewContractPage() {
  return <Suspense fallback={<Loading />}><Inner /></Suspense>
}
