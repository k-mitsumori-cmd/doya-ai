// ============================================
// 年間レポート（/home/annual）
// ============================================
// 1年分の利用を、共有できる画像にまとめる。画像は /api/annual-report/image が作る。
// ⚠️ 新しい見た目（src/lib/ui-next.ts の isUiNext()）の人だけ。ほかの人には 404。
// ⚠️ ここは読むだけ。本人の会社（組織）を選ぶのは load.server.ts（userId はセッションから）。
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isUiNext } from '@/lib/ui-next'
import { currentUserId } from '@/lib/shell/company.server'
import { MIN_YEAR, allowedReveal, jstYear } from '@/lib/annual-report/report'
import { resolveAnnualAccess } from '@/lib/annual-report/load.server'
import AnnualReportView from '@/components/annual-report/AnnualReportView'

export const metadata: Metadata = {
  title: '年間レポート',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AnnualReportPage() {
  const userId = await currentUserId()
  if (!userId) redirect('/auth/signin?callbackUrl=/home/annual')
  if (!(await isUiNext())) notFound()

  const access = await resolveAnnualAccess(prisma, userId)
  const thisYear = jstYear(new Date())
  const years: number[] = []
  for (let y = thisYear; y >= MIN_YEAR; y--) years.push(y)
  return <AnnualReportView years={years} initialYear={thisYear} allowed={allowedReveal(access)} />
}
