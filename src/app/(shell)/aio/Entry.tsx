'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { startGoogleSignIn } from '@/lib/use-navigation-submission'
import { useSession } from 'next-auth/react'
import { useUiNext } from '@/components/shell/ui-next-context'
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
type EntryPhase = 'loading' | 'empty' | 'guest' | 'error' | 'reauth'

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
  const uiNext = useUiNext()
  const router = useRouter()
  const [entry, setEntry] = useState<{ version: number; phase: EntryPhase }>({ version: 0, phase: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [serviceUrl, setServiceUrl] = useState('')
  const { data: session, status } = useSession()
  const actor = status === 'authenticated' ? session?.user?.id || '' : ''
  const previousActor = useRef(actor)
  const identity = useRef({ actor, status, version: 0 })
  if (identity.current.actor !== actor || identity.current.status !== status) identity.current = { actor, status, version: identity.current.version + 1 }
  const phase = status === 'loading' || entry.version !== identity.current.version ? 'loading' : entry.phase
  const authed = status === 'authenticated' && !!actor
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
    const show = (next: EntryPhase) => { if (current()) setEntry({ version, phase: next }) }
    if (previousActor.current !== actor) {
      previousActor.current = actor
      setServiceUrl('')
    }
    if (status === 'unauthenticated') {
      show('guest')
      return () => controller.abort()
    }
    if (!actor) {
      show('reauth')
      return () => controller.abort()
    }
    show('loading')
    void readBillingResponse('/api/aio/me', { method: 'GET', headers: { 'X-Aio-Actor-Id': actor } }, controller.signal)
      .then(({ ok, status: responseStatus, data }) => {
        if (!current()) return
        if (responseStatus === 401 || responseStatus === 409) { show('reauth'); return }
        if (!ok || typeof data.authenticated !== 'boolean' || !Array.isArray(data.memberships)) throw new Error('Invalid workspace response')
        if (!data.authenticated || data.actorId !== actor) { show('reauth'); return }
        const memberships = data.memberships
        if (typeof data.onboarded !== 'boolean' || data.onboarded !== (memberships.length > 0)) throw new Error('Inconsistent workspace response')
        const slugs = memberships.map(member => {
          if (!member || typeof member !== 'object') throw new Error('Invalid workspace membership')
          const slug = (member as { slug?: unknown }).slug
          if (typeof slug !== 'string' || !slug || slug === '.' || slug === '..' || slug.length > 180 || /[\s/\\?#\u0000-\u001f\u007f]/.test(slug)) throw new Error('Invalid workspace slug')
          return slug
        })
        if (slugs.length) {
          const slug = slugs[slugs.length - 1]
          // Remain in the loading view until the owned workspace opens.
          router.replace(`/aio/${encodeURIComponent(slug)}/scan`)
          return
        }
        show('empty')
      })
      .catch(() => { show('error') })
    return () => controller.abort()
  }, [router, actor, status, attempt])

  useEffect(() => {
    const retire = () => {
      identity.current.version += 1
      setEntry({ version: identity.current.version, phase: 'loading' })
    }
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      retire()
      setAttempt(value => value + 1)
    }
    window.addEventListener('pagehide', retire)
    window.addEventListener('pageshow', restore)
    return () => {
      window.removeEventListener('pagehide', retire)
      window.removeEventListener('pageshow', restore)
    }
  }, [])

  const start = async () => {
    if (flow.disabled || entry.version !== identity.current.version || (phase !== 'empty' && phase !== 'guest')) return
    if (!serviceUrl.trim()) { toast.error('URLを入力してください'); return }
    await flow.start()
  }

  const homeLink = <nav aria-label="共通メニュー" className="mx-auto max-w-5xl px-4 pt-4"><a href="/home" className="inline-flex rounded-lg px-3 py-2 text-sm font-bold text-blue-700 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">経営ホームへ戻る</a></nav>
  const quickStart = (
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
  )

  if (phase === 'error' || phase === 'reauth') {
    return <>{homeLink}<section role="alert" className="mx-auto max-w-xl px-5 py-10">
      <h1 className="text-xl font-bold">{phase === 'reauth' ? 'ログイン状態を確認できませんでした' : '組織情報を確認できませんでした'}</h1>
      <p className="mt-3 text-sm text-slate-600">{phase === 'reauth' ? 'もう一度ログインしてから、作業を続けてください。' : '通信状況をご確認のうえ、もう一度確認してください。組織の新規作成は行っていません。'}</p>
      {flow.view?.intent && <div role="status" className="mt-4 rounded-xl border border-slate-200 p-4">
        <p>前の開始処理が残っています。新しく開始せず、保存状況を確認できます。</p>
        <button type="button" disabled={flow.view.busy} onClick={() => void flow.recover()} className="mt-3 rounded-lg border border-blue-700 px-3 py-2 font-bold text-blue-700 disabled:opacity-50">保存状況を確認</button>
      </div>}
      {phase === 'reauth' ? <a href="/auth/signin?callbackUrl=%2Faio" className="mt-4 inline-flex rounded-xl bg-blue-700 px-4 py-3 font-bold text-white">ログインする</a> : <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-4 rounded-xl bg-blue-700 px-4 py-3 font-bold text-white">もう一度確認する</button>}
    </section></>
  }
  if (phase === 'empty') {
    return <>{homeLink}<main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-2xl font-bold">AI検索対策をはじめる</h1>
      <p className="mt-3 mb-10 text-slate-600">自社サイトのURLを入れると、作業スペースを作成し、AI検索での見られ方を調べます。</p>
      {quickStart}
    </main></>
  }

  if (phase === 'loading' && uiNext) {
    // 新しい見た目: 全画面の水色の読み込みにせず、中身の場所にだけ小さく出す（UI 品質 C-1・C-2・F-2）
    return (
      <>{homeLink}<div role="status" className="grid place-items-center py-20 text-center">
        <DoyaKun mood="thinking" size={72} float={false} />
        <p className="mt-3 text-sm text-slate-500 font-bold">組織を確認しています…</p>
      </div></>
    )
  }

  if (phase === 'loading') {
    return (
      <>{homeLink}<div className="min-h-screen grid place-items-center bg-gradient-to-b from-white to-cyan-50">
        <div className="text-center">
          <DoyaKun mood="thinking" size={88} />
          <p className="mt-3 text-slate-400 font-bold">読み込み中…</p>
        </div>
      </div></>
    )
  }

  // 未ログイン時の紹介表示。確認済みの未所属ユーザーには上の作業入口を表示する。
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

      {quickStart}


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
