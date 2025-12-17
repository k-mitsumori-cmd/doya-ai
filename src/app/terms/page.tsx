import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span>トップに戻る</span>
          </Link>
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">利用規約</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 mb-8">最終更新日: 2024年12月17日</p>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第1条（適用）</h2>
            <p className="text-gray-700 leading-relaxed">
              本規約は、ドヤAI（以下「本サービス」）の利用に関する条件を定めるものです。
              ユーザーは、本規約に同意の上、本サービスを利用するものとします。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第2条（利用登録）</h2>
            <p className="text-gray-700 leading-relaxed">
              ユーザーは、Googleアカウントを使用して本サービスに登録することができます。
              登録にあたり、ユーザーは正確かつ最新の情報を提供する義務を負います。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第3条（禁止事項）</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              ユーザーは、以下の行為を行ってはなりません：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>本サービスの運営を妨害する行為</li>
              <li>他のユーザーに迷惑をかける行為</li>
              <li>不正アクセスを試みる行為</li>
              <li>その他、当社が不適切と判断する行為</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第4条（コンテンツの権利）</h2>
            <p className="text-gray-700 leading-relaxed">
              本サービスを使用して生成されたコンテンツの著作権は、ユーザーに帰属します。
              ただし、当社は本サービスの改善・宣伝目的で、匿名化されたデータを使用する権利を有します。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第5条（免責事項）</h2>
            <p className="text-gray-700 leading-relaxed">
              当社は、本サービスの内容について、その正確性、完全性、有用性等について保証しません。
              本サービスの利用により生じた損害について、当社は一切の責任を負いません。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第6条（規約の変更）</h2>
            <p className="text-gray-700 leading-relaxed">
              当社は、必要に応じて本規約を変更することができます。
              変更後の規約は、本サービス上に掲載した時点で効力を生じます。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">第7条（準拠法・管轄裁判所）</h2>
            <p className="text-gray-700 leading-relaxed">
              本規約の解釈にあたっては日本法を準拠法とします。
              本サービスに関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}

