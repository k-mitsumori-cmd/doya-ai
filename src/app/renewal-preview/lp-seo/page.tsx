import type { Metadata } from 'next'
import SeoLpKit from '@/app/(shell)/seo/LpKit'

// ドヤバディ LP リニューアルの試作（新しい共通の型 lp-kit の見本: ドヤ記事作成）。
// 検索に出さない。既存の /renewal-preview/[service] とは別のルート（静的な lp-seo が優先される）。
export const metadata: Metadata = {
  title: 'ドヤ記事作成 | LP試作（lp-kit）',
  robots: { index: false, follow: false },
}

export default function Page() {
  return <SeoLpKit />
}
