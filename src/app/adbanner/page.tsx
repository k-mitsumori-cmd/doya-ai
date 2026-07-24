'use client'

import { getServiceById } from '@/lib/services'
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand,
  type ShowcaseRow,
} from '@/components/lp'
import { ACCENT, CTA, CTA_SUB, STEPS, BENEFITS, FAQ } from './lp-data'
import { AdBannerGridMock, AdBannerInputMock, AdBannerScoreMock } from './mocks'

const SVC = getServiceById('adbanner')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'link', title: 'URL・ブランドから量産',
    desc: 'サービスURLとブランドカラー、配信媒体を指定するだけ。ロゴをアップロードすれば原寸で正確に合成し、ブランドの見え方を崩しません。',
    bullets: ['URL入力だけで下地を自動取得', 'Meta・Google・LINE・X の媒体別サイズ', 'ロゴは実画像を原寸で合成'],
    visual: <MockWindow title="ブランドから量産"><AdBannerInputMock /></MockWindow>,
  },
  {
    icon: 'auto_awesome', title: '広告特化バナーを一括生成',
    desc: '媒体別サイズで広告に特化したバナーをまとめて生成。見出し・CTAまで含めた完成形を、必要な数だけその場で作れます。',
    bullets: ['媒体別サイズで一括生成', '見出し・CTAまで自動で構成', '外注や制作待ちなしで即量産'],
    visual: <MockWindow title="doya-ai.surisuta.jp/adbanner"><AdBannerGridMock /></MockWindow>,
  },
  {
    icon: 'rate_review', title: 'AIが自動採点',
    desc: '視認性・訴求・CTA・媒体適合・ブランド整合の5観点をAIが100点満点で採点。感覚ではなく基準で改善点を可視化します。',
    bullets: ['5観点でスコアを可視化', '具体的な改善提案を提示', '当てずっぽうを減らせる'],
    visual: <MockWindow title="AI採点"><AdBannerScoreMock /></MockWindow>,
  },
  {
    icon: 'refresh', title: 'ワンクリック再生成',
    desc: '採点の改善提案を1クリックで反映して作り直し。採点→改善→再生成を回し続け、成果の出るクリエイティブに近づけます。',
    bullets: ['提案を1クリックで反映', 'キャンペーン単位で管理', '作って終わりにしない運用型'],
    visual: <MockWindow title="AI採点"><AdBannerScoreMock /></MockWindow>,
  },
]

export default function AdBannerLanding() {
  return (
    <LpShell serviceName="ドヤ広告バナーAI" icon="campaign" ctaHref={CTA} ctaLabel="無料で作る" accent={ACCENT}>
      <ProductHero
        eyebrow="広告バナーAI"
        title="広告バナー、"
        highlight="量産して改善。"
        subtitle="URL・ブランドから広告特化バナーを一括生成 → AIが採点 → 直して再生成。成果の出るクリエイティブを作り続けられます。"
        note="ログイン不要でお試し（ゲスト3枚/日）"
        ctaHref={CTA}
        ctaLabel="無料でバナーを作る"
        subCtaHref={CTA_SUB}
        subCtaLabel="ダッシュボードを見る"
        visual={<MockWindow title="doya-ai.surisuta.jp/adbanner"><AdBannerGridMock /></MockWindow>}
      />
      <HowItWorks
        title={<>URLを入れるだけの<br className="md:hidden" />3ステップ</>}
        lead="広告クリエイティブの制作と改善を、そのまま自動化します。"
        steps={STEPS}
      />
      <FeatureShowcase title="現場で使う機能を、そのまま見せます。" lead="広告バナーの量産と改善に必要な機能を、ひとつの画面に。" rows={ROWS} />
      <Benefits title="なぜ、成果が変わるのか" items={BENEFITS} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>次の広告、<br className="md:hidden" />ドヤって当てにいく。</>}
        subtitle="URLを入れるだけ。今日から広告バナーの量産が変わります。"
        ctaHref={CTA}
        ctaLabel="無料でバナーを作る"
        note="ログイン不要でお試し（ゲスト3枚/日）。無料プランは1日9枚まで。"
      />
    </LpShell>
  )
}
