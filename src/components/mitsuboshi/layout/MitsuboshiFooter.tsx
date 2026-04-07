/**
 * 三ツ星アプリ シリーズ共通フッター
 */

import Link from 'next/link'
import { MITSUBOSHI_BRAND } from '@/lib/mitsuboshi/_shared/constants'

export function MitsuboshiFooter() {
  return (
    <footer
      className="border-t border-mitsuboshi-twilight/60 bg-mitsuboshi-midnight/80 text-mitsuboshi-mist"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-5 py-8 text-center">
        <div className="flex items-center gap-1 text-mitsuboshi-champagne">
          <span>☆</span>
          <span>☆</span>
          <span>☆</span>
        </div>
        <p className="font-mitsuboshi text-lg text-mitsuboshi-moon">
          {MITSUBOSHI_BRAND.tagline}
        </p>
        <p className="max-w-md text-[11px] leading-relaxed text-mitsuboshi-fog">
          三ツ星アプリは、暮らしの中の小さな瞬間にとっておきを届けるアプリシリーズです。
          <br />
          ナグサメはAIで、専門家ではありません。つらい気持ちが続くときは専門機関にご相談ください。
        </p>
        <div className="flex flex-wrap justify-center gap-4 text-[11px]">
          <Link href="/nagusame" className="hover:text-mitsuboshi-champagne">
            ホーム
          </Link>
          <Link href="/nagusame/pricing" className="hover:text-mitsuboshi-champagne">
            プラン
          </Link>
          <a href="mailto:support@surisuta.jp" className="hover:text-mitsuboshi-champagne">
            お問い合わせ
          </a>
        </div>
        <p className="text-[10px] text-mitsuboshi-fog">© Mitsuboshi Apps</p>
      </div>
    </footer>
  )
}
