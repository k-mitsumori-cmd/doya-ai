import type { Metadata } from 'next'
import Link from 'next/link'
import { MitsuboshiHeader } from '@/components/mitsuboshi/layout/MitsuboshiHeader'
import { MitsuboshiFooter } from '@/components/mitsuboshi/layout/MitsuboshiFooter'

export const metadata: Metadata = {
  title: 'プラン',
  description: 'ナグサメ無料プランとPROプランの比較',
}

const FREE_FEATURES = [
  '5人の星々から慰めが届く',
  '1日3回まで打ち明けられる',
  '履歴は直近7日',
]

const PRO_FEATURES = [
  '15人全員の星々が応える',
  '回数無制限',
  '履歴は無期限',
  '限定キャラ・深夜モード（近日）',
]

export default function NagusamePricingPage() {
  return (
    <>
      <MitsuboshiHeader
        volume={1}
        productName="ナグサメ"
        productSubtitle="あなたの夜に、満天の星を"
      />
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-12">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="text-[11px] tracking-[0.3em] text-mitsuboshi-mist">
            ☆ ☆ ☆
          </span>
          <h1 className="font-mitsuboshi text-3xl text-mitsuboshi-moon">
            プラン
          </h1>
          <p className="text-[13px] text-mitsuboshi-mist">
            今夜だけ、もっと話したい気がしたら。
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <article className="flex flex-col gap-4 rounded-3xl border border-mitsuboshi-twilight bg-mitsuboshi-indigo/60 p-6">
            <h2 className="font-mitsuboshi text-2xl text-mitsuboshi-moon">Free</h2>
            <p className="text-[12px] text-mitsuboshi-mist">まずはそっと、試してみてください。</p>
            <ul className="flex flex-col gap-2 text-[13px] text-mitsuboshi-moon">
              {FREE_FEATURES.map((f) => (
                <li key={f}>・{f}</li>
              ))}
            </ul>
            <p className="mt-auto text-[22px] font-mitsuboshi text-mitsuboshi-moon">¥0</p>
          </article>

          <article className="flex flex-col gap-4 rounded-3xl border border-mitsuboshi-champagne/60 bg-mitsuboshi-indigo p-6 shadow-glow-champagne">
            <h2 className="font-mitsuboshi text-2xl text-mitsuboshi-champagne">PRO</h2>
            <p className="text-[12px] text-mitsuboshi-mist">
              星々を全員呼んで、満天の夜に。
            </p>
            <ul className="flex flex-col gap-2 text-[13px] text-mitsuboshi-moon">
              {PRO_FEATURES.map((f) => (
                <li key={f}>・{f}</li>
              ))}
            </ul>
            <p className="mt-auto text-[22px] font-mitsuboshi text-mitsuboshi-champagne">
              ¥980<span className="text-[12px] text-mitsuboshi-mist"> / 月</span>
            </p>
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-full border border-mitsuboshi-champagne/40 bg-mitsuboshi-champagne/10 py-3 text-[13px] text-mitsuboshi-champagne opacity-60"
            >
              準備中です
            </button>
          </article>
        </div>

        <p className="text-center text-[11px] text-mitsuboshi-fog">
          Stripe 決済は近日対応予定です。PRO開放までしばらくお待ちください。
        </p>

        <div className="flex justify-center">
          <Link
            href="/"
            className="text-[12px] text-mitsuboshi-mist underline-offset-4 hover:text-mitsuboshi-champagne hover:underline"
          >
            ホームへ戻る
          </Link>
        </div>
      </section>
      <MitsuboshiFooter />
    </>
  )
}
