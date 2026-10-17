'use client'

// ドヤ支出管理 ランディングページ（未ログインの方向け。簡易版）
import { LpShell, ProductHero, FeatureShowcase, Benefits, UseCases, CtaBand, type ShowcaseRow } from '@/components/lp'
import styles from '@/components/expense/tokens.module.css'
import { getServiceById } from '@/lib/services'

const SVC = getServiceById('expense')!
const ACCENT = 'rgb(0, 102, 255)'
const CTA = '/auth/signin?callbackUrl=/expense'

const STEP_ROWS: ShowcaseRow[] = [
  { icon: 'edit_note', title: '1. 契約を登録する', desc: '取引先、金額、支払周期を入力します。業務委託は契約の形も選べます。', bullets: ['SaaS・家賃・広告費なども同じ画面で登録'], image: { src: '/expense/step-1.webp', alt: '契約を登録する画面のイメージ' } },
  { icon: 'event', title: '2. 出金予定が自動で並ぶ', desc: '締め日や支払日、カードの引落日から、お金が出る日を12か月先まで計算します。', bullets: ['源泉所得税の納付予定も自動で追加'], image: { src: '/expense/step-2.webp', alt: '出金予定が月ごとに並ぶ画面のイメージ' } },
  { icon: 'task_alt', title: '3. 請求書と支払を記録する', desc: '請求書の受領から承認、支払済みまでを状態で記録します。請求書待ちや金額の差異は、要対応に表示されます。', bullets: ['人ごとの支払状況を一覧で確認'], image: { src: '/expense/step-3.webp', alt: '請求書の受領と支払を記録する画面のイメージ' } },
]

export default function ExpenseLp() {
  return (
    <div className={styles.root}>
    <LpShell serviceName={SVC.name} icon="account_balance_wallet" ctaHref={CTA} ctaLabel="ログインしてはじめる" accent={ACCENT}>
      <ProductHero
        eyebrow="ドヤAI"
        title="毎月の支払いを、"
        highlight="12か月先まで見える化。"
        subtitle="SaaS、業務委託、家賃などの契約を登録すると、お金が出る日と金額を自動で一覧にします。"
        note="現在開発中のサービスです。"
        ctaHref={CTA}
        ctaLabel="ログインしてはじめる"
        subCtaHref="/expense/pricing"
        subCtaLabel="料金を見る"
        image={{ src: '/expense/hero.webp', alt: '月ごとの出金予定と要対応を表示したドヤ支出管理の画面' }}
      />
      <UseCases
        title="こんな場面のためのものです"
        items={[
          '契約しているSaaSの数と月額の合計を知りたい',
          '業務委託の請求書が届いたかと支払日を、人ごとに確認したい',
          '源泉所得税の納付時期と金額を、忘れずに把握したい',
          '半年先までの出金を見て、資金繰りを考えたい',
        ]}
      />
      <FeatureShowcase title="3ステップで見える化" lead="登録すれば、あとは予定が自動で並びます。" rows={STEP_ROWS} />
      <Benefits
        title="できること"
        items={[
          { icon: 'groups', title: '業務委託を人ごとに管理', desc: '月額固定、時給×稼働、成果物ごと、半年まとめの契約を扱えます。振込先と源泉の有無も人ごとに記録します。' },
          { icon: 'receipt_long', title: '源泉所得税の予定を自動で', desc: '源泉徴収の対象になる報酬から、納付の予定を自動で作成します。' },
          { icon: 'query_stats', title: '月×カテゴリで予測', desc: '見込みの金額と確定した金額を分けて、6か月先または12か月先までの表で確認できます。' },
        ]}
      />
      <CtaBand title="支払いの見落としを、なくす。" subtitle="ログインして、最初の契約を登録しましょう。" ctaHref={CTA} ctaLabel="ログインしてはじめる" />
    </LpShell>
    </div>
  )
}
