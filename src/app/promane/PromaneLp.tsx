// ============================================
// ドヤプロマネ 公開LP（未ログイン時のみ表示）
// ============================================
// これまで /promane は未ログインだと /auth/signin へリダイレクトしていたため、
// 「ドヤプロマネ」で検索してもクロール対象のページが存在せず、指名検索に出られなかった。
// 未ログインのクローラ／初見ユーザーにはこのLPを返し、ログイン済みはこれまで通りアプリへ入る。
import {
  LpShell, Hero, HowItWorks, Benefits, FeatureGrid, UseCases, FaqSection, CtaBand, LpJsonLd,
  type Step, type Benefit, type Faq,
} from '@/components/lp'
import { getServiceById } from '@/lib/services'

const SVC = getServiceById('promane')!
const ACCENT = '#7c5cff'
const CTA = '/auth/signin?callbackUrl=/promane'

const STEPS: Step[] = [
  { title: 'ワークスペースを作る', desc: 'ログインするとワークスペースが自動で用意されます。メンバーはメールで招待するだけ。', icon: 'workspaces' },
  { title: '案件とタスクを登録', desc: '案件ごとにタスクを切って担当と期日を設定。ガントチャートとカンバンの好きな方で進捗を追えます。', icon: 'view_timeline' },
  { title: '工数を記録して収支を見る', desc: '作業時間を記録すると人件費が自動計算され、売上・原価・利益がリアルタイムで積み上がります。', icon: 'monitoring' },
]

const BENEFITS: Benefit[] = [
  { title: '案件の利益率がその場でわかる', desc: '売上と原価（人件費）を突き合わせて、案件ごとの利益をリアルタイムに表示。赤字案件を月末まで気づかない、をなくします。', icon: 'savings' },
  { title: '進捗の遅れが見た目でわかる', desc: 'ガントチャートで全案件のスケジュールを俯瞰。止まっているタスクと期日超過がひと目で判別できます。', icon: 'event_available' },
  { title: 'Excel管理から卒業できる', desc: '案件一覧・工数表・請求管理がバラバラのExcelに散っている状態を、1つのワークスペースにまとめます。', icon: 'table_view' },
]

const FAQ: Faq[] = [
  { q: '無料で使えますか？', a: `無料プランでは${SVC.pricing.free.limit}ご利用いただけます。プロプラン（月額9,980円）にすると案件数が無制限になり、ドヤマーケAIの他のツールもすべて使えるようになります。` },
  { q: '人件費はどう計算されますか？', a: 'メンバーごとに単価を設定し、記録された作業時間を掛け合わせて自動で算出します。案件の原価としてそのまま収支に反映されます。' },
  { q: 'チームで使えますか？', a: 'はい。ワークスペースにメンバーを招待して、オーナー／管理者／メンバー／ゲストの権限で共同利用できます。' },
  { q: '他のドヤマーケAIのツールと同じアカウントで使えますか？', a: 'はい。1つのアカウントで全ツールを利用でき、プロプランの契約も共通です。' },
]

export function PromaneLp() {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
        faq={FAQ}
        includeSoftwareApp={false}
        serviceId="promane"
      />
      <LpShell serviceName={SVC.name} icon="donut_small" ctaHref={CTA} accent={ACCENT}>
        <Hero
          eyebrow="案件管理 × 収支管理"
          title="案件の進捗と利益を、"
          highlight="ひとつの画面で。"
          subtitle={SVC.longDescription || SVC.description}
          note="無料プランあり／クレジットカード不要ではじめられます"
          ctaHref={CTA}
          ctaLabel="無料ではじめる"
          subCtaHref="/promane/pricing"
          subCtaLabel="料金を見る"
        />
        <HowItWorks title="使い方は3ステップ" lead="はじめての案件を登録するまで、だいたい5分です。" steps={STEPS} />
        <Benefits title="ドヤプロマネで変わること" items={BENEFITS} />
        <FeatureGrid title="主な機能" features={SVC.features} />
        <UseCases items={SVC.useCases || []} />
        <FaqSection items={FAQ} />
        <CtaBand
          title="案件の利益、今月から見えるようにしませんか"
          subtitle="ドヤプロマネは無料ではじめられます。"
          ctaHref={CTA}
          ctaLabel="無料ではじめる"
          note="プロプラン（月額9,980円）ならドヤマーケAIの全ツールが使い放題"
        />
      </LpShell>
    </>
  )
}
