import type { Metadata } from 'next'
import { LpSample } from './LpSample'

// ドヤAI 入口LPのデザイン見本（4案切り替え）。検索に出さない・実データを読まない。
export const metadata: Metadata = {
  title: 'LPデザイン案（見本）',
  robots: { index: false, follow: false },
}

export default function UiRenewalLpPage() {
  return <LpSample />
}
