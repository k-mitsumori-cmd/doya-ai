'use client'

// ドヤ収入管理 ランディングページ（未ログインの方に見せる面）
// ⚠️ 実績数値は持っていないので書かない。画像は Codex の定額枠で作成（docs/design/images/income/PROMPTS.md）。
import {
  LpShell, ProductHero, FeatureShowcase,
  HowItWorks, Benefits, UseCases, FaqSection, CtaBand, type ShowcaseRow,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from './lp-data'

const SVC = getServiceById('income')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'event_repeat',
    title: '契約から、毎月の売上予定を自動で作る',
    desc: '月額・四半期・年額、前払い・後払い、月の途中からの日割りにも対応。自動更新の契約は、先の月の予定も作ります。',
    bullets: ['請求予定日を過ぎた未請求の月を「請求漏れ」として表示', '請求しない月は、理由を残して外せます', '契約を変えると、未請求の月の予定だけ作り直されます'],
    image: { src: '/income/step-1.webp', alt: '契約書と月ごとのカレンダー。契約から月々の売上予定ができる様子' },
  },
  {
    icon: 'receipt_long',
    title: '請求書を、取引先ごとにまとめて作る',
    desc: '月次の一覧で請求する月を選ぶと、取引先ごとに請求書（適格請求書）の下書きができます。確定すると番号が付き、編集できなくなります。',
    bullets: ['登録番号・税率ごとの内訳を記載', '確定後に直すときは、取消してから作り直します', '印刷・PDF保存に対応'],
    image: { src: '/income/step-2.webp', alt: '毎月の請求書がまとめて作られる様子' },
  },
  {
    icon: 'account_balance',
    title: '入金を登録すると、どの請求書の入金か候補が出る',
    desc: '入金額と振込名義から照合の候補を出します。一部入金・2か月分まとめての入金・振込手数料の差引にも対応します。',
    bullets: ['金額と振込名義が一致する候補を最上位に表示', '支払期日を過ぎた未入金は「入金遅延」として表示', '督促メールの文面の下書きは、今後追加する予定です'],
    image: { src: '/income/step-3.webp', alt: '振込が届き、請求書に消込のチェックが付く様子' },
  },
]

export default function IncomeLp() {
  return (
    <LpShell serviceName={SVC.name} icon="payments" ctaHref={CTA} ctaLabel="無料ではじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤAI"
        title="契約を入れるだけで、"
        highlight="請求漏れに気づける。"
        subtitle="B2Bの「契約 → 毎月の売上 → 請求書 → 入金」をまとめて管理します。請求の出し忘れと入金の確認漏れに、ダッシュボードで気づけます。"
        note="開発中のため、現在は無料でお使いいただけます。"
        ctaHref={CTA}
        ctaLabel="無料ではじめる"
        subCtaHref="/income/pricing"
        subCtaLabel="料金を見る"
        image={{ src: '/income/hero.webp', alt: '収入管理のダッシュボードと、請求書を持つドヤAIのシロクマ' }}
      />

      <UseCases title="こんな場面のためのものです" items={SVC.useCases ?? []} />

      <FeatureShowcase title="契約から入金まで、1つのツールで" lead="売上予定・請求書・入金を同じデータでつなぎます。" rows={ROWS} />

      <HowItWorks title="使いはじめるまでの3ステップ" steps={STEPS} />

      <Benefits title="主な特長" items={BENEFITS} />

      <FaqSection items={FAQ} />

      <CtaBand title="請求の出し忘れに気づけます" subtitle="契約を登録するだけで、毎月の売上予定ができます。" ctaHref={CTA} ctaLabel="無料ではじめる" />
    </LpShell>
  )
}
