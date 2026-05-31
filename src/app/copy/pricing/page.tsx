'use client'

import { useSession } from 'next-auth/react'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

export default function CopyPricingPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const currentPlan = String(user?.copyPlan || user?.plan || 'FREE').toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-gray-900 mb-3">料金プラン</h1>
          <p className="text-gray-500">あなたの広告制作規模に合わせてプランを選択</p>
        </div>

        <UnifiedPricingPlans serviceId="copy" currentPlan={currentPlan} className="my-12" />

        {/* FAQ */}
        <div className="mt-12 border-t border-gray-200 pt-10">
          <h2 className="text-xl font-black text-gray-900 mb-6 text-center">よくある質問</h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {[
              {
                q: '無料プランはどのくらい使えますか？',
                a: 'ゲスト（未ログイン）は月3回、ログイン後の無料プランは月10回まで生成できます。クレジットカード不要で今すぐ試せます。',
              },
              {
                q: 'Proプランにはどんなメリットがありますか？',
                a: '月200回の生成、全広告タイプ（ディスプレイ/検索/SNS）、5種類のライタータイプ、ブラッシュアップ機能、CSV/Excelエクスポートなどが利用可能です。',
              },
              {
                q: '支払い方法は何が使えますか？',
                a: 'Stripe経由でクレジットカード（Visa, Mastercard, JCB, American Express）でのお支払いに対応しています。',
              },
              {
                q: 'いつでもキャンセルできますか？',
                a: 'はい、いつでもキャンセルできます。解約後は月末まで引き続きご利用いただけます。',
              },
            ].map((faq, i) => (
              <div key={i} className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
                <p className="font-bold text-gray-900 mb-2">{faq.q}</p>
                <p className="text-sm text-gray-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
