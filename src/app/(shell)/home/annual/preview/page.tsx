// 開発用プレビュー: 年間レポートを見本のデータで表示する（ログイン・DB不要）
// ⚠️ 開発（NODE_ENV=development）のときだけ。それ以外は 404。画面確認のためだけに使う。
// ⚠️ ドヤパワーの旗（DOYA_POWER_ROLLOUT）が off のときも 404。
import { notFound } from 'next/navigation'
import { doyaPowerSampleAllowed } from '@/lib/doya-power/flag'
import AppShell from '@/components/shell/AppShell'
import { MIN_YEAR, REVEAL_KEYS, jstYear } from '@/lib/annual-report/report'
import AnnualReportView from '@/components/annual-report/AnnualReportView'

export const dynamic = 'force-dynamic'

export default function AnnualReportPreviewPage() {
  if (process.env.NODE_ENV !== 'development' || !doyaPowerSampleAllowed()) notFound()
  const thisYear = jstYear(new Date())
  const years: number[] = []
  for (let y = thisYear; y >= MIN_YEAR; y--) years.push(y)
  return (
    <AppShell userName="サンプル">
      <AnnualReportView years={years} initialYear={thisYear} allowed={[...REVEAL_KEYS]} sample canEditOrgFx />
    </AppShell>
  )
}
