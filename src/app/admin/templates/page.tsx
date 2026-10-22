import Link from 'next/link'

export default function AdminTemplatesPage() {
  return (
    <section className="mx-auto w-full max-w-3xl p-6 sm:p-8">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <h1 className="text-xl font-bold text-white sm:text-2xl">
          旧カンタンマーケAIのテンプレート管理
        </h1>
        <p className="mt-4 leading-relaxed text-white/70">
          カンタンマーケAIは提供を終了しています。
          この画面ではテンプレートの追加・編集・公開設定はできません。
        </p>
        <Link
          href="/admin/services"
          className="mt-6 inline-flex rounded-lg bg-violet-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        >
          サービス管理へ戻る
        </Link>
      </div>
    </section>
  )
}
