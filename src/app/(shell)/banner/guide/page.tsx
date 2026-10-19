import type { Metadata } from 'next'
import Link from 'next/link'
import { buildServiceSubMetadata } from '@/lib/seo'

export const metadata: Metadata = buildServiceSubMetadata('banner', 'guide', {
  path: '/banner/guide',
  description: 'ドヤバナーAIの使い方。テンプレートの選択から文字・サイズ・枚数の指定、生成画像の確認とダウンロードまでを案内します。',
})

const steps = [
  {
    title: 'テンプレートを選ぶ',
    description: '作りたいバナーの雰囲気に近いテンプレートを選びます。使えるテンプレートはプランによって異なります。',
  },
  {
    title: '文字・サイズ・枚数を指定する',
    description: 'バナーに入れる文字を入力し、掲載先に合うサイズと生成枚数を選びます。残りの月間枠を超える場合は生成時に案内が表示されます。',
  },
  {
    title: '生成して見比べる',
    description: '生成ボタンを押すと、選んだスタイルに沿って画像を作ります。完成した画像を見比べ、目的に合う案を選んでください。',
  },
  {
    title: '画像をダウンロードする',
    description: '画像のダウンロードにはログインが必要です。ダウンロードできるテンプレートの範囲はプランによって異なります。',
  },
]

export default function BannerGuidePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
        <Link href="/banner" className="text-sm font-semibold text-blue-700 hover:underline">
          ← ドヤバナーAIに戻る
        </Link>
        <div className="mt-10">
          <p className="text-sm font-bold tracking-widest text-blue-700">DOYA BANNER</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">使い方ガイド</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
            テンプレートを選んで画像を作り、完成した案を保存するまでの流れを案内します。
          </p>
        </div>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold text-blue-700">STEP {index + 1}</p>
              <h2 className="mt-2 text-xl font-bold">{step.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>

        <section className="mt-10 rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:p-8" aria-labelledby="guide-limit-heading">
          <h2 id="guide-limit-heading" className="text-xl font-bold">今月の生成枠を使い切った場合</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            生成画面に表示される上限案内を確認してください。上限に達した場合は、次の月の枠を待つか、料金ページでプランを確認できます。
          </p>
          <Link href="/banner/pricing" className="mt-5 inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800">
            料金プランを見る
          </Link>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/banner" className="inline-flex rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-700">
            バナーを作る
          </Link>
          <Link href="/banner/landing" className="inline-flex rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold hover:bg-slate-100">
            サービス紹介を見る
          </Link>
        </div>
      </div>
    </main>
  )
}
