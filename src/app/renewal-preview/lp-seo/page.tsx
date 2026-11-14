import type { Metadata } from 'next'
import SeoLpKit from '@/app/(shell)/seo/LpKit'

// ドヤバディ LP リニューアルの試作（新しい共通の型 lp-kit の見本: ドヤ記事作成）。
// 検索に出さない。既存の /renewal-preview/[service] とは別のルート（静的な lp-seo が優先される）。
export const metadata: Metadata = {
  title: 'ドヤ記事作成 | LP試作（lp-kit）',
  robots: { index: false, follow: false },
}

// ?hero=a: 右に製品画面の縮小版 / ?hero=b: 右に既存のドヤくんの絵 / 無指定: 文字だけ
export default async function Page({ searchParams }: { searchParams: Promise<{ hero?: string }> }) {
  const { hero } = await searchParams
  return <SeoLpKit hero={hero} />
}
