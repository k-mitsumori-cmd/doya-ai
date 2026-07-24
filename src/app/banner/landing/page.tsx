'use client'

import { useSession } from 'next-auth/react'
import { getServiceById } from '@/lib/services'
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand,
  type ShowcaseRow,
} from '@/components/lp'
import { ACCENT, STEPS, BENEFITS, FAQ } from './lp-data'
import { BannerVariantsMock, BannerTemplatesMock, BannerSizesMock } from './mocks'

const SVC = getServiceById('banner')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'category', title: '業種テンプレートから選ぶだけ',
    desc: '通信・EC・採用・美容など、業界別テンプレートを用意。ブランドカラーとサービス内容を入れれば、AIが訴求のトーンまで合わせます。',
    bullets: ['10種類の業界テンプレート', 'ブランドカラーを反映', 'デザイン知識は不要'],
    visual: <MockWindow title="テンプレート選択"><BannerTemplatesMock /></MockWindow>,
  },
  {
    icon: 'auto_awesome', title: 'A/B/C 3案を同時に生成',
    desc: '訴求の異なる3案をAIが一度に提案。並べて見比べ、気に入った案をそのまま書き出せます。A/Bテストのたたき台が数分で揃います。',
    bullets: ['1回の生成で3案', '訴求パターンを比較', 'A/Bテストにそのまま活用'],
    visual: <MockWindow title="doya-ai.surisuta.jp/banner"><BannerVariantsMock /></MockWindow>,
  },
  {
    icon: 'aspect_ratio', title: 'サイズプリセット＆書き出し',
    desc: '正方形・横長・縦長・ストーリーなど媒体別サイズに対応。選んだ案を高品質PNGでワンクリック書き出し。そのまま広告に使えます。',
    bullets: ['6種類のサイズプリセット', 'SNS広告の主要サイズを網羅', '高品質PNGで書き出し'],
    visual: <MockWindow title="書き出し"><BannerSizesMock /></MockWindow>,
  },
]

export default function BannerLandingPage() {
  const { data: session } = useSession()
  // ログイン済みはツール本体(/banner)へ、未ログインはログイン経由で /banner へ
  const cta = session ? '/banner' : '/auth/signin?callbackUrl=/banner'

  return (
    <LpShell serviceName="ドヤバナーAI" icon="image" ctaHref={cta} ctaLabel="無料で作る" accent={ACCENT}>
      <ProductHero
        eyebrow="バナー生成AI"
        title="プロ品質のバナーを、"
        highlight="AIで自動生成。"
        subtitle="業種を選んでAIにおまかせ。A/B/Cの3案を数分で。デザイン知識がなくても、効果的な広告バナーが作れます。"
        note="無料プランで月15枚まで・ゲストも1日1回お試し可"
        ctaHref={cta}
        ctaLabel="無料で作る"
        visual={<MockWindow title="doya-ai.surisuta.jp/banner"><BannerVariantsMock /></MockWindow>}
      />
      <HowItWorks title={<>選ぶ・生成・書き出しの<br className="md:hidden" />3ステップ</>} lead="テンプレートを選んでAIにまかせるだけ。" steps={STEPS} />
      <FeatureShowcase title="広告バナーづくりを、そのまま見せます。" lead="業種選びからA/B/C 3案生成、書き出しまで。必要な機能をひとつの画面に。" rows={ROWS} />
      <Benefits title="なぜ、バナーづくりが速くなるのか" items={BENEFITS} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>最初のバナー、<br className="md:hidden" />いま作ってみる。</>}
        subtitle="業種を選ぶだけ。3案が数分で仕上がります。"
        ctaHref={cta}
        ctaLabel="無料で作る"
        note="無料プランで月15枚まで"
      />
    </LpShell>
  )
}
