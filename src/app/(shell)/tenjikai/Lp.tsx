'use client'

// ドヤ展示会 ランディングページ（未ログインの方に見せる面。点検 SHL-015）
// ⚠️ 実績の数値は持っていないので書かない。開発中のサービスなので、できないことは書かない。
// 画像は Codex の定額枠で作ったもの（docs/design/images/tenjikai/PROMPTS.md）。
import { LpShell, ProductHero, FeatureShowcase, HowItWorks, UseCases, FaqSection, CtaBand, type ShowcaseRow, type Step, type Faq } from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { tenjikaiLoginHref } from '@/lib/tenjikai/login-return'

const SVC = getServiceById('tenjikai')!
const ACCENT = '#0066ff'

const ROWS: ShowcaseRow[] = [
  {
    icon: 'edit_note',
    title: 'URLと出展条件を入れる',
    desc: '自社サービスのURLと、展示会名・会期・会場・小間数・予算・出展の目的を入れます。入力は1画面で終わります。',
    bullets: ['会場ごとの高さの制限を考えて設計', '目的は名刺の獲得・認知・体験から選ぶ'],
    image: { src: '/tenjikai/step-1.webp', alt: 'URLと会期と小間数を入れる画面' },
  },
  {
    icon: 'view_in_ar',
    title: 'ブース案と制作物をまとめて用意',
    desc: 'サイトの内容から訴求点を読み取り、ブースのレイアウト案を3つ作ります。背面パネルやチラシのコピーとサイズも用意します。',
    bullets: ['3D図面は回して確かめられる', '壁面ごとに、どの高さに何を描くかを割り付ける', 'ノベルティは来場者の段階ごとに数量を提案'],
    image: { src: '/tenjikai/step-2.webp', alt: '3つのブース案と制作物の案' },
  },
  {
    icon: 'event_available',
    title: '予算と締切を一覧にする',
    desc: '小間料から施工・印刷・人件費までの予算を費目ごとに出します。会期から逆算した申込・入稿・発注の締切も並べます。',
    bullets: ['予算を超えたら、見直す場所を示す', '業者に渡す発注仕様書の下書きを作る'],
    image: { src: '/tenjikai/step-3.webp', alt: '業者の比較と締切の一覧' },
  },
]

const STEPS: Step[] = [
  { icon: 'link', title: 'URLと条件を入れる', desc: '出展するサービスのURLと、展示会の条件を入れます。' },
  { icon: 'auto_awesome', title: '準備の一式ができる', desc: 'ブース案・制作物・ノベルティ・予算・締切をまとめて作ります。' },
  { icon: 'checklist', title: '確かめて発注する', desc: '案を見比べて選び、発注仕様書を業者に渡します。' },
]

const FAQ: Faq[] = [
  { q: '無料で使えますか？', a: `無料プランでは、${SVC.pricing.free.limit}使えます。プロプランでは${SVC.pricing.pro.limit}使えます。` },
  { q: '業者への発注までしてくれますか？', a: '発注そのものは行いません。業者に渡す発注仕様書の下書きを作ります。業者の候補は見本で、実在の業者ではありません。' },
  { q: 'デザインの画像も作れますか？', a: '制作物の画像を作る機能は準備中です。いまはコピーと構成、サイズまでを用意します。' },
  { q: '金額は正確ですか？', a: '小間料と単価は目安です。実際の金額は、主催者の料金表と業者の見積で確かめてください。' },
]

export default function TenjikaiLp() {
  return <Suspense fallback={<p role="status">表示を確認しています。</p>}><TenjikaiLpContent /></Suspense>
}

function TenjikaiLpContent() {
  const ctaHref = tenjikaiLoginHref(usePathname(), useSearchParams())
  return (
    <LpShell serviceName={SVC.name} icon="storefront" ctaHref={ctaHref} ctaLabel="ログインしてはじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤAI（開発中）"
        title="URLを入れるだけで、"
        highlight="展示会の準備をまとめて用意。"
        subtitle="ブースの設営案、制作物、ノベルティ、予算、締切の一覧を、出展の条件から一度に作ります。"
        note={`無料プランは${SVC.pricing.free.limit}。クレジットカードの登録は要りません。`}
        ctaHref={ctaHref}
        ctaLabel="ログインしてはじめる"
        image={{ src: '/tenjikai/hero.webp', alt: '展示会のブースと、ブースの図面と予算の画面' }}
      />

      <UseCases
        title="こんな方のためのツールです"
        items={[
          '初めての出展で、何をいつまでに準備すればよいか分からない',
          '施工会社に伝える要望を、図面と一緒にまとめたい',
          '展示会の予算を、社内で説明できる形にしたい',
        ]}
      />

      <FeatureShowcase eyebrow="できること" title="出展の準備を、3つの段階で" rows={ROWS} />

      <HowItWorks eyebrow="使い方" title="3ステップで準備の一式まで" steps={STEPS} />

      <FaqSection items={FAQ} />

      <CtaBand
        title="展示会の準備を、URLから始めましょう"
        subtitle="ログインすると、すぐに使えます。"
        ctaHref={ctaHref}
        ctaLabel="ログインしてはじめる"
      />
    </LpShell>
  )
}
