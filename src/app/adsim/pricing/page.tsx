'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Check, X, Sparkles } from 'lucide-react'
import { CheckoutButton } from '@/components/CheckoutButton'

interface Feature {
  text: string
  ok: boolean
}

interface Plan {
  id: 'free' | 'light' | 'pro' | 'enterprise'
  planId?: string // CheckoutButton 用 (free/enterprise は無し)
  name: string
  price: string
  period: string
  badge: string
  description: string
  features: Feature[]
  cta: string
  highlight: boolean
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '¥0',
    period: '/月',
    badge: '無料',
    description: 'まずはお試しで使いたい方向け',
    features: [
      { text: '広告提案 月3プロジェクトまで', ok: true },
      { text: 'AI 数値シミュレーション', ok: true },
      { text: '提案文10セクション 自動生成', ok: true },
      { text: 'PDF 出力（ウォーターマーク付き）', ok: true },
      { text: 'NanoBanana バナー生成 月3回まで（9枚）', ok: true },
      { text: 'バナー画像のダウンロード', ok: false },
      { text: 'チャットで数値編集 月20回まで', ok: true },
      { text: 'PPTX / Excel 出力', ok: false },
    ],
    cta: '無料で始める',
    highlight: false,
  },
  {
    id: 'light',
    planId: 'adsim-light',
    name: 'Light',
    price: '¥2,980',
    period: '/月',
    badge: 'ライト',
    description: '個人運用者・小規模代理店向け',
    features: [
      { text: '広告提案 月15プロジェクトまで', ok: true },
      { text: 'AI 数値シミュレーション', ok: true },
      { text: '提案文10セクション 自動生成', ok: true },
      { text: 'PDF / PPTX / Excel 全形式出力', ok: true },
      { text: 'NanoBanana バナー生成 月10回まで（30枚）', ok: true },
      { text: 'バナー画像 ダウンロード可', ok: true },
      { text: 'チャットで数値編集 月100回まで', ok: true },
      { text: 'ロゴ差し替え', ok: true },
    ],
    cta: 'ライトプランを選ぶ',
    highlight: false,
  },
  {
    id: 'pro',
    planId: 'adsim-pro',
    name: 'Pro',
    price: '¥9,980',
    period: '/月',
    badge: 'プロ',
    description: '本格運用したい代理店・運用者向け',
    features: [
      { text: '広告提案 月100プロジェクトまで', ok: true },
      { text: 'AI 数値シミュレーション', ok: true },
      { text: '提案文10セクション 自動生成', ok: true },
      { text: 'PDF / PPTX / Excel 全形式出力', ok: true },
      { text: 'NanoBanana バナー生成 月30回まで（90枚）', ok: true },
      { text: 'バナー画像 ダウンロード可', ok: true },
      { text: 'チャットで数値編集 月500回まで', ok: true },
      { text: '優先サポート', ok: true },
    ],
    cta: 'プロプランを選ぶ',
    highlight: true,
  },
  {
    id: 'enterprise',
    planId: 'adsim-enterprise',
    name: 'Enterprise',
    price: '¥49,800',
    period: '/月',
    badge: 'エンプラ',
    description: '法人・チーム利用向け',
    features: [
      { text: '広告提案 月500プロジェクトまで', ok: true },
      { text: 'NanoBanana バナー生成 月150回まで（450枚）', ok: true },
      { text: 'チャットで数値編集 月3,000回まで', ok: true },
      { text: '複数ブランド管理', ok: true },
      { text: 'チーム共有・コメント', ok: true },
      { text: '専任サポート + SLA 保証', ok: true },
      { text: 'カスタム業界ベンチマーク対応', ok: true },
      { text: 'API 提供 (近日)', ok: true },
    ],
    cta: 'お問い合わせ',
    highlight: false,
  },
]

export default function AdSimPricingPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const currentPlan = String(user?.plan || 'FREE').toUpperCase()

  const isCurrentPlan = (plan: Plan): boolean => {
    if (plan.id === 'free') return currentPlan === 'FREE' || currentPlan === 'GUEST'
    if (plan.id === 'light') return currentPlan === 'LIGHT'
    if (plan.id === 'pro') return ['PRO', 'BASIC', 'STARTER', 'BUSINESS'].includes(currentPlan)
    if (plan.id === 'enterprise') return currentPlan === 'ENTERPRISE'
    return false
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8F8FB]">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <Link href="/adsim" className="text-sm font-bold text-slate-700 hover:text-[#0017C1]">
            ← ダッシュボード
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-12 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0017C1] to-[#3460FB] px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#0017C1]/20">
            <Sparkles className="h-3 w-3" />
            料金プラン
          </div>
          <h1 className="mb-3 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            シンプルな料金体系
          </h1>
          <p className="text-base font-bold text-slate-600">
            ドヤAI は全サービス共通の統一課金。1つ Pro 契約すれば他サービスも Pro 枠で利用可能
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => {
            const current = isCurrentPlan(p)
            return (
              <div
                key={p.id}
                className={`relative overflow-hidden rounded-3xl border-2 bg-white p-6 shadow-sm transition hover:shadow-2xl ${
                  current
                    ? 'border-emerald-400 shadow-2xl shadow-emerald-100'
                    : p.highlight
                      ? 'border-[#0017C1] shadow-2xl shadow-[#0017C1]/20'
                      : 'border-slate-200'
                }`}
              >
                {p.highlight && !current && (
                  <>
                    <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-[#3460FB]/20 to-transparent" />
                    <div className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-[#0017C1] to-[#3460FB] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                      オススメ
                    </div>
                  </>
                )}
                {current && (
                  <div className="absolute right-3 top-3 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                    現在のプラン
                  </div>
                )}
                <div className="relative">
                  <div className="mb-1 text-xs font-black uppercase tracking-widest text-slate-500">
                    {p.badge}
                  </div>
                  <h2 className="mb-1 text-2xl font-black text-slate-900">{p.name}</h2>
                  <div className="mb-2 flex items-baseline gap-1">
                    <span className="text-4xl font-black text-[#0017C1]">{p.price}</span>
                    <span className="text-sm font-bold text-slate-500">{p.period}</span>
                  </div>
                  <p className="mb-5 text-xs font-bold text-slate-600">{p.description}</p>

                  <ul className="mb-6 space-y-2.5 border-t border-slate-100 pt-5">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        {f.ok ? (
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#0017C1]" />
                        ) : (
                          <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-300" />
                        )}
                        <span className={`font-bold ${f.ok ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {f.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {current ? (
                    <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-700">
                      利用中
                    </div>
                  ) : p.id === 'free' ? (
                    <Link
                      href="/adsim/new"
                      className="block rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-700 transition hover:border-[#0017C1] hover:text-[#0017C1]"
                    >
                      {p.cta}
                    </Link>
                  ) : p.id === 'enterprise' ? (
                    <a
                      href="mailto:k-mitsumori@surisuta.jp?subject=ドヤ広告シミュレーションAI Enterprise問い合わせ"
                      className="block rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-700 transition hover:border-[#0017C1] hover:text-[#0017C1]"
                    >
                      {p.cta}
                    </a>
                  ) : (
                    <CheckoutButton
                      planId={p.planId!}
                      loginCallbackUrl="/adsim/pricing"
                      variant={p.highlight ? 'secondary' : 'primary'}
                      className={`block w-full rounded-xl px-4 py-3 text-center text-sm font-black transition ${
                        p.highlight
                          ? 'bg-gradient-to-r from-[#0017C1] to-[#3460FB] text-white shadow-lg shadow-[#0017C1]/30 hover:shadow-xl'
                          : 'bg-[#0017C1] text-white hover:bg-[#000060]'
                      }`}
                    >
                      {p.cta}
                    </CheckoutButton>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 現在のプラン管理 */}
        {currentPlan !== 'FREE' && currentPlan !== 'GUEST' && (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <h3 className="mb-2 text-sm font-black text-slate-700">現在のプラン管理</h3>
            <p className="mb-4 text-xs font-bold text-slate-500">
              プランの変更・解約・支払い方法の更新は Stripe カスタマーポータルから可能です
            </p>
            <a
              href="/api/stripe/portal/redirect"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[#0017C1] bg-white px-5 py-2.5 text-sm font-black text-[#0017C1] transition hover:bg-[#D9E6FF]"
            >
              支払い・プラン管理ポータルを開く
            </a>
          </div>
        )}

        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-700">
            よくある質問
          </h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-black text-slate-900">Q. ドヤAI の他サービスを契約していれば、ドヤ広告シミュもそのまま使えますか？</dt>
              <dd className="mt-1 font-bold text-slate-600">
                A. はい。ドヤAI は <strong>1アカウント・1契約で全サービス利用可能</strong>な統一課金モデルです。ドヤバナーAI / ドヤSEO / ドヤコピーAI 等で Pro 契約していれば、ドヤ広告シミュレーションAI も自動的に Pro 枠でご利用いただけます。
              </dd>
            </div>
            <div>
              <dt className="font-black text-slate-900">Q. 支払い方法は？</dt>
              <dd className="mt-1 font-bold text-slate-600">
                A. Stripe 経由でクレジットカード（Visa / Mastercard / JCB / AMEX）に対応しています。カード情報は当社では保管していません。
              </dd>
            </div>
            <div>
              <dt className="font-black text-slate-900">Q. NanoBanana バナー画像はなぜ無料プランでダウンロードできないの？</dt>
              <dd className="mt-1 font-bold text-slate-600">
                A. 画像生成 API のコストが高いため、商用利用可能なダウンロードは Light プラン以上に限定しています。プレビューはご確認いただけます。
              </dd>
            </div>
            <div>
              <dt className="font-black text-slate-900">Q. なぜ Pro プランも無制限ではないの？</dt>
              <dd className="mt-1 font-bold text-slate-600">
                A. Gemini / NanoBanana 等の AI API 使用料が発生するため、サービス品質を維持するために月間制限を設定しています。Pro プランの月100プロジェクト・バナー月30回・チャット月500回は、通常の代理店業務を十分カバーできる設計です。
              </dd>
            </div>
            <div>
              <dt className="font-black text-slate-900">Q. プラン変更はいつでもできますか？</dt>
              <dd className="mt-1 font-bold text-slate-600">
                A. いつでもアップグレード・ダウングレード・解約が可能です。月の途中で変更した場合は日割り計算されます。プラン管理は Stripe カスタマーポータルから行えます。
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
