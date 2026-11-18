import type { Metadata } from 'next'

/**
 * アプリ（ドヤバディ）の画面で、課金・契約・価格の経路を開こうとしたときに出す、中立のページ。
 * middleware が /pricing などをここへ rewrite する（アプリ表示モードのときだけ。src/lib/app-mode/blocked-routes.ts）。
 * 案内は1文だけ。アプリの外の手続きへ誘導する語（契約・購入・料金・リンク）を出さない。
 */
export const metadata: Metadata = {
  title: 'ご案内',
  robots: { index: false, follow: false },
}

export default function AppUnavailablePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6 py-16 text-slate-900">
      <h1 className="text-xl font-bold">ご案内</h1>
      <p className="mt-5 leading-7 text-slate-600">このページはアプリではご利用になれません。</p>
    </main>
  )
}
