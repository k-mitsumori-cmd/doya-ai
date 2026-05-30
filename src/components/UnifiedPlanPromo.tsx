'use client';

import Link from 'next/link';
import NextImage from 'next/image';

type PromoService = {
  id: string;
  name: string;
  description: string;
  href: string;
  logo: string;
};

// 統一プラン対象のアクティブ7サービス（ロゴ画像があるもののみ掲載）
const ACTIVE_SERVICES: PromoService[] = [
  {
    id: 'banner',
    name: 'ドヤバナーAI',
    description: 'プロ品質バナー自動生成',
    href: '/banner',
    logo: '/banner/logo.png',
  },
  {
    id: 'seo',
    name: 'ドヤ記事作成',
    description: 'SEO+LLMO長文記事',
    href: '/seo',
    logo: '/seo/logo.png',
  },
  {
    id: 'interview',
    name: 'ドヤインタビュー',
    description: '音声から記事自動生成',
    href: '/interview',
    logo: '/interview/logo.png',
  },
  {
    id: 'persona',
    name: 'ドヤペルソナAI',
    description: 'ペルソナ自動生成',
    href: '/persona',
    logo: '/persona/logo.png',
  },
  {
    id: 'kintai',
    name: 'ドヤ勤怠',
    description: 'クラウド勤怠管理',
    href: '/kintai',
    logo: '/kintai/logo.png',
  },
  {
    id: 'doyalist',
    name: 'ドヤリスト',
    description: '営業リスト生成+営業文面',
    href: '/doyalist',
    logo: '/doyalist/logo.png',
  },
  {
    id: 'promane',
    name: 'ドヤプロマネ',
    description: '案件の進捗収支管理',
    href: '/promane',
    logo: '/promane/logo.png',
  },
];

const BRAND = '#7f19e6';

export default function UnifiedPlanPromo({
  currentServiceId,
  className,
}: {
  currentServiceId?: string;
  className?: string;
}) {
  const otherCount = currentServiceId
    ? ACTIVE_SERVICES.filter((s) => s.id !== currentServiceId).length
    : ACTIVE_SERVICES.length;

  return (
    <section
      className={[
        'relative overflow-hidden rounded-3xl border border-purple-100',
        'bg-gradient-to-br from-[#faf5ff] via-white to-[#f3e8ff]',
        'shadow-xl shadow-purple-200/40',
        'px-6 py-10 sm:px-10 sm:py-12',
        className ?? '',
      ].join(' ')}
    >
      {/* 背景の装飾グラデ */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-20 blur-3xl"
        style={{ background: BRAND }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-fuchsia-400 opacity-10 blur-3xl"
      />

      <div className="relative flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-12">
        {/* クマロゴ */}
        <div className="flex shrink-0 items-center justify-center">
          <div
            className="relative flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-lg shadow-purple-200/60 sm:h-40 sm:w-40"
            style={{ boxShadow: '0 12px 40px -12px rgba(127,25,230,0.45)' }}
          >
            <NextImage
              src="/character/working.png"
              alt="ドヤくま"
              width={160}
              height={160}
              className="h-28 w-28 object-contain sm:h-36 sm:w-36"
            />
          </div>
        </div>

        {/* テキスト + ロゴ群 */}
        <div className="flex-1 text-center lg:text-left">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ background: BRAND }}
          >
            <span className="material-symbols-outlined text-sm leading-none">
              auto_awesome
            </span>
            統一プロプラン
          </span>

          <h2 className="mt-4 text-2xl font-black leading-snug text-gray-900 sm:text-3xl">
            このプロプラン、実は
            <span style={{ color: BRAND }}>“全サービス”使い放題。</span>
          </h2>

          <p className="mt-3 text-base leading-relaxed text-gray-600 sm:text-lg">
            たった
            <span className="font-bold text-gray-900">1つのプロプラン契約</span>
            で、ドヤAIの
            <span className="font-bold" style={{ color: BRAND }}>
              全{ACTIVE_SERVICES.length}サービスのPro
            </span>
            がまるごと解放。B2Bマーケティングに必要なツールが、これひとつで全部そろいます。
          </p>

          {/* 価値訴求の3点 */}
          <ul className="mt-5 grid gap-2.5 text-left sm:grid-cols-3">
            {[
              { icon: 'lock_open', text: '全Proを1契約で解放' },
              { icon: 'trending_up', text: 'サービスは今後も増加' },
              { icon: 'workspace_premium', text: 'マーケ業務が全部入り' },
            ].map((item) => (
              <li
                key={item.icon}
                className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-purple-100"
              >
                <span
                  className="material-symbols-outlined text-lg"
                  style={{ color: BRAND }}
                >
                  {item.icon}
                </span>
                {item.text}
              </li>
            ))}
          </ul>

          {/* アクティブサービスのロゴ群 */}
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold text-gray-500">
              {currentServiceId
                ? `このサービス ＋ ほか${otherCount}個のツールが使い放題`
                : `全${ACTIVE_SERVICES.length}サービスが使い放題`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
              {ACTIVE_SERVICES.map((s) => {
                const isCurrent = s.id === currentServiceId;
                return (
                  <div
                    key={s.id}
                    title={s.name}
                    className={[
                      'flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 transition',
                      isCurrent
                        ? 'ring-2 ring-[#7f19e6] scale-105'
                        : 'ring-purple-100 hover:scale-105',
                    ].join(' ')}
                  >
                    <NextImage
                      src={s.logo}
                      alt={s.name}
                      width={32}
                      height={32}
                      className="h-7 w-7 object-contain"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* 早期加入の訴求 + CTA */}
          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:items-center lg:justify-start">
            <Link
              href="/all-in-one"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full px-6 py-3 text-base font-bold text-white shadow-lg transition hover:opacity-90 hover:shadow-xl sm:w-auto"
              style={{
                background: BRAND,
                boxShadow: '0 10px 30px -8px rgba(127,25,230,0.55)',
              }}
            >
              統一プランの詳細を見る
              <span className="material-symbols-outlined text-lg leading-none">
                arrow_forward
              </span>
            </Link>
            <p className="text-xs font-medium text-gray-500">
              サービスは今後もどんどん増加。
              <span className="font-bold" style={{ color: BRAND }}>
                早く入るほどお得です。
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
