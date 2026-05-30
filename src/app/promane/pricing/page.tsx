import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans';

export const metadata = {
  title: 'ドヤプロマネ 料金プラン',
  description:
    'ドヤプロマネの料金プラン。無料プランで気軽にスタートし、プロプランで全機能とすべてのドヤAIサービスを解放。',
};

const faqs = [
  {
    question: '無料プランでどこまで使えますか？',
    answer:
      '無料プランでも基本的なプロジェクト管理機能をお試しいただけます。チーム規模やプロジェクト数などに上限があり、上限を超える場合はプロプランへのアップグレードが必要です。',
  },
  {
    question: 'プロプランに申し込むと何が変わりますか？',
    answer:
      'プロプラン（¥9,980／月）では各種上限が大幅に緩和され、ドヤプロマネのすべての機能をご利用いただけます。さらに、ドヤAIの他サービスもすべてプロ機能として解放されます。',
  },
  {
    question: '1つの契約で他のドヤAIサービスも使えますか？',
    answer:
      'はい。ドヤAIは統一プラン方式を採用しています。プロプランをご契約いただくと、ドヤプロマネだけでなく、すべてのドヤAIサービスのプロ機能をまとめてご利用いただけます。',
  },
  {
    question: 'いつでも解約できますか？',
    answer:
      'はい。プロプランは月単位でご契約いただけ、いつでも解約可能です。解約後も契約期間の終了までは引き続きプロ機能をご利用いただけます。',
  },
];

export default function PromanePricingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* ヒーロー */}
      <section className="px-6 pt-20 pb-8 text-center">
        <div className="mx-auto max-w-3xl">
          <span
            className="inline-block rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{ backgroundColor: 'rgba(127, 25, 230, 0.1)', color: '#7f19e6' }}
          >
            料金プラン
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            ドヤプロマネ 料金プラン
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">
            プロジェクト管理をもっとシンプルに。まずは無料で始めて、必要になったらプロプランへ。
            プロプランなら、すべてのドヤAIサービスがまとめて使い放題になります。
          </p>
        </div>
      </section>

      {/* プランカード（共通コンポーネント） */}
      <section className="px-6">
        <div className="mx-auto max-w-5xl">
          <UnifiedPricingPlans serviceId="promane" className="my-12" />
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24 pt-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            よくあるご質問
          </h2>
          <div className="mt-10 space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.question}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <h3 className="flex items-start gap-2 text-lg font-semibold text-gray-900">
                  <span
                    className="material-symbols-outlined mt-0.5 text-xl"
                    style={{ color: '#7f19e6' }}
                    aria-hidden
                  >
                    help
                  </span>
                  {faq.question}
                </h3>
                <p className="mt-3 leading-relaxed text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
