import Link from 'next/link'

const PLANS = [
  {
    name: '無料プラン',
    price: '¥0',
    limit: '月3プロジェクトまで',
    features: ['PDF出力（ウォーターマーク付き）', 'Google / Meta / LINE 対応'],
    cta: 'ログインして開始',
    href: '/adsim/new',
    highlight: false,
  },
  {
    name: 'プロプラン',
    price: '¥9,980',
    limit: '月額 / 無制限',
    features: ['プロジェクト数 無制限', 'PPTX / Excel 出力', '全6媒体対応', 'ロゴ差し替え'],
    cta: 'プロにアップグレード',
    href: '/adsim/new',
    highlight: true,
  },
  {
    name: 'エンタープライズ',
    price: '¥49,800',
    limit: '月額 / チーム利用',
    features: ['複数ブランド管理', 'チーム共有・コメント', 'Google Ads API連携（計画中）'],
    cta: '問い合わせ',
    href: '/adsim/new',
    highlight: false,
  },
]

export default function AdSimPricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 py-12">
      <div className="mx-auto max-w-5xl px-4">
        <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">料金プラン</h1>
        <p className="mb-10 text-center text-sm text-gray-600">
          ドヤAIは全サービス共通の統一課金。1つPro契約すれば他サービスもPro枠で利用可能です。
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-xl border bg-white p-6 shadow-sm ${
                p.highlight ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'
              }`}
            >
              <h2 className="mb-1 text-lg font-bold text-gray-900">{p.name}</h2>
              <p className="mb-1 text-3xl font-bold text-indigo-600">{p.price}</p>
              <p className="mb-4 text-xs text-gray-500">{p.limit}</p>
              <ul className="mb-6 space-y-1 text-sm text-gray-700">
                {p.features.map((f, i) => (
                  <li key={i}>・{f}</li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`block rounded-lg px-4 py-2 text-center text-sm font-medium ${
                  p.highlight
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
