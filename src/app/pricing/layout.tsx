import type { Metadata } from 'next'
import { SITE_CONFIG, SITE_ALTERNATE_NAMES } from '@/lib/seo'

// 統一プラン（無料 / プロ ¥9,980）の共通料金ページ。
// ルートlayoutの title をそのまま継承するとトップページと同一 title になるため、固有titleを持たせる。
export const metadata: Metadata = {
  // absolute でルートlayoutの template（` | ドヤマーケAI`）の二重付与を防ぐ
  title: { absolute: `料金プラン｜${SITE_CONFIG.name}` },
  description: `${SITE_CONFIG.name}の料金プラン。無料プランで試せて、プロプラン（月額9,980円）なら記事生成・広告バナー・営業リスト・人事・勤怠・SFA・資料作成まで全ツールが使い放題です。`,
  keywords: [SITE_CONFIG.name, ...SITE_ALTERNATE_NAMES, `${SITE_CONFIG.name} 料金`, '料金プラン', '統一プラン', 'AI SaaS 料金'],
  alternates: { canonical: '/pricing' },
  openGraph: {
    type: 'website',
    locale: SITE_CONFIG.locale,
    url: `${SITE_CONFIG.url}/pricing`,
    siteName: SITE_CONFIG.name,
    title: `料金プラン｜${SITE_CONFIG.name}`,
    description: `無料プランで試せて、プロプラン（月額9,980円）なら${SITE_CONFIG.name}の全ツールが使い放題です。`,
    images: [{ url: `${SITE_CONFIG.url}/og/portal.png`, width: 1200, height: 630, alt: `料金プラン - ${SITE_CONFIG.name}` }],
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
