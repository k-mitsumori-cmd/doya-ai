import type { Metadata } from 'next'
import { Dela_Gothic_One, Zen_Kaku_Gothic_New, JetBrains_Mono } from 'next/font/google'
import { buildServiceMetadata } from '@/lib/seo'
import './tenjikai.css'

// ⚠️ 開発中（UNLISTED_SERVICE_IDS / coming_soon）のあいだは noindex。公開するときは両方外す
export const metadata: Metadata = buildServiceMetadata('tenjikai', {
  tagline: 'URLを入れるだけで、展示会のブース設営案・制作物・ノベルティ・予算・業者選定・締切管理までを一括で準備',
  keywords: ['展示会 準備', '展示会 ブース 設営', '展示会 ノベルティ', '展示会 予算', '展示会 チェックリスト'],
  noindex: true,
})

const display = Dela_Gothic_One({ weight: '400', subsets: ['latin'], variable: '--font-tenjikai-display', display: 'swap' })
const body = Zen_Kaku_Gothic_New({ weight: ['400', '500', '700', '900'], subsets: ['latin'], variable: '--font-tenjikai-body', display: 'swap' })
const mono = JetBrains_Mono({ weight: ['400', '600'], subsets: ['latin'], variable: '--font-tenjikai-mono', display: 'swap' })

export default function TenjikaiLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${body.variable} ${mono.variable}`}>{children}</div>
}
