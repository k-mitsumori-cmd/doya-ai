'use client'

import { BANNER_PRICING } from '@/lib/pricing'
import { TrialNote } from '@/components/TrialCallout'
import type { useBannerQuota } from './useBannerQuota'

export default function BannerQuotaNotice({ quota }: { quota: ReturnType<typeof useBannerQuota> }) {
  if (!quota.signedIn) return null
  const { usage } = quota
  if (!usage) return (
    <div role="status" className="my-3 rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
      {quota.error ? <>使用状況を確認できませんでした。<button type="button" onClick={() => void quota.refresh()} className="ml-2 underline">再読み込み</button></> : '今月の使用状況を確認しています…'}
    </div>
  )
  const remaining = usage.limit === null ? null : Math.max(0, usage.limit - usage.used)
  const low = remaining !== null && remaining <= 3
  const canUpgrade = usage.limit !== null && usage.limit < BANNER_PRICING.proLimit
  return (
    <section aria-label="今月のバナー生成枠" className="my-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800">
      <p role="status" className="font-bold">今月 {usage.used} / {usage.limit ?? '上限なし'} 枚{remaining !== null && `（残り${remaining}枚）`}</p>
      {low && <>
        <p className="mt-2">{remaining === 0 ? '今月の生成枠を使い切りました。' : `今月の生成枠はあと${remaining}枚です。`}{canUpgrade ? `プロなら月${BANNER_PRICING.proLimit}枚まで生成できます。` : '追加の生成枠についてご相談いただけます。'}</p>
        {canUpgrade && <TrialNote className="mt-2" />}
        <button type="button" onClick={() => quota.showLimit(usage)} className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-bold text-white">{canUpgrade ? 'プランと無料体験の対象条件を確認する' : '追加の生成枠を相談する'}</button>
      </>}
    </section>
  )
}
