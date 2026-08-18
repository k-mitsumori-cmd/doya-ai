'use client'

// ============================================
// ドヤ見積もりAI ランディングページ
// ============================================
// 未ログインの方に見せる面。ログイン済みはツール画面（page.tsx）へ。
//
// 構成は国内BtoB SaaSのLP15本を調べた最頻の型に合わせている:
//   ヒーロー → 課題 → 機能ショーケース → 手順 → 選ばれる理由 → FAQ → 最終CTA
//
// ⚠️ 導入社数・継続率・No.1 のような数値は**持っていないので書かない**。
//    実LPは例外なく「※調査元＋時点」を併記しており、根拠のない実績表記は
//    景表法上の優良誤認になる。信頼は、事実として言えることだけで作る。
// ⚠️ CTAはヒーローに2個まで（実LP15本すべてで2個が上限）。
//    種類を増やさず、ページ内で同じCTAを繰り返す。
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase,
  HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'
import { QuoteLinesMock, QuoteTaxMock, QuotePdfMock } from './mocks'

const SVC = getServiceById('quote')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'price_check',
    title: '金額の出所が1件ずつ見える',
    desc: '「自社サイトの公開価格 → 相場データ → 根拠なし」の順で決まります。どれに当たるかが明細ごとに表示され、裏付けの無い項目は金額を作らず「要見積」で空欄のまま残します。',
    bullets: ['自社価格・相場・要見積を色分けして表示', '相場は金額の幅で提示（一点の断定をしない）', 'AIが根拠のない数字を作らない'],
    visual: <MockWindow title="見積明細"><QuoteLinesMock /></MockWindow>,
  },
  {
    icon: 'calculate',
    title: '複数税率をまたいでも合う',
    desc: '10%と軽減8%が混ざっても、税率の区分ごとに計算します。値引きは区分に按分され、端数の処理も画面とPDFで揃います。',
    bullets: ['税率区分ごとに小計と消費税を算出', '値引きを区分へ按分', '画面・PDF・保存値がすべて一致'],
    visual: <MockWindow title="税区分の計算"><QuoteTaxMock /></MockWindow>,
  },
  {
    icon: 'picture_as_pdf',
    title: 'そのまま渡せる見積書',
    desc: '日本語フォントを埋め込んだPDFを出力します。社名・住所・担当者・支払条件などの発行者情報を一度設定すれば、以後の見積書すべてに反映されます。',
    bullets: ['日本語対応のPDFを即時出力', '発行者情報は一度設定すれば使い回し', '確定前は「社内確認用」の透かし入り'],
    visual: <MockWindow title="見積書PDF"><QuotePdfMock /></MockWindow>,
  },
]

export default function QuoteLp() {
  return (
    <LpShell serviceName={SVC.name} icon="receipt_long" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤマーケAI"
        title="「概算いくら？」に、"
        highlight="その場で紙を出す。"
        subtitle="サービスURLを入れるだけで、相場つきの見積もり品目が並びます。商談中に単価を調整して、そのまま日本語のPDFへ。"
        note="無料プランで3件までお試しいただけます。クレジットカードの登録は不要です。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/quote/pricing"
        subCtaLabel="料金を見る"
        visual={<MockWindow title="ドヤ見積もりAI"><QuoteLinesMock /></MockWindow>}
      />

      <UseCases
        title="こんな場面のためのものです"
        items={[
          '商談中に「概算いくら？」と聞かれ、持ち帰って後日になってしまう',
          '担当者ごとに見積もりの金額感がバラつき、社内で揃わない',
          '見積書の作成に毎回半日かかり、他の仕事が止まる',
          'Excelの使い回しで、税率や合計の計算ミスが起きる',
        ]}
      />

      <FeatureShowcase
        title="根拠のある金額だけを、速く"
        lead="AIに数字を作らせないことを最優先に設計しています。"
        rows={ROWS}
      />

      <HowItWorks title="3ステップで見積書まで" steps={STEPS} />

      <Benefits title="選ばれる理由" items={BENEFITS} />

      <FaqSection items={FAQ} />

      <CtaBand
        title="次の商談から、その場で出せます"
        subtitle="無料プランで3件まで。プロプランなら月額9,980円で、ドヤシリーズの全サービスが使えます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        note="クレジットカードの登録は不要です"
      />
    </LpShell>
  )
}
