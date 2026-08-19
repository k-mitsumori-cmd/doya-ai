'use client'

// ドヤリスト ランディングページ（未ログインの方に見せる面）
// ⚠️ 構成は国内BtoB SaaS LP15本を調べた最頻の型。
//    実績数値（導入社数・継続率・No.1）は持っていないので書かない。
// ⚠️ ヒーローのCTAは2個まで。
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { DoyalistFilterMock, DoyalistTableMock, DoyalistMessageMock } from './mocks'

const SVC = getServiceById('doyalist')!
const ROWS: ShowcaseRow[] = [
  { icon: 'tune', title: '狙う条件を決める', desc: '業種、地域、規模、キーワードから必要な企業像を指定します。', visual: <MockWindow title="検索条件"><DoyalistFilterMock /></MockWindow> },
  { icon: 'list_alt', title: '出所のある企業情報', desc: '法人情報をもとに候補を整理し、URLがない場合は推測せず明示します。', visual: <MockWindow title="候補企業"><DoyalistTableMock /></MockWindow> },
  { icon: 'mail', title: '企業別の文面まで', desc: 'リストの相手ごとに、メール・フォーム・電話の叩き台を作ります。', visual: <MockWindow title="営業文面"><DoyalistMessageMock /></MockWindow> },
]

export default function DoyalistLp() {
  return (
    <LpShell serviceName={SVC.name} icon="list_alt" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤマーケAI"
        title="営業リストを作って、"
        highlight="送る文面まで。"
        subtitle="条件を決めるだけで法人情報から企業リストを作り、フォーム営業文・メール・電話スクリプトまで用意できます。"
        note="無料プランで月3プロジェクトまでお試しいただけます。クレジットカードの登録は不要です。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/doyalist/pricing"
        subCtaLabel="料金を見る"
        image={{ src: '/doyalist/hero.webp', alt: 'ドヤリストの企業候補一覧画面' }}
        visual={<MockWindow title={SVC.name}><DoyalistTableMock /></MockWindow>}
      />

      <UseCases title="こんな場面のためのものです" items={['新規開拓リストを作るのに毎月時間がかかる', 'フォーム営業の文面を量産したい', '開拓メールの文面を考えるのが負担', '電話スクリプトを毎回考え直している']} />

      <FeatureShowcase title="探すところから、声をかけるところまで" lead="情報の出所を明示し、実行に使える文面までつなぎます。" rows={ROWS} />

      <HowItWorks title="3ステップで使えます" steps={STEPS} />

      <Benefits title="リストで終わらせない" lead="作ったリストの相手に、そのまま送れる文面まで用意します。" items={BENEFITS} />

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
