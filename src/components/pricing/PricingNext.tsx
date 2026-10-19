'use client'
// ============================================
// 料金ページ（新しい見た目。UI 品質 B-3）
// ============================================
// /pricing で、新しい見た目（src/lib/ui-next.ts）のときだけ使う。今の見た目は UnifiedPricingPlans のまま。
// - プランは 無料 / プロ（¥9,980）の2つ。2枚を同じ高さで並べ、プロにだけ「おすすめ」を付ける
// - プロの中身は、バナーの機能ではなく「全ツールの上限」を比較表で見せる（F-18）
// - よくある質問・導入の流れ・お問い合わせを下に置く（F-19）
// ⚠️ 契約の判定と購入のボタンは UnifiedPricingPlans と同じ（CheckoutButton・UNIFIED_PRO_PLAN_ID・useBillingPlanResync）。
//    金額・プラン ID・トライアルの条件をここに書き足さない（正本は src/lib/unified-plan.ts と TrialCallout）。
// ⚠️ エンタープライズの金額は出さない（売っていない価格を出さない）。
import Link from 'next/link'
import { Check } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { CheckoutButton } from '@/components/CheckoutButton'
import { TrialBadge, TrialNote, useTrialEligible } from '@/components/TrialCallout'
import { ShellIcon } from '@/components/shell/icons'
import { ALL_SHELL_TOOLS, shellGroups } from '@/components/shell/tools'
import ds from '@/components/ds/tokens.module.css'
import { useBillingPlanResync } from '@/hooks/useBillingPlanResync'
import { ENTERPRISE_CONTACT_MAILTO } from '@/lib/pricing'
import { higherPlan } from '@/lib/plan-utils'
import { getPublicServices, type Service } from '@/lib/services'
import { isPaidPlan, UNIFIED_PLAN_COPY, UNIFIED_PRO_PLAN_ID, UNIFIED_PRO_PRICE_LABEL } from '@/lib/unified-plan'
import styles from './PricingNext.module.css'

const RETURN_TO = '/pricing'

/** 比較表の行。左のメニューと同じ区分で並べる（対応が無いツールは「その他」） */
function comparisonGroups(services: Service[]) {
  const byId = new Map(ALL_SHELL_TOOLS.map((t) => [t.id, t]))
  const used = new Set<string>()
  const groups = shellGroups(true).map((g) => {
    const rows = services.filter((s) => byId.get(s.id)?.stage === g.stage)
    rows.forEach((s) => used.add(s.id))
    return { label: g.label, rows }
  })
  const rest = services.filter((s) => !used.has(s.id))
  const other = groups.find((g) => g.label === 'その他')
  if (other) other.rows.push(...rest)
  else if (rest.length) groups.push({ label: 'その他', rows: rest })
  return groups.filter((g) => g.rows.length > 0).map((g) => ({
    ...g,
    rows: g.rows.map((s) => ({ service: s, icon: byId.get(s.id)?.icon ?? 'LayoutGrid' as const })),
  }))
}

export default function PricingNext({ canceled, inShell = false, serverSignedIn, serverPlan }: {
  canceled: boolean
  inShell?: boolean
  /** サーバーで読んだログインの有無とプラン（User.plan）。セッションを読み込む間も、最初から正しいボタンを出すため */
  serverSignedIn?: boolean
  serverPlan?: string | null
}) {
  const trialEligibleRaw = useTrialEligible()
  const { data: session, status: sessionStatus } = useSession()
  // セッションを読み込む間は、サーバーで読んだ値を使う（「プロにアップグレード」が一瞬出てから変わらないように。統括の確認 2026-10-19）
  const authStatus = sessionStatus === 'loading' && serverSignedIn !== undefined
    ? (serverSignedIn ? 'authenticated' : 'unauthenticated')
    : sessionStatus
  // 契約の判定は UnifiedPricingPlans（planSource='account'）と同じ
  const accountPlan = authStatus !== 'authenticated' ? undefined
    : sessionStatus === 'authenticated' ? (session?.user as { plan?: string } | undefined)?.plan : (serverPlan ?? undefined)
  // サーバーの値も無く、セッションを読み込んでいる間は、ボタンの場所に高さだけを取って文言は出さない
  const planPending = authStatus === 'loading'
  // ⚠️ 文字列として比べる（PlanTier に BUNDLE は無いが、User.plan には入りうる。UnifiedPricingPlans と同じ判定）
  const plan: string = accountPlan ? higherPlan(null, accountPlan) : ''
  const isPro = authStatus === 'authenticated' && (plan === 'PRO' || plan === 'BUNDLE' || plan === 'ENTERPRISE')
  const planKnown = Boolean(accountPlan)
  const isFree = authStatus === 'authenticated' && !isPro && plan === 'FREE'
  // ⚠️ すでに有料のプランの人には、トライアルの札・説明・「初月無料」の文言を出さない（統括の確認 2026-10-19）。
  //    /api/stripe/trial-eligibility は Stripe の契約の履歴で決めるため、履歴の無い有料の人にも true を返すことがある。
  //    API と TrialCallout は課金の正本に関わるので変えず、この画面の表示だけで止める（reference/11-billing-spec.md）
  const paid = authStatus === 'authenticated' && isPaidPlan(accountPlan)
  const trialEligible = trialEligibleRaw && !paid
  const { run: resyncPlan, busy: resyncing, disabled: resyncDisabled, message: resyncMessage } = useBillingPlanResync({
    scope: JSON.stringify(['pricing', 'unified', 'account']),
    enabled: planKnown && plan === 'FREE',
    keepBusyOnVerified: true,
    onVerified: () => { window.location.reload() },
  })

  const services = getPublicServices()
  const groups = comparisonGroups(services)

  return (
    <div className={`${ds.ds} ${styles.page}`} data-ui-next="true" data-in-shell={inShell ? 'true' : undefined}>
      <header className={styles.hero}>
        {/* キービジュアル（統括の確認 2026-10-19）。大きさを決めて置き、読み込みで下がずれないようにする */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/renewal/bear-success.webp" alt="" width={160} height={160} className={styles.heroArt} />
        <p className={styles.eyebrow}>料金プラン</p>
        <h1 className={styles.title}>1つの契約で、<wbr />全{services.length}ツールの<wbr />プロ機能を使えます</h1>
        <p className={styles.lead}>プランは無料とプロの2つだけです。ツールごとの契約や組み合わせは要りません。</p>
        <ul className={styles.promises}>
          <li><Check size={16} strokeWidth={2.5} aria-hidden />いつでも解約できます</li>
          <li><Check size={16} strokeWidth={2.5} aria-hidden />追加の課金はありません</li>
        </ul>
      </header>

      {canceled ? <p className={styles.notice} role="status">決済がキャンセルされました。もう一度お試しください。</p> : null}
      {authStatus === 'authenticated' && plan === 'LIGHT' ? (
        <p className={styles.notice} role="status">現在ライトプランをご利用中です。プロプランへの変更は、現在のご契約からお手続きいただけます。</p>
      ) : null}

      <section className={styles.plans} aria-label="プラン">
        <article className={styles.plan}>
          <h2 className={styles.planName}>{UNIFIED_PLAN_COPY.freeName}</h2>
          <p className={styles.planFor}>まず使ってみたい方に</p>
          <p className={styles.price}><span className={styles.priceNum}>¥0</span></p>
          <ul className={styles.planList}>
            <li>全ツールを無料の上限の中で使えます</li>
            <li>上限は下の比較表のとおりです</li>
            <li>カードの登録なしで始められます</li>
          </ul>
          <div className={styles.planAction}>
            {isFree ? <span className={styles.current}>現在のプラン</span>
              : <Link href="/home" className={styles.secondary}>無料ではじめる</Link>}
          </div>
        </article>

        <article className={`${styles.plan} ${styles.planPro}`}>
          <span className={styles.recommend}>おすすめ</span>
          <h2 className={styles.planName}>{UNIFIED_PLAN_COPY.proName}</h2>
          <p className={styles.planFor}>仕事で毎日使う方に</p>
          <p className={styles.price}>
            <span className={styles.priceNum}>{UNIFIED_PRO_PRICE_LABEL}</span>
            <span className={styles.priceUnit}>/ 月（税込）</span>
          </p>
          {/* トライアルの表示は、対象と分かってから出る（TrialCallout）。出たときに下がずれないよう、場所の高さを先に取る。
              対象外（または確かめている間）は、同じ場所に短い文を出す */}
          <div className={styles.trialSlot}>
            {paid ? (
              <p className={styles.trialFallback}>{isPro ? 'ご利用中のプランです。' : 'プロへの変更は、今のご契約から手続きできます。'}</p>
            ) : trialEligible ? (
              <>
                <TrialBadge className={styles.trialBadge} />
                <TrialNote className={styles.trialNote} />
              </>
            ) : (
              <p className={styles.trialFallback}>月額のみ。いつでも解約できます。</p>
            )}
          </div>
          <ul className={styles.planList}>
            <li>全{services.length}ツールのプロ機能を使えます</li>
            <li>各ツールの上限が上がります（下の比較表）</li>
            <li>{UNIFIED_PLAN_COPY.proNote}</li>
          </ul>
          <div className={styles.planAction}>
            {planPending ? <span className={styles.pending} aria-hidden /> : isPro ? <span className={styles.current}>ご利用中のプラン</span> : (
              <CheckoutButton planId={UNIFIED_PRO_PLAN_ID} loginCallbackUrl={RETURN_TO} variant="primary" className={styles.primary}>
                {trialEligible ? '初月無料でプロを試す' : 'プロにアップグレード'}
              </CheckoutButton>
            )}
            <p className={styles.actionNote}>いつでも解約できます・{trialEligible ? '初月無料' : '月額のみ'}・追加の課金なし</p>
          </div>
        </article>
      </section>

      <section className={styles.section} aria-labelledby="compare-title">
        <h2 id="compare-title" className={styles.sectionTitle}>ツールごとの上限</h2>
        <p className={styles.sectionLead}>プロにすると、すべてのツールで右の列の上限になります。</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th scope="col">ツール</th><th scope="col">無料</th><th scope="col">プロ</th></tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.label}>
                <tr className={styles.groupRow}><th scope="rowgroup" colSpan={3}>{g.label}</th></tr>
                {g.rows.map(({ service, icon }) => (
                  <tr key={service.id}>
                    <th scope="row">
                      <Link href={service.href} className={styles.tool}>
                        <span className={styles.toolIcon}><ShellIcon name={icon} size={16} /></span>
                        <span>{service.name}</span>
                      </Link>
                    </th>
                    <td>{service.pricing?.free?.limit || '—'}</td>
                    <td className={styles.proCell}>{service.pricing?.pro?.limit || '—'}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="flow-title">
        <h2 id="flow-title" className={styles.sectionTitle}>使い始めるまで</h2>
        <ol className={styles.flow}>
          <li><span className={styles.step}>1</span><div><p className={styles.flowTitle}>Google アカウントでログイン</p><p>無料プランのまま、全ツールを試せます。</p></div></li>
          <li><span className={styles.step}>2</span><div><p className={styles.flowTitle}>プロを申し込む</p><p>上のボタンから申し込みます。お支払いの手続きは Stripe の画面で行います。</p></div></li>
          <li><span className={styles.step}>3</span><div><p className={styles.flowTitle}>すぐに上限が上がる</p><p>申し込みが終わると、全ツールの上限がプロに変わります。</p></div></li>
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="faq-title">
        <h2 id="faq-title" className={styles.sectionTitle}>よくある質問</h2>
        <div className={styles.faq}>
          <details>
            <summary>ツールごとに契約が必要ですか</summary>
            <p>要りません。プロプランを1つ契約すると、ドヤAIの全ツールでプロの上限になります。</p>
          </details>
          <details>
            <summary>解約はいつでもできますか</summary>
            <p>はい。ご契約中の方は、このページの下の「プラン変更・お支払い方法の変更・解約」から手続きできます。</p>
          </details>
          {trialEligible ? (
            <details>
              <summary>初月無料のあと、どうなりますか</summary>
              <p>無料の期間が終わると、月額 {UNIFIED_PRO_PRICE_LABEL}（税込）のお支払いが始まります。期間中に解約すれば、料金はかかりません。お支払い方法を登録していない場合は、期間が終わると自動で解約されます。</p>
            </details>
          ) : null}
          <details>
            <summary>支払ったのにプランが変わりません</summary>
            <p>ログインした状態で、このページの下の「課金状態を確認してプランを反映する」を押してください。重ねて申し込む必要はありません。</p>
          </details>
          <details>
            <summary>上限をさらに上げたい・チームで使いたい</summary>
            <p>プロプランの範囲を超えるご要望は、個別にうかがいます。下の「お問い合わせ」からご連絡ください。</p>
          </details>
        </div>
      </section>

      {/* ⚠️ 掲載は「30分の取材」と「ロゴ掲載」の両方にご協力いただく条件。片方だけで6ヶ月無料になると読めないよう、文言を削らないこと */}
      <section className={styles.campaign}>
        <div>
          <p className={styles.campaignLabel}>活用事例・ロゴ掲載キャンペーン</p>
          <p className={styles.campaignTitle}>30分の取材とロゴ掲載で、6ヶ月無料。</p>
          <p className={styles.campaignBody}>オンラインで30分ほど活用状況をうかがい、御社のロゴ・サービスロゴを当サイトに掲載させていただける方が対象です。</p>
        </div>
        <Link href="/campaign/case-study" className={styles.secondary}>申し込みフォームへ</Link>
      </section>

      <section className={styles.contact}>
        <div>
          <p className={styles.contactTitle}>さらに機能を広げたい方へ</p>
          <p className={styles.contactBody}>生成上限の引き上げ、チームでのご利用、独自機能の追加など、プロプランの範囲を超えるご要望は個別に承ります。</p>
        </div>
        <a href={ENTERPRISE_CONTACT_MAILTO} className={styles.secondary}>お問い合わせ</a>
      </section>

      <footer className={styles.footer}>
        {planKnown && plan === 'FREE' ? (
          <div className={styles.resync}>
            <button type="button" onClick={resyncPlan} disabled={resyncDisabled} aria-busy={resyncing} className={styles.secondary}>
              {resyncing ? '確認しています…' : '課金状態を確認してプランを反映する'}
            </button>
            <p>お支払い済みなのにプランが切り替わらない場合のみ押してください。重複してお申し込みいただく必要はありません。</p>
            {resyncMessage ? <p role="status">{resyncMessage}</p> : null}
          </div>
        ) : null}
        <a href={`/api/stripe/portal?returnTo=${encodeURIComponent(RETURN_TO)}`} className={styles.portal}>ご契約中の方：プラン変更・お支払い方法の変更・解約はこちら</a>
      </footer>
    </div>
  )
}
