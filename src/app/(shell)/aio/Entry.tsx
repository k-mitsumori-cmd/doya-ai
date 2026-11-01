'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { startGoogleSignIn } from '@/lib/use-navigation-submission'
import { useSession } from 'next-auth/react'
import { readBillingResponse } from '@/lib/billing-response-client'
import { useAioQuickStart } from '@/lib/aio/use-quick-start'
import { AioQuickStartStatus } from '@/components/aio/quick-start-status'
import { getServiceById } from '@/lib/services'
import {
  LpShell, ProductHero, MockWindow, FeatureShowcase, HowItWorks, Benefits, UseCases, FaqSection, CtaBand,
  DoyaKun, Sym, type ShowcaseRow,
} from '@/components/lp'
import { ACCENT, CTA, STEPS, BENEFITS, FAQ } from '@/app/(shell)/aio/lp-data'
import { AioSovMock, AioEnginesMock, AioCitationsMock } from '@/app/(shell)/aio/mocks'

const SVC = getServiceById('aio')!

const ROWS: ShowcaseRow[] = [
  {
    icon: 'hub', title: '4つのAIで言及率を測定',
    desc: 'ChatGPT・Gemini・Claude・Perplexityに同じ質問群を反復で投げ、自社ブランドが「◯回中△回」登場するかをエンジンごとに計測します。',
    bullets: ['4エンジンを横断で同時観測', '質問ごとの言及頻度を記録', 'AIごとの得意・不得意が一目でわかる'],
    visual: <MockWindow title="4エンジン言及率"><AioEnginesMock /></MockWindow>,
  },
  {
    icon: 'leaderboard', title: '競合とSoVを比較',
    desc: '同じ質問群で、競合より自社がどれだけ登場するか。AI上の占有率（Share of Voice）を、スキャンするたびにランキングで比べます。',
    bullets: ['自社と競合の登場比率を可視化', '占有率の推移を時系列で追跡', '「AIに推されている度合い」を数値化'],
    visual: <MockWindow title="AI可視性ランキング"><AioSovMock /></MockWindow>,
  },
  {
    icon: 'link', title: '引用元ドメインを把握',
    desc: 'AIが回答の根拠にしているサイトを一覧化。どのメディア・記事に載れば引用されるかがわかり、AEOの打ち手につながります。',
    bullets: ['AIが参照した引用元を集計', '自社サイトの引用回数も追える', '掲載を狙うべき媒体が見える'],
    visual: <MockWindow title="引用元ドメイン"><AioCitationsMock /></MockWindow>,
  },
]

export default function AioEntryPage() {
  // 新しい見た目（チェックリスト §5.1）かどうか
  const router = useRouter()
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading')
  const [authed, setAuthed] = useState(false)
  const [serviceUrl, setServiceUrl] = useState('')
  const { data: session, status } = useSession()
  const actor = status === 'authenticated' ? session?.user?.id || '' : ''
  const identity = useRef({ actor, status, version: 0 })
  if (identity.current.actor !== actor || identity.current.status !== status) identity.current = { actor, status, version: identity.current.version + 1 }
  const flow = useAioQuickStart({
    url: serviceUrl,
    onComplete: (slug, autoScan) => router.replace(`/aio/${encodeURIComponent(slug)}${autoScan ? '?scan=1' : ''}`),
    onSignIn: () => startGoogleSignIn('/aio'),
  })
  const creating = !!flow.view?.busy

  useEffect(() => {
    if (status === 'loading') return
    const controller = new AbortController()
    const version = identity.current.version
    const current = () => !controller.signal.aborted && identity.current.version === version
    setPhase('loading')
    setAuthed(status === 'authenticated')
    void readBillingResponse('/api/aio/me', { method: 'GET' }, controller.signal)
      .then(({ ok, data }) => {
        if (!current()) return
        if (!ok || typeof data.authenticated !== 'boolean' || !Array.isArray(data.memberships)) throw new Error('Invalid workspace response')
        const memberships = data.memberships
        if (data.authenticated && memberships.length) {
          const last = memberships[memberships.length - 1]
          if (!last || typeof last !== 'object' || typeof last.slug !== 'string' || !last.slug || last.slug.length > 180 || /[\s/\\?#\u0000-\u001f\u007f]/.test(last.slug)) throw new Error('Invalid workspace slug')
          // The destination also recovers the saved operation with GET only.
          router.replace(`/aio/${encodeURIComponent(last.slug)}/scan`)
        }
        setPhase('ready')
      })
      .catch(() => { if (current()) setPhase('ready') })
    return () => controller.abort()
  }, [router, actor, status])

  const start = async () => {
    if (flow.disabled) return
    if (!serviceUrl.trim()) { toast.error('URLを入力してください'); return }
    await flow.start()
  }

  if (phase === 'loading') {
    // 新しい見た目: 全画面の水色の読み込みにせず、中身の場所にだけ小さく出す（UI 品質 C-1・C-2・F-2）
    return (
      <div role="status" className="grid place-items-center py-20 text-center">
        <DoyaKun mood="thinking" size={72} float={false} />
        <p className="mt-3 text-sm text-slate-500 font-bold">組織を確認しています…</p>
      </div>
    )
  }


  // 新しい見た目でログインしていて、組織がまだ無い = 「はじめに」（共通の枠の中に出すので、紹介ページの自前のヘッダーを出さない）。
  // 入れた URL で組織を作って調べ始める流れ（useAioQuickStart）は、下の紹介ページと同じ
  if (authed) {
    return (
      <div className="grid place-items-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="mb-6 text-center">
            <div className="flex justify-center"><DoyaKun mood="hello" size={110} float={false} /></div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">AI検索対策をはじめましょう</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">調べたいサービスの URL を入れると、組織を作って、最初の調査を始めます。</p>
          </div>
          <label htmlFor="aio-entry-service-url" className="mb-1 block text-sm font-bold text-slate-700">分析したいサービスのURL</label>
          <input id="aio-entry-service-url"
            value={serviceUrl}
            onChange={(e) => setServiceUrl(e.target.value)}
            placeholder="例: https://doya-ai.surisuta.jp"
            inputMode="url"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void start() } }}
            className="mb-3 w-full rounded-xl border-2 border-slate-200 px-4 py-3 font-bold outline-none transition-colors focus:border-[#0066ff]"
          />
          <button
            type="button"
            onClick={start}
            disabled={flow.disabled}
            className="w-full rounded-xl bg-[#0066ff] py-3.5 text-base font-bold text-white transition-colors hover:bg-[#0052cc] disabled:opacity-50 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            {creating ? '調べています…' : '調べる'}
          </button>
          <AioQuickStartStatus flow={flow} />
        </div>
      </div>
    )
  }

  // 未ログイン / 未ワークスペース = ランディング（URLクイックスタートは温存）
  return (
    <LpShell serviceName="ドヤAIO" icon="query_stats" ctaHref={CTA} loginHref="/auth/signin?callbackUrl=/aio" ctaLabel="無料で診断する" accent={ACCENT}>
      <ProductHero
        eyebrow="AI可視性 / AEO"
        title="そのブランド、"
        highlight="AIは推してる？"
        subtitle="ChatGPT・Gemini・Claude・Perplexityでの言及・引用・順位を測定。URLを入れるだけで、AIからの見られ方がわかります。"
        note="Googleアカウントで無料ではじめられます"
        ctaHref={CTA}
        ctaLabel="無料で診断する"
        subCtaHref="#start"
        subCtaLabel="URLで今すぐ診断"
        visual={<MockWindow title="AI可視性ランキング"><AioSovMock /></MockWindow>}
      />

      {/* URLクイックスタート（既存の quick-start ロジックを温存） */}
      <section id="start" className="relative -mt-6 md:-mt-10 pb-4">
        <div className="max-w-xl mx-auto px-5">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-5 sm:p-6"
            style={{ boxShadow: '0 18px 48px rgba(0,102,255,0.12)' }}>
            <label htmlFor="aio-entry-service-url" className="block text-left text-sm font-black text-slate-700 mb-2">分析したいサービスのURL</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input id="aio-entry-service-url"
                value={serviceUrl}
                onChange={(e) => setServiceUrl(e.target.value)}
                placeholder="例: https://doya-ai.surisuta.jp"
                inputMode="url"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void start() } }}
                className="flex-1 rounded-xl border-2 border-slate-200 focus:border-[color:var(--lp-accent)] outline-none px-4 py-3 font-bold transition-colors"
              />
              <button
                onClick={start}
                disabled={flow.disabled}
                className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-black shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #0066ff, var(--lp-accent))', boxShadow: '0 10px 24px rgba(0,102,255,0.28)' }}
              >
                <Sym name={creating ? 'hourglass_top' : 'search'} size={20} />
                {creating ? '判定中…' : '調べる'}
              </button>
            </div>
            <AioQuickStartStatus flow={flow} />
            <p className="text-left text-xs font-bold text-slate-400 mt-2">
              {authed
                ? 'URLを入れて「調べる」を押すと、AIが自動でセットアップしてスキャンします。'
                : 'Googleアカウントでログインすると無料で診断できます。'}
            </p>
          </div>
        </div>
      </section>

      <HowItWorks
        title={<>URLを入れるだけの<br className="md:hidden" />3ステップ</>}
        lead="監視プロンプトの用意から観測、改善提案まで、AI可視性の運用を自動化します。"
        steps={STEPS}
      />
      <FeatureShowcase title="AIでの「選ばれ方」を、そのまま見せます。" lead="AI検索での可視性を測る機能を、ひとつの画面に。" rows={ROWS} />
      <Benefits title="なぜ、いまAI可視性なのか" items={BENEFITS} />
      {SVC.useCases && <UseCases items={SVC.useCases} />}
      <FaqSection items={FAQ} />
      <CtaBand
        title={<>AIに選ばれているか、<br className="md:hidden" />今すぐ確かめる。</>}
        subtitle="URLを入れるだけ。ChatGPT・Gemini・Claude・PerplexityでのAI可視性がわかります。"
        ctaHref={CTA}
        ctaLabel="無料で診断する"
        note="無料プランで監視プロンプト3件・週1回スキャンをお試しいただけます"
      />
    </LpShell>
  )
}
