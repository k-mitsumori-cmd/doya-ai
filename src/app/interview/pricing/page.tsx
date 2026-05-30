import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans';

export default function InterviewPricingPage() {
  const faqs = [
    {
      q: '無料プランでもインタビュー機能は使えますか？',
      a: 'はい。無料プランでも基本的なインタビュー作成をお試しいただけます。利用回数や保存数には上限があり、上限はプランカードに記載しています。',
    },
    {
      q: 'プロプランの料金に含まれるものは？',
      a: 'ドヤインタビューのプロ機能に加え、ドヤAIの全サービス（SEO・バナー・ペルソナなど）がプロプランとして解放されます。1つのご契約ですべてのサービスをプロ品質でご利用いただけます。',
    },
    {
      q: '支払い方法やプラン変更は？',
      a: 'クレジットカードでのお支払いに対応しています。プランのアップグレード・ダウングレードはいつでも可能です。',
    },
    {
      q: '解約はいつでもできますか？',
      a: 'はい。いつでも解約いただけます。解約後も契約期間の終了まではプロ機能をご利用いただけます。',
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50">
      <div className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
        {/* ヒーロー */}
        <section className="text-center">
          <span
            className="inline-block rounded-full px-4 py-1 text-sm font-semibold"
            style={{ backgroundColor: 'rgba(127, 25, 230, 0.1)', color: '#7f19e6' }}
          >
            ドヤインタビュー
          </span>
          <h1 className="mt-4 text-3xl font-black text-slate-900 sm:text-4xl">
            ドヤインタビュー 料金プラン
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            まずは無料で。AIインタビューで魅力的なコンテンツづくりを始めましょう。
            プロプランなら、ドヤAIの全サービスがまとめて使い放題になります。
          </p>
        </section>

        {/* プラン */}
        <UnifiedPricingPlans serviceId="interview" className="my-12" />

        {/* FAQ */}
        <section className="mt-16">
          <h2 className="mb-8 text-center text-2xl font-black text-slate-900">
            よくあるご質問
          </h2>
          <div className="mx-auto max-w-3xl space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="flex items-start gap-2 text-base font-bold text-slate-900">
                  <span
                    className="material-symbols-outlined text-xl"
                    style={{ color: '#7f19e6' }}
                    aria-hidden
                  >
                    help
                  </span>
                  {faq.q}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
