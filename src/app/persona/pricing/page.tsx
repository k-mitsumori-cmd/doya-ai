import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

const FAQ_ITEMS = [
  {
    q: 'プロプランで何ができますか？',
    a: 'ドヤペルソナAIのすべての機能を上限なくご利用いただけます。さらに、ドヤマーケAIの全サービス（SEO・バナー・インタビューなど）のプロ機能も同じ契約で解放されます。',
  },
  {
    q: '無料プランでも使えますか？',
    a: 'はい。無料プランでも基本的なペルソナ生成をお試しいただけます。まずは無料で機能をご体験ください。',
  },
  {
    q: '1つの契約で他のサービスも使えますか？',
    a: 'はい。ドヤマーケAIは統一プラン方式を採用しています。プロプランを契約すると、対象のすべてのAIサービスがプロとして使えます。サービスごとに個別契約する必要はありません。',
  },
  {
    q: 'プランはいつでも変更できますか？',
    a: 'いつでもアップグレード・ダウングレードが可能です。契約管理ポータルから簡単に手続きいただけます。',
  },
]

export default function PersonaPricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50">
      <div className="p-6 lg:p-10 max-w-6xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4 px-5 py-2 bg-gradient-to-r from-[#7f19e6]/10 to-violet-100 rounded-full">
            <span
              className="material-symbols-outlined text-[#7f19e6] text-lg"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              psychology
            </span>
            <span className="text-sm font-bold text-[#7f19e6]">ドヤペルソナAI</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 mb-3">
            ドヤペルソナAI 料金プラン
          </h1>
          <p className="text-slate-500 max-w-xl mx-auto text-base">
            ターゲット顧客のペルソナをAIが瞬時に生成。
            まずは無料でお試しいただき、本格活用はプロプランへ。
            1つの契約でドヤマーケAIの全サービスが使えます。
          </p>
        </div>

        {/* 統一プランカード（無料 / プロ ¥9,980） */}
        <UnifiedPricingPlans serviceId="persona" className="my-12" />

        {/* FAQ */}
        <div className="mt-16">
          <h2 className="text-2xl font-black text-slate-900 text-center mb-8">よくある質問</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q} className="bg-white rounded-3xl shadow-lg p-6">
                <h3 className="flex items-start gap-2 text-base font-bold text-slate-900 mb-2">
                  <span className="material-symbols-outlined text-[#7f19e6] text-xl flex-shrink-0">
                    help
                  </span>
                  {item.q}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed pl-7">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
