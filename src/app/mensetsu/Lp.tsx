'use client'

// ドヤ面接官 ランディングページ（未ログインの方に見せる面）
// ⚠️ 採用の場面で使うサービス。AIが合否を決めるように読める文言にしないこと。
//    出すのは推薦度であり、最終決定は必ず人が行う（仕様 C2）。
// ⚠️ 実績数値（導入社数・削減率など）は持っていないので書かない。
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase,
  HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { MensetsuLiveMock, MensetsuScoreMock, MensetsuGuardMock } from './mocks'
import ServiceDiagram from './diagram'

const SVC = getServiceById('mensetsu')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'schedule',
    title: '日程を合わせなくていい',
    desc: '応募者はお渡ししたURLを開くだけで一次面接を受けられます。日程調整の往復が丸ごと不要になり、応募から面接までの日数が縮みます。',
    bullets: ['ログイン不要・都合のよい時間に受験できる', '有効期限つきのURLを1人ずつ発行', '応募時のメールで本人確認もできる'],
    visual: <MockWindow title="一次面接"><MensetsuLiveMock /></MockWindow>, image: { src: '/mensetsu/shots/1-input.webp', alt: '日程を合わせなくていいの画面' },
  },
  {
    icon: 'balance',
    title: '全員に同じ基準で',
    desc: '構造化面接の方式です。全応募者に同じ主質問・同じ評価基準を当てます。評価軸ごとに点数と、根拠になった発言の引用が残ります。',
    bullets: ['評価軸ごとに1〜5点と発言の引用', '判断できない軸は「情報不足」と明示', '総合は4段階の推薦度（合否ではありません）'],
    visual: <MockWindow title="評価レポート"><MensetsuScoreMock /></MockWindow>, image: { src: '/mensetsu/shots/2-process.webp', alt: '全員に同じ基準での画面' },
  },
  {
    icon: 'gavel',
    title: '聞いてはいけない事を聞かない',
    desc: '本籍・家族・信条・結婚の予定など、選考で尋ねてはいけない事項を、質問を作る時点で除外します。応募者が自発的に話した場合も評価の根拠には使いません。',
    bullets: ['厚生労働省「公正な採用選考の基本」に沿った除外', '質問生成・保存・採点例の登録すべてで検査', '除外した理由も担当者に表示'],
    visual: <MockWindow title="質問のガードレール"><MensetsuGuardMock /></MockWindow>, image: { src: '/mensetsu/shots/3-output.webp', alt: '聞いてはいけない事を聞かないの画面' },
  },
]

export default function MensetsuLp() {
  return (
    <LpShell serviceName={SVC.name} icon="support_agent" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤマーケAI"
        title="一次面接の日程調整を、"
        highlight="まるごと無くす。"
        subtitle="AIが一次面接を実施し、評価軸ごとの点数と根拠の引用まで残します。応募者はURLを開くだけ、都合のよい時間に受けられます。"
        note="無料プランで質問セット1件・面接3件までお試しいただけます。クレジットカードの登録は不要です。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/mensetsu/pricing"
        subCtaLabel="料金を見る"
        image={{ src: '/mensetsu/hero.webp', alt: 'ドヤ面接官の面接進行画面' }}
        visual={<MockWindow title="ドヤ面接官"><MensetsuLiveMock /></MockWindow>}
      />

      <UseCases
        title="こんな場面のためのものです"
        items={[
          '一次面接の日程調整に工数を取られ、母集団が増やせない',
          '面接官によって聞くことが違い、評価がそろわない',
          '面接の記録が残らず、二次面接で同じことを聞いてしまう',
          '選考で尋ねてはいけない質問が出ていないか不安がある',
        ]}
      />

      <FeatureShowcase
        title="速さと、公正さを同時に"
        lead="決めるのは人です。AIは判断材料を揃えるところまでを担います。"
        rows={ROWS}
      />

      <HowItWorks title="3ステップで一次面接まで" steps={STEPS} diagram={<ServiceDiagram steps={STEPS} />}  />

      <Benefits title="選ばれる理由" items={BENEFITS} />

      <FaqSection items={FAQ} />

      <CtaBand
        title="次の募集から、日程調整を無くせます"
        subtitle="無料プランで面接3件まで。プロプランなら月額9,980円で、ドヤシリーズの全サービスが使えます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="クレジットカードの登録は不要です"
      />
    </LpShell>
  )
}
