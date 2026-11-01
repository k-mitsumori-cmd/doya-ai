'use client'
// ============================================
// 新しい料金ページ（組織単位・ドヤパワー。2026-10-25 案）
// ============================================
// 旗 NEW_PRICING_ROLLOUT（src/lib/pricing-v2/rollout.ts）が on の人にだけ出す。off なら /pricing は PricingNext のまま。
// - 金額・付与のポイント・人数の段階は src/lib/pricing-v2/plans.ts だけから読む。ここに数を書かない
// - 減る量は src/lib/doya-power/costs.ts だけから読む
// - 今の契約者（据え置き）には、今のプランを出し、新しい料金の申し込みボタンは出さない（view='legacy'）
// - 「初月無料」は TrialCallout の部品だけで出す（月払いで、まだ有料でない人だけ）
// 見た目は PricingNext と同じ（PricingNext.module.css を使い、足りない所だけ PricingV2.module.css）。
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Minus, Plus } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { TrialNote, useTrialEligible } from '@/components/TrialCallout'
import ds from '@/components/ds/tokens.module.css'
import { BillingResponseError, billingRedirectUrl, readBillingResponse } from '@/lib/billing-response-client'
import { DOYA_POWER_COSTS, whatYouCanDo, type DoyaPowerAction } from '@/lib/doya-power/costs'
import { ENTERPRISE_CONTACT_MAILTO } from '@/lib/pricing'
import { getListedServiceCount } from '@/lib/services'
import {
  ENTERPRISE_MIN_SEATS, FREE_MAX_MEMBERS, TEAM_TRIAL_DAYS, LEGACY_PRO_PRICE_TAX_INCLUDED, PLAN_COPY, POWER_PACK, TEAM_BASE_MONTHLY,
  TEAM_MONTHLY_POINTS_BASE, TEAM_MONTHLY_POINTS_PER_SEAT, TEAM_SEAT_TIERS, YEARLY_FREE_MONTHS, seatBreakdown,
  teamMonthly, teamMonthlyPoints, teamPrice, withTax, type BillingInterval,
} from '@/lib/pricing-v2/plans'
import { DAILY_RECOVERY_AMOUNT, DAILY_RECOVERY_CAP, PURCHASE_MAX_MONTHS } from '@/lib/doya-power/rules'
import type { PricingView } from '@/lib/pricing-v2/view'
import { BillingSummary, PowerPackBuy, PowerPackReturn, TeamManage } from './TeamManage'
import base from './PricingNext.module.css'
import styles from './PricingV2.module.css'

const RETURN_TO = '/pricing'
const TEAM_PLAN_ID = 'team-pro'
const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`

/** 減る量の表に出す言い方（操作の名前 → 画面の言葉）。数は costs.ts から読む */
const COST_LABELS: Partial<Record<DoyaPowerAction, string>> = {
  'text.generate': '文章の生成（1回）',
  'banner.generate': 'バナー（1回で3枚）',
  'image.refine': '画像の修正（1枚）',
  'transcribe.hour': '文字起こし（60分）',
  'interview.article': 'インタビューの記事化（1本）',
  'slide.generate': 'スライド（1本）',
  'seo.article': 'SEO記事（1万字・1本）',
  'persona.generate': 'ペルソナ（1件）',
  'voice.minute': 'AI商談・AI面接（1分）',
  'aio.scan.question': 'AI検索の調査（質問1件）',
}

const SEAT_STOPS = [1, 3, 5, 10, 20, 30]

export default function PricingV2({ view, canceled, inShell = false, serverSignedIn, canBuyPack = false, powerPackSessionId = null, powerPackCanceled = false }: {
  view: Exclude<PricingView, 'current'>
  canceled: boolean
  inShell?: boolean
  serverSignedIn: boolean
  /** 追加購入を出すか（サーバーが決める: 価格の設定とドヤパワーの台帳の旗。買えるかの最終の判定は API） */
  canBuyPack?: boolean
  /** 追加購入の決済から戻ったとき（/pricing?power_pack=done&cs=...） */
  powerPackSessionId?: string | null
  powerPackCanceled?: boolean
}) {
  const [interval, setBilling] = useState<BillingInterval>('monthly')
  const [seats, setSeats] = useState(5)
  const trialEligibleRaw = useTrialEligible()
  const toolCount = getListedServiceCount()
  const enterprise = seats >= ENTERPRISE_MIN_SEATS
  const price = enterprise ? null : teamPrice(seats, interval)
  const monthly = enterprise ? null : teamMonthly(seats)
  const points = enterprise ? null : teamMonthlyPoints(seats)
  const lines = useMemo(() => seatBreakdown(seats), [seats])
  const canDo = points ? whatYouCanDo(points).slice(0, 3) : []
  // 有料の人（据え置き・チーム）には、トライアルの文言を出さない（PricingNext と同じ決まり）
  // チームの初月無料は TEAM_TRIAL_DAYS（既定 0 ＝ 付けない）。付けないときは「初月無料」を出さない
  const trialEligible = TEAM_TRIAL_DAYS > 0 && trialEligibleRaw && view === 'new' && interval === 'monthly'
  const clampSeats = (n: number) => Math.max(1, Math.min(ENTERPRISE_MIN_SEATS, Math.round(n) || 1))
  const costs = (Object.keys(COST_LABELS) as DoyaPowerAction[]).map((a) => ({ label: COST_LABELS[a]!, amount: DOYA_POWER_COSTS[a] }))

  return (
    <div className={`${ds.ds} ${base.page} ${styles.root}`} data-ui-next="true" data-in-shell={inShell ? 'true' : undefined}>
      <header className={`${base.hero} ${styles.hero}`}>
        {/* キービジュアル。大きさを決めて置き、読み込みで下がずれないようにする */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/character/point-512.webp" alt="" width={160} height={160} className={base.heroArt} />
        <p className={base.eyebrow}>料金プラン</p>
        <h1 className={base.title}>会社のみんなで、<wbr /><span className={styles.nowrap}>全{toolCount}ツールを</span><wbr />使えます</h1>
        <p className={base.lead}>料金は会社ごとです。基本料に、使う人数の分を足します。AIで作る分は「ドヤパワー」で数えます。</p>
        <ul className={base.promises}>
          <li><Check size={16} strokeWidth={2.5} aria-hidden />{FREE_MAX_MEMBERS}人までは無料</li>
          <li><Check size={16} strokeWidth={2.5} aria-hidden />年払いは{YEARLY_FREE_MONTHS}か月分おトク</li>
          <li><Check size={16} strokeWidth={2.5} aria-hidden />失敗した生成は数えません</li>
        </ul>
      </header>

      {canceled ? <p className={base.notice} role="status">決済がキャンセルされました。もう一度お試しください。</p> : null}
      <PowerPackReturn sessionId={powerPackSessionId} canceled={powerPackCanceled} />

      {view === 'legacy' ? (
        <section id="legacy" className={styles.legacy} aria-labelledby="legacy-title">
          <p id="legacy-title" className={styles.legacyTitle}>今のご契約は、<wbr />今の料金のまま<wbr />変わりません</p>
          <p className={styles.legacyBody}>
            {`プロプラン（月${yen(LEGACY_PRO_PRICE_TAX_INCLUDED)}・税込）を、これからも同じ料金でお使いいただけます。新しい料金に切り替える手続きは要りません。`}
          </p>
          <p className={styles.legacyBody}>
            {`会社のメンバーで使いたいときは、チームに移ることもできます。ただし、チームに移ったあとは、今の料金（月${yen(LEGACY_PRO_PRICE_TAX_INCLUDED)}・税込）に戻すことはできません。まずはご相談ください。`}
          </p>
          <a href={ENTERPRISE_CONTACT_MAILTO} className={styles.legacyLink}>チームに移る相談をする</a>
        </section>
      ) : null}

      <div className={styles.toggleRow}>
        <div className={styles.toggle} role="radiogroup" aria-label="支払いの間隔">
          {(['monthly', 'yearly'] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={interval === v} className={styles.toggleItem}
              data-active={interval === v ? 'true' : undefined} onClick={() => setBilling(v)}>
              {v === 'monthly' ? '月払い' : <>年払い<span className={styles.toggleSave}>{YEARLY_FREE_MONTHS}か月分おトク</span></>}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.plans} aria-label="プラン">
        <article className={base.plan}>
          <h2 className={base.planName}>{PLAN_COPY.free.name}</h2>
          <p className={base.planFor}>{FREE_MAX_MEMBERS}人までの会社に</p>
          <p className={base.price}><span className={base.priceNum}>¥0</span></p>
          <ul className={base.planList}>
            <li>{PLAN_COPY.free.lead}</li>
            <li>ドヤパワーが毎日{DAILY_RECOVERY_AMOUNT}ずつ回復します（たまる上限は{DAILY_RECOVERY_CAP}）</li>
            <li>カードの登録なしで始められます</li>
          </ul>
          <div className={base.planAction}>
            <Link href="/home" className={base.secondary}>無料ではじめる</Link>
          </div>
        </article>

        <article id="team" className={`${base.plan} ${base.planPro} ${styles.team}`}>
          <span className={base.recommend}>おすすめ</span>
          <h2 className={base.planName}>{PLAN_COPY.team.name}</h2>
          <p className={base.planFor}>会社で毎日使う方に</p>

          <div className={styles.seatBox}>
            <label htmlFor="seats" className={styles.seatLabel}>使う人数</label>
            <div className={styles.stepper}>
              <button type="button" className={styles.stepBtn} aria-label="1人減らす" onClick={() => setSeats((s) => clampSeats(s - 1))} disabled={seats <= 1}><Minus size={18} /></button>
              <span className={styles.seatValue} aria-live="polite">
                <input id="seats" type="number" inputMode="numeric" min={1} max={ENTERPRISE_MIN_SEATS} value={seats}
                  onChange={(e) => setSeats(clampSeats(Number(e.target.value)))} className={styles.seatInput} />
                <span>{enterprise ? '人以上' : '人'}</span>
              </span>
              <button type="button" className={styles.stepBtn} aria-label="1人増やす" onClick={() => setSeats((s) => clampSeats(s + 1))} disabled={enterprise}><Plus size={18} /></button>
            </div>
            <input type="range" min={1} max={ENTERPRISE_MIN_SEATS} value={seats} onChange={(e) => setSeats(clampSeats(Number(e.target.value)))}
              className={styles.range} aria-label="使う人数（スライダー）" />
            <div className={styles.stops}>
              {SEAT_STOPS.map((n) => (
                <button key={n} type="button" className={styles.stop} data-active={seats === n ? 'true' : undefined} onClick={() => setSeats(n)}>{n}人</button>
              ))}
            </div>
          </div>

          <p className={`${base.price} ${styles.teamPrice}`}>
            {price !== null ? (
              <>
                <span className={base.priceNum}>{yen(price)}</span>
                <span className={base.priceUnit}>/ {interval === 'yearly' ? '年' : '月'}（税抜）</span>
              </>
            ) : <span className={styles.quote}>個別にお見積りします</span>}
          </p>
          <p className={`${styles.priceSub} ${styles.teamPriceSub}`}>
            {price !== null && monthly !== null
              ? <>税込 {yen(withTax(price))}・1人あたり月 {yen(Math.round((interval === 'yearly' ? price / 12 : monthly) / seats))}{interval === 'yearly' ? `・月払いより ${yen(monthly * YEARLY_FREE_MONTHS)} おトク` : ''}</>
              : `${ENTERPRISE_MIN_SEATS}人以上の会社は、人数と使い方に合わせてお見積りします。`}
          </p>

          {!enterprise ? (
            <dl className={styles.breakdown}>
              <div><dt>基本料</dt><dd>{yen(TEAM_BASE_MONTHLY)}</dd></div>
              {lines.map((l) => (
                <div key={l.from}><dt>{l.from === l.to ? `${l.from}人目` : `${l.from}〜${l.to}人目`}（{yen(l.unitMonthly)} × {l.seats}人）</dt><dd>{yen(l.subtotalMonthly)}</dd></div>
              ))}
              <div className={styles.breakdownNote}><dt>上の内訳は月額（税抜）です</dt><dd /></div>
            </dl>
          ) : null}

          {points !== null ? (
            <div className={styles.power}>
              <p className={styles.powerHead}>毎月のドヤパワー<span className={styles.powerNum}>{points.toLocaleString('ja-JP')}</span></p>
              <p className={styles.powerSub}>{canDo.map((c) => `${c.label} ${c.count.toLocaleString('ja-JP')}${c.unit}`).join('・')} ぶん</p>
            </div>
          ) : <div className={styles.power} aria-hidden />}

          <div className={`${base.trialSlot} ${styles.teamTrial}`}>
            {view === 'legacy' ? <p className={base.trialFallback}>今のご契約の方は、今の料金のままです。</p>
              : view === 'team' ? <p className={base.trialFallback}>ご利用中のプランです。</p>
              : trialEligible ? <TrialNote className={base.trialNote} />
              : <p className={base.trialFallback}>いつでも解約できます。人数は途中で増やせます。</p>}
          </div>

          <ul className={base.planList}>
            <li>全{toolCount}ツールのプロ機能を、会社のみんなで使えます</li>
            <li>使い残したドヤパワーは、翌月まで繰り越せます</li>
            <li>11人目からは1人 {yen(TEAM_SEAT_TIERS[1]!.unitMonthly)} に下がります</li>
          </ul>
          <div className={`${base.planAction} ${styles.teamAction}`}>
            {view === 'legacy' ? <span className={base.current}>今のご契約のままお使いください</span>
              : view === 'team' ? <span className={base.current}>ご利用中のプラン</span>
              : enterprise ? <a href={ENTERPRISE_CONTACT_MAILTO} className={base.primary}>見積りを相談する</a>
              : <TeamCheckoutButton seats={seats} interval={interval} serverSignedIn={serverSignedIn} trialEligible={trialEligible} />}
          </div>
        </article>

        <article className={base.plan}>
          <h2 className={base.planName}>{PLAN_COPY.enterprise.name}</h2>
          <p className={base.planFor}>{ENTERPRISE_MIN_SEATS}人以上の会社に</p>
          <p className={base.price}><span className={styles.quote}>お見積り</span></p>
          <ul className={base.planList}>
            <li>{PLAN_COPY.enterprise.lead}</li>
            <li>ドヤパワーの量を、使い方に合わせて決めます</li>
            <li>年契約・請求書払い（銀行振込）に対応します</li>
          </ul>
          <div className={base.planAction}>
            <a href={ENTERPRISE_CONTACT_MAILTO} className={base.secondary}>お問い合わせ</a>
          </div>
        </article>
      </section>

      {view === 'team' ? <TeamManage /> : null}
      {view === 'team' || view === 'legacy' ? <BillingSummary /> : null}
      {canBuyPack && (view === 'team' || view === 'legacy') ? <PowerPackBuy /> : null}

      <section className={base.section} aria-labelledby="power-title">
        <h2 id="power-title" className={base.sectionTitle}>ドヤパワーとは</h2>
        <p className={base.sectionLead}>
          {`AIで作るときに使うポイントです。チームは毎月 ${TEAM_MONTHLY_POINTS_BASE.toLocaleString('ja-JP')} ＋ 1人 ${TEAM_MONTHLY_POINTS_PER_SEAT} が付きます。勤怠・プロジェクト管理・収入・支出など、AIを使わない操作では減りません。`}
        </p>
        <div className={styles.powerGrid}>
          <ul className={styles.costList} aria-label="1回で減る量">
            {costs.map((c) => (
              <li key={c.label}><span>{c.label}</span><span className={styles.costNum}>{c.amount}</span></li>
            ))}
          </ul>
          <ul className={styles.rules}>
            <li><p className={styles.ruleTitle}>失敗したときは減りません</p><p>生成に失敗したら、使った分を自動で戻します。</p></li>
            <li><p className={styles.ruleTitle}>使い残しは翌月まで</p><p>毎月の分のうち使わなかった分は、翌月の終わりまで使えます。</p></li>
            <li><p className={styles.ruleTitle}>足りないときは追加できます</p><p>{POWER_PACK.points.toLocaleString('ja-JP')}ごとに {yen(POWER_PACK.price)}（税抜）。買った分は{PURCHASE_MAX_MONTHS}か月使えます。</p></li>
          </ul>
        </div>
      </section>

      <section className={base.section} aria-labelledby="faq-title">
        <h2 id="faq-title" className={base.sectionTitle}>よくある質問</h2>
        <div className={base.faq}>
          <details>
            <summary>今プロプランを契約しています。料金は変わりますか</summary>
            <p>変わりません。今のご契約（月{yen(LEGACY_PRO_PRICE_TAX_INCLUDED)}・税込）は、そのままの料金でお使いいただけます。新しい料金は、これから新しく契約する方が対象です。</p>
          </details>
          <details>
            <summary>人数はどう数えますか</summary>
            <p>ドヤAIを使う会社のメンバーの人数です。申し込みのときに人数を選び、あとから増やせます。増やした分は、その月の残りの日数で計算します。</p>
          </details>
          <details>
            <summary>{FREE_MAX_MEMBERS}人以下の会社でもチームを申し込めますか</summary>
            <p>はい、1人から申し込めます。フリーでドヤパワーが足りなくなったら、チームにすると毎月まとまった量が付きます。</p>
          </details>
          <details>
            <summary>請求書払いはできますか</summary>
            <p>{ENTERPRISE_MIN_SEATS}人以上の個別見積と年払いでは、請求書払い（銀行振込）に対応します。それ以外はカードでのお支払いです。</p>
          </details>
          <details>
            <summary>解約はいつでもできますか</summary>
            <p>はい。契約の管理画面から手続きできます。月払いはその月の終わりまで、年払いはその年の終わりまで使えます。</p>
          </details>
        </div>
      </section>

      <section className={base.contact}>
        <div>
          <p className={base.contactTitle}>人数が多い・使い方を相談したい方へ</p>
          <p className={base.contactBody}>{ENTERPRISE_MIN_SEATS}人以上のご利用、請求書払い、ドヤパワーの量のご相談は、個別に承ります。</p>
        </div>
        <a href={ENTERPRISE_CONTACT_MAILTO} className={base.secondary}>お問い合わせ</a>
      </section>

      <footer className={base.footer}>
        <a href={`/api/stripe/portal?returnTo=${encodeURIComponent(RETURN_TO)}`} className={base.portal}>ご契約中の方：お支払い方法の変更・解約はこちら</a>
      </footer>
    </div>
  )
}

/** チームの申し込み。サーバー（/api/stripe/checkout）が旗・据え置き・二重契約を確かめてから、Stripe の画面を作る */
function TeamCheckoutButton({ seats, interval, serverSignedIn, trialEligible }: {
  seats: number
  interval: BillingInterval
  serverSignedIn: boolean
  trialEligible: boolean
}) {
  const { status } = useSession()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const messageId = useId()
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  const signedIn = status === 'authenticated' || (status === 'loading' && serverSignedIn)

  const start = async () => {
    if (busy || active.current) return
    if (!signedIn) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(RETURN_TO)}`)
      return
    }
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setMessage(null)
    let navigating = false
    try {
      const res = await readBillingResponse('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: TEAM_PLAN_ID, billingPeriod: interval, seats, returnTo: RETURN_TO, serviceId: 'pricing' }),
      }, controller.signal)
      const url = billingRedirectUrl(res.data.url)
      if (res.ok && url && typeof res.data.sessionId === 'string') {
        window.location.href = url
        navigating = true
        return
      }
      // サーバーの文言（据え置き・二重契約・人数など）をそのまま出す。分からないときは、申し込みを繰り返さないよう案内する
      setMessage(typeof res.data.error === 'string' ? res.data.error : '決済画面を開けたか確認できませんでした。新しいお申し込みを繰り返さず、契約状況をご確認ください。')
    } catch (e) {
      if (e instanceof BillingResponseError && e.cancelled) return
      setMessage('決済画面を開けたか確認できませんでした。新しいお申し込みを繰り返さず、契約状況をご確認ください。')
    } finally {
      if (!navigating) {
        active.current = null
        setBusy(false)
      }
    }
  }

  return (
    <>
      <button type="button" className={base.primary} onClick={start} disabled={busy} aria-busy={busy} aria-describedby={message ? messageId : undefined}>
        {busy ? '決済画面を準備しています…' : trialEligible ? 'チームを初月無料で試す' : 'チームを申し込む'}
      </button>
      {message ? <p id={messageId} role="alert" className={styles.error}>{message}</p> : null}
      <p className={base.actionNote}>いつでも解約できます・人数はあとから増やせます</p>
    </>
  )
}
