import type { Metadata } from 'next';
import Link from 'next/link';
import NextImage from 'next/image';
import { getActiveServices } from '@/lib/services';

export const metadata: Metadata = {
  title: '統一プラン | ドヤAI',
  description:
    'どれか1つのプロプランを契約するだけで、ドヤAIの全サービスのPro機能が使い放題。B2Bマーケティングに必要なAIツールが、すべて揃う統一プラン。',
};

const STEPS = [
  {
    icon: 'workspace_premium',
    title: 'プロプランを1つ契約',
    description:
      'お好きなサービスのプロプランを1つ契約するだけ。難しい組み合わせや個別契約は不要です。',
  },
  {
    icon: 'lock_open',
    title: '全サービスのProが自動で解放',
    description:
      'ドヤAIの全サービスのPro機能が、同じアカウントで自動的に使えるようになります。',
  },
  {
    icon: 'all_inclusive',
    title: '追加課金なしで使い放題',
    description:
      '追加料金は一切なし。すべてのサービスのProを、心ゆくまで使い倒せます。',
  },
];

// サービスID → ロゴ画像パス（Service 型に logo フィールドが無いため別途定義）
const SERVICE_LOGOS: Record<string, string> = {
  banner: '/banner/logo.png',
  seo: '/seo/logo.png',
  interview: '/interview/logo.png',
  persona: '/persona/logo.png',
  kintai: '/kintai/logo.png',
  doyalist: '/doyalist/logo.png',
  promane: '/promane/logo.png',
};

const VALUES = [
  {
    icon: 'apps',
    title: '全サービス使い放題',
    description:
      'バナー・記事・インタビュー・ペルソナ・勤怠・営業リスト・案件管理まで、すべてのProが1契約で。',
  },
  {
    icon: 'trending_up',
    title: 'サービスは増え続ける',
    description:
      '新サービスが追加されても追加料金なし。早く入るほど、もらえる価値はどんどん大きくなります。',
  },
  {
    icon: 'hub',
    title: 'B2Bマーケに必要な全部',
    description:
      'B2Bマーケティングの企画から制作、営業、管理まで。必要なAIツールがこれ1つで揃います。',
  },
  {
    icon: 'account_circle',
    title: '同一アカウントで一元管理',
    description:
      'すべてのサービスを同じアカウントで利用。請求もログインも1つにまとまり、運用がシンプルに。',
  },
];

export default function AllInOnePage() {
  const services = getActiveServices();

  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* 1. ヒーロー */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-purple-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 py-20 sm:py-24 lg:flex-row lg:gap-16 lg:py-28">
          <div className="flex-1 text-center lg:text-left">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#7f19e6] px-4 py-1.5 text-sm font-bold text-white">
              <span className="material-symbols-outlined text-base">all_inclusive</span>
              統一プラン
            </div>
            <h1 className="text-4xl font-black leading-tight text-gray-900 sm:text-5xl lg:text-6xl">
              1契約で、ぜんぶ。
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-gray-600 sm:text-xl lg:mx-0">
              B2Bマーケティングに必要なAIツールが、すべて揃う。
              <br className="hidden sm:block" />
              どれか1つのプロプランで、全サービスのProが使い放題。
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start">
              <Link
                href="/banner"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7f19e6] px-8 py-4 text-base font-bold text-white shadow-lg shadow-purple-200 transition hover:bg-[#6b14c4] sm:w-auto"
              >
                無料ではじめる
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </Link>
              <a
                href="#services"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-purple-200 bg-white px-8 py-4 text-base font-bold text-[#7f19e6] transition hover:bg-purple-50 sm:w-auto"
              >
                サービス一覧を見る
                <span className="material-symbols-outlined text-xl">expand_more</span>
              </a>
            </div>
          </div>
          <div className="flex flex-1 justify-center">
            <div className="relative h-64 w-64 sm:h-80 sm:w-80 lg:h-96 lg:w-96">
              <NextImage
                src="/character/present.png"
                alt="ドヤくま"
                fill
                priority
                className="object-contain drop-shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. 統一プランの仕組み */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-black text-gray-900 sm:text-4xl">統一プランの仕組み</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            たった3ステップ。契約はシンプル、使える範囲は無限大。
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.icon}
              className="relative rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-8 text-center"
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7f19e6] text-white">
                <span className="material-symbols-outlined text-3xl">{step.icon}</span>
              </div>
              <div className="mb-2 text-sm font-black text-[#7f19e6]">STEP {i + 1}</div>
              <h3 className="mb-3 text-xl font-bold text-gray-900">{step.title}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. 価値訴求 */}
      <section className="bg-gradient-to-b from-white to-purple-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-black text-gray-900 sm:text-4xl">
              統一プランが選ばれる理由
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              1契約に、これだけの価値がまるごと詰まっています。
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {VALUES.map((value) => (
              <div
                key={value.icon}
                className="flex items-start gap-5 rounded-3xl border border-purple-100 bg-white p-7"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-[#7f19e6]">
                  <span className="material-symbols-outlined text-3xl">{value.icon}</span>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-bold text-gray-900">{value.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{value.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. アクティブサービスのカードグリッド */}
      <section id="services" className="mx-auto max-w-6xl scroll-mt-8 px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-black text-gray-900 sm:text-4xl">
            1契約で使える{services.length}サービス
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
            すべてのサービスのPro機能が、追加課金なしで使い放題に。
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Link
              key={service.id}
              href={service.dashboardHref}
              className="group flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-6 transition hover:-translate-y-1 hover:border-[#7f19e6] hover:shadow-lg hover:shadow-purple-100"
            >
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-gray-100">
                  <NextImage
                    src={SERVICE_LOGOS[service.id] ?? '/character/thumbsup.png'}
                    alt={service.name}
                    fill
                    className="object-contain"
                  />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{service.name}</h3>
              </div>
              <p className="text-sm leading-relaxed text-gray-600">{service.description}</p>
              <div className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-[#7f19e6]">
                くわしく見る
                <span className="material-symbols-outlined text-base transition group-hover:translate-x-1">
                  arrow_forward
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 5. 今後もサービスは増え続けます */}
      <section className="bg-gradient-to-br from-[#7f19e6] to-[#6b14c4] text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 py-20 lg:flex-row lg:gap-16">
          <div className="flex justify-center lg:order-last">
            <div className="relative h-56 w-56 sm:h-64 sm:w-64">
              <NextImage
                src="/character/jump.png"
                alt="ドヤくま"
                fill
                className="object-contain drop-shadow-xl"
              />
            </div>
          </div>
          <div className="flex-1 text-center lg:text-left">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold text-white">
              <span className="material-symbols-outlined text-base">rocket_launch</span>
              成長し続けるプラン
            </div>
            <h2 className="text-3xl font-black leading-tight sm:text-4xl">
              今後もサービスは増え続けます。
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-purple-100 lg:mx-0">
              新サービスが追加されても、統一プランなら追加料金は一切なし。
              ラインナップが増えるほど、あなたのプランの価値はどんどん大きくなります。
              <span className="font-bold text-white">早く入るほど、お得です。</span>
            </p>
          </div>
        </div>
      </section>

      {/* 6. 最終CTA */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="overflow-hidden rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-purple-50 p-8 text-center sm:p-14">
          <div className="mx-auto mb-6 flex justify-center">
            <div className="relative h-40 w-40 sm:h-48 sm:w-48">
              <NextImage
                src="/character/thumbsup.png"
                alt="ドヤくま"
                fill
                className="object-contain"
              />
            </div>
          </div>
          <h2 className="text-3xl font-black text-gray-900 sm:text-4xl">
            さあ、1契約でぜんぶ始めよう。
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
            まずは無料で。B2Bマーケに必要なAIツールを、まるごと体験してください。
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/banner"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#7f19e6] px-8 py-4 text-base font-bold text-white shadow-lg shadow-purple-200 transition hover:bg-[#6b14c4] sm:w-auto"
            >
              無料ではじめる
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </Link>
            <a
              href="https://doyamarke.surisuta.jp/contact"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-purple-200 bg-white px-8 py-4 text-base font-bold text-[#7f19e6] transition hover:bg-purple-50 sm:w-auto"
            >
              お問い合わせ
              <span className="material-symbols-outlined text-xl">mail</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
