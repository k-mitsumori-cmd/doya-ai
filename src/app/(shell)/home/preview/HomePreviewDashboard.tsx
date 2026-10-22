'use client'

import type { HomeSummary } from '@/lib/home/summary'
import { HomeDashboardView } from '../HomeDashboard'

// この専用previewはserver側で本番404。実ホームの認証境界は迂回しない。
const current = () => true
const refresh = () => {}
export default function HomePreviewDashboard({ initial }: { initial: HomeSummary }) {
  return <HomeDashboardView summary={initial} loading={false} error={null} refresh={refresh} current={current} epoch={0} setupHidden />
}
