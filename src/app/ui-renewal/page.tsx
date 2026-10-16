import type { Metadata } from 'next'
import { RenewalApp } from './RenewalApp'

// UIリニューアル案の見本。ログイン不要・実データを読まない・検索に出さない。
export const metadata: Metadata = {
  title: 'UIリニューアル案（見本）',
  robots: { index: false, follow: false },
}

export default function UiRenewalPage() {
  return <RenewalApp />
}
