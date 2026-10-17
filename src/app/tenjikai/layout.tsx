import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import '@/components/tenjikai/ds-tokens.css'
import './tenjikai.css'

// ⚠️ 開発中（UNLISTED_SERVICE_IDS / coming_soon）のあいだは noindex。公開するときは両方外す
export const metadata: Metadata = buildServiceMetadata('tenjikai', {
  tagline: 'URLを入れるだけで、展示会のブース設営案・制作物・ノベルティ・予算・業者選定・締切管理までを一括で準備',
  keywords: ['展示会 準備', '展示会 ブース 設営', '展示会 ノベルティ', '展示会 予算', '展示会 チェックリスト'],
  noindex: true,
})

export default function TenjikaiLayout({ children }: { children: React.ReactNode }) {
  // ⚠️ ツール独自のフォントは使わない（統合仕様 §11）。サイト共通の Inter ＋ Noto Sans JP のまま
  return <>{children}</>
}
