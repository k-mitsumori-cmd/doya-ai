'use client'

// ドヤペルソナAI ランディングページ（未ログインの方に見せる面）
// ⚠️ 構成は国内BtoB SaaS LP15本を調べた最頻の型。
//    実績数値（導入社数・継続率・No.1）は持っていないので書かない。
// ⚠️ ヒーローのCTAは2個まで。
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { PersonaBriefMock, PersonaProfileMock, PersonaPlanMock } from './mocks'
import ServiceDiagram from './diagram'

const SVC = getServiceById('persona')!
const ROWS: ShowcaseRow[] = [
  { icon: 'inventory_2', title: '商材の条件を入力', desc: '業界・商材・届けたい役割を短く入れれば、検討の起点ができます。', visual: <MockWindow title="商材の条件"><PersonaBriefMock /></MockWindow>, image: { src: '/persona/shots/1-input.webp', alt: '商材の条件を入力の画面' } },
  { icon: 'groups', title: '顧客像を1枚に', desc: '目標、悩み、情報源、判断軸を、チームで確認できる形にまとめます。', visual: <MockWindow title="ペルソナシート"><PersonaProfileMock /></MockWindow>, image: { src: '/persona/shots/2-process.webp', alt: '顧客像を1枚にの画面' } },
  { icon: 'description', title: '施策の指示へ変換', desc: '訴求・導線・懸念・検証項目まで落とし込み、制作の叩き台にできます。', visual: <MockWindow title="施策の要点"><PersonaPlanMock /></MockWindow>, image: { src: '/persona/shots/3-output.webp', alt: '施策の指示へ変換の画面' } },
]

export default function PersonaLp() {
  return (
    <LpShell serviceName={SVC.name} icon="groups" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤマーケAI"
        title="「誰に向けて作るか」を、"
        highlight="30秒で1枚に。"
        subtitle="商材と業界を入れるだけで、年齢・職種・課題・情報収集の仕方まで、施策に使える粒度のペルソナが出ます。"
        note="無料プランで1日5件までお試しいただけます。クレジットカードの登録は不要です。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/persona/pricing"
        subCtaLabel="料金を見る"
        image={{ src: '/persona/hero.webp', alt: 'ドヤペルソナAIのペルソナシート画面' }}
        visual={<MockWindow title={SVC.name}><PersonaProfileMock /></MockWindow>}
      />

      <UseCases title="こんな場面のためのものです" items={['LPの構成案を考えるのに時間がかかる', '制作会社への指示書をまとめきれない', 'コピーの方向性がチーム内で揃わない', 'ターゲット設定が担当者の勘に頼っている']} />

      <FeatureShowcase title="顧客像を、施策で使える形へ" lead="作って終わりではなく、コピーや導線の判断につなげます。" rows={ROWS} />

      <HowItWorks title="3ステップで使えます" steps={STEPS} diagram={<ServiceDiagram steps={STEPS} />}  />

      <Benefits title="叩き台が先にあると、速い" lead="ゼロから考えるより、出てきたものを直す方が早く形になります。" items={BENEFITS} />

      <FaqSection items={FAQ} />

      <CtaBand
        title="まずは無料で試せます"
        subtitle="プロプランなら月額9,980円で、ドヤシリーズの全サービスが使えます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="クレジットカードの登録は不要です"
      />
    </LpShell>
  )
}
