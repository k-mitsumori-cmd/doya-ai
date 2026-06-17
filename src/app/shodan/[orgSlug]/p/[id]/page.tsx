'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { shodanGet, shodanSend } from '@/lib/shodan/client'
import Markdown from '@/components/shodan/Markdown'
import { DoyaKun, SiteShot, type Mood } from '@/components/shodan/ui'
import SlideDeck from '@/components/shodan/SlideDeck'
import type { CompanyResearch, CompanyAnalysis, ProposalSlide } from '@/lib/shodan/types'
import toast from 'react-hot-toast'

const sym = (name: string, size = 18) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>

// 「作成中」を飽きさせない楽しいメッセージ＆ドヤくんの表情
const SLIDE_FUN_MSGS: { text: string; mood: import('@/components/shodan/ui').Mood }[] = [
  { text: 'ドヤくんが構成を練っています…🤔', mood: 'thinking' },
  { text: '配色をブランドカラーに整えています…🎨', mood: 'focus' },
  { text: '見出しを大きく、ドヤっと強調中…💪', mood: 'point' },
  { text: 'グラフ・図解のレイアウトを調整中…📊', mood: 'working' },
  { text: '余白を美しく、プロ品質に…✨', mood: 'love' },
  { text: 'CTAをしっかり目立たせています…🔥', mood: 'jump' },
  { text: 'もうすぐ完成！最後の仕上げ中…🎁', mood: 'present' },
]

// 提案資料を「組み立て中」に順番で見せる派手なステップ（会社情報は先に出して、ここで待たせない）
const PROPOSAL_STEPS: { icon: string; mood: Mood; title: string; sub: string }[] = [
  { icon: 'analytics', mood: 'thinking', title: '現状をはっきり分析中…', sub: '強み・弱み・伸びしろを言語化しています' },
  { icon: 'psychology', mood: 'focus', title: '課題仮説を組み立て中…', sub: '根拠と“放置リスク”をセットで整理' },
  { icon: 'lightbulb', mood: 'point', title: '刺さる解決策を設計中…', sub: '期待できる効果まで添えて提案の柱に' },
  { icon: 'record_voice_over', mood: 'working', title: '商談トークを準備中…', sub: '最初の一言・話す順番を用意しています' },
  { icon: 'auto_awesome', mood: 'present', title: '提案資料に清書中…', sub: 'もうすぐ完成します！' },
]

type Prep = {
  id: string; targetUrl: string; targetName: string | null; status: string; errorMessage: string | null
  research: CompanyResearch | null; analysis: CompanyAnalysis | null; proposalMarkdown: string | null; slidesJson: ProposalSlide[] | null; slideImages: { title: string; imageUrl: string; role?: string }[] | null; createdAt: string
}


function Stat({ icon, label, value, sub }: { icon: string; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="flex items-center gap-1.5 text-slate-400 font-black text-xs">{sym(icon, 16)}{label}</div>
      <div className="text-lg font-black text-slate-900 mt-1">{value}</div>
      {sub && <div className="text-[11px] font-bold text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function Card({ title, icon, accent, children }: { title: string; icon: string; accent?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
      <h2 className={`flex items-center gap-2 text-lg font-black mb-4 ${accent || 'text-slate-900'}`}>{sym(icon, 22)}{title}</h2>
      {children}
    </section>
  )
}

export default function ShodanResultPage() {
  const params = useParams<{ orgSlug: string; id: string }>()
  const orgSlug = decodeURIComponent(String(params.orgSlug))
  const id = String(params.id)
  const router = useRouter()
  const [prep, setPrep] = useState<Prep | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [retrying, setRetrying] = useState(false)

  // 調査中(processing)の間だけポーリングし、done/failed/researched になったら停止。
  // stopped フラグで「初回fetchがinterval設定前に完了する競合」でも確実に止める（無限ポーリング防止）。
  useEffect(() => {
    let alive = true
    let stopped = false
    const fetchOnce = () =>
      shodanGet<{ item: Prep }>(`/api/shodan/preparations/${id}`, orgSlug)
        .then((d) => {
          if (!alive) return
          setPrep(d.item)
          if (d.item.status !== 'processing') stopped = true
        })
        .catch(() => { if (alive) setNotFound(true) })
    fetchOnce()
    const timer = setInterval(() => {
      if (stopped || !alive) { clearInterval(timer); return }
      fetchOnce()
    }, 5000)
    return () => { alive = false; clearInterval(timer) }
  }, [orgSlug, id])

  const retry = async () => {
    if (!prep) return
    setRetrying(true)
    try {
      const d = await shodanSend<{ id: string; status: string }>('/api/shodan/preparations', orgSlug, 'POST', { url: prep.targetUrl })
      toast.success('再生成を開始しました')
      router.replace(`/shodan/${encodeURIComponent(orgSlug)}/p/${d.id}`)
    } catch (e: any) { toast.error(e.message); setRetrying(false) }
  }

  // 提案の表示切替（スライド / 文書）
  const [view, setView] = useState<'slides' | 'doc'>('slides')
  // 画像スライド生成（ドヤスライド方式・バッチ生成を完了まで繰り返す）
  const [slidesBusy, setSlidesBusy] = useState(false)
  const [slidesProgress, setSlidesProgress] = useState<{ done: number; total: number } | null>(null)
  const [funMsg, setFunMsg] = useState(0)
  useEffect(() => {
    if (!slidesBusy) return
    const t = setInterval(() => setFunMsg((m) => (m + 1) % SLIDE_FUN_MSGS.length), 2500)
    return () => clearInterval(t)
  }, [slidesBusy])
  const genSlideImages = async () => {
    setSlidesBusy(true)
    setSlidesProgress(null)
    try {
      let prevDone = -1
      let stalls = 0
      for (let guard = 0; guard < 14; guard++) {
        const d = await shodanSend<{ success: boolean; count: number; total: number; remaining: number }>(`/api/shodan/preparations/${id}/slides/generate`, orgSlug, 'POST')
        if (!d.success) throw new Error('生成に失敗しました')
        setSlidesProgress({ done: d.count, total: d.total })
        if (d.remaining <= 0) break
        if (d.count <= prevDone) {
          // 進捗なし。一時的失敗の可能性があるので1回だけ再試行し、2回連続で止まったら打ち切り（編集画面で個別再生成）
          stalls++
          if (stalls >= 2) break
        } else {
          stalls = 0
          prevDone = d.count
        }
      }
      router.push(`/shodan/${encodeURIComponent(orgSlug)}/p/${id}/slides`)
    } catch (e: any) { toast.error(e.message || 'スライド生成に失敗しました'); setSlidesBusy(false) }
  }
  // 調査済み（提案未生成）案件から提案資料を作成
  const [generating, setGenerating] = useState(false)
  const generate = async () => {
    if (!prep) return
    setGenerating(true)
    try {
      const d = await shodanSend<{ id: string; status: string }>(`/api/shodan/preparations/${prep.id}/generate`, orgSlug, 'POST')
      if (d.status !== 'done') throw new Error('提案生成に失敗しました')
      const r = await shodanGet<{ item: Prep }>(`/api/shodan/preparations/${prep.id}`, orgSlug)
      setPrep(r.item)
      toast.success('提案資料が完成しました！')
    } catch (e: any) { toast.error(e.message) } finally { setGenerating(false) }
  }

  // 「提案資料を作成中」の楽しいステップ送り
  const [genStep, setGenStep] = useState(0)
  useEffect(() => {
    if (!generating) { setGenStep(0); return }
    const t = setInterval(() => setGenStep((i) => (i < PROPOSAL_STEPS.length - 1 ? i + 1 : i)), 1600)
    return () => clearInterval(t)
  }, [generating])

  // 調査済み(researched)の案件を開いたら、提案生成を“自動で”開始（ボタンを押させず待たせない）
  const genStartedRef = useRef(false)
  useEffect(() => {
    if (!prep) return
    if (prep.status === 'researched' && !prep.proposalMarkdown && !generating && !genStartedRef.current) {
      genStartedRef.current = true
      generate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prep])

  const copyProposal = async () => {
    if (!prep?.proposalMarkdown) return
    await navigator.clipboard.writeText(prep.proposalMarkdown)
    toast.success('提案資料をコピーしました')
  }
  const downloadProposal = () => {
    if (!prep?.proposalMarkdown) return
    const blob = new Blob([prep.proposalMarkdown], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `提案資料_${(prep.targetName || 'company').replace(/[\\/:*?"<>|]/g, '')}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const copyText = async (t: string) => { await navigator.clipboard.writeText(t); toast.success('コピーしました') }
  const printProposal = () => {
    if (typeof window !== 'undefined') window.print()
  }

  if (notFound) return (
    <div className="p-10 text-center">
      <DoyaKun mood="error" size={96} />
      <p className="text-slate-500 font-bold mt-3">商談準備が見つかりませんでした。<Link href={`/shodan/${encodeURIComponent(orgSlug)}`} className="text-purple-600 underline ml-1">一覧へ戻る</Link></p>
    </div>
  )
  if (!prep) return <div className="p-10 text-center"><DoyaKun mood="thinking" size={88} /><p className="mt-2 text-slate-400 font-bold">読み込み中…</p></div>

  const r = prep.research
  const a = prep.analysis

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-5">
      <style>{`@media print { aside, .shodan-no-print { display: none !important; } .shodan-print-only { display: block !important; } main { width: 100% !important; } body { background: #fff !important; } }`}</style>
      <div className="flex items-center gap-2 text-sm font-bold text-slate-400 shodan-no-print">
        <Link href={`/shodan/${encodeURIComponent(orgSlug)}`} className="hover:text-purple-600 flex items-center gap-1">{sym('arrow_back', 16)}一覧</Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {prep.status === 'done' && <DoyaKun mood="success" size={56} float={false} />}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900">{prep.targetName || prep.targetUrl}</h1>
              {prep.status === 'done' && <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">準備完了</span>}
            </div>
            <a href={prep.targetUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-purple-600 hover:underline flex items-center gap-1 mt-1">{sym('open_in_new', 14)}{prep.targetUrl}</a>
          </div>
        </div>
      </div>

      {/* 完了サマリー＋成果物への素早いジャンプ */}
      {prep.status === 'done' && r && (
        <div className="flex items-center gap-2 flex-wrap rounded-2xl bg-white border border-slate-200 px-4 py-3 shodan-no-print">
          {r.employeeCount != null && <span className="text-xs font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">👥 約{r.employeeCount}名</span>}
          {r.marketing.snsChannels.length > 0 && <span className="text-xs font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">🔗 SNS {r.marketing.snsChannels.length}媒体</span>}
          {r.pressReleases && r.pressReleases.length > 0 && <span className="text-xs font-black px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">📣 PR {r.pressReleases.length}件</span>}
          <div className="flex-1" />
          {(prep.proposalMarkdown || (prep.slidesJson && prep.slidesJson.length > 0)) && (
            <button onClick={() => document.getElementById('shodan-proposal')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-xs hover:-translate-y-0.5 transition-all">
              {sym('slideshow', 16)}提案を見る
            </button>
          )}
        </div>
      )}

      {prep.status === 'processing' && (
        <div className="rounded-3xl bg-white border border-purple-100 p-8 shadow-sm text-center">
          <div className="flex justify-center"><DoyaKun mood="working" size={120} /></div>
          <p className="font-black text-slate-900 text-lg mt-3">ドヤくんが商談準備を作成中です…</p>
          <p className="text-sm font-bold text-slate-400 mt-1">調査〜提案生成まで30秒〜2分ほど。このまま自動で更新されます。</p>
          <div className="mt-4 inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        </div>
      )}

      {prep.status === 'failed' && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 font-bold text-sm flex-wrap">
          <DoyaKun mood="error" size={48} float={false} />
          <span className="flex-1 min-w-[180px]">生成に失敗しました。{prep.errorMessage ? `（${prep.errorMessage}）` : ''} URLを確認して再度お試しください。</span>
          <button onClick={retry} disabled={retrying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-700 transition-colors disabled:opacity-50">
            {sym('refresh', 16)}{retrying ? '再生成中…' : '同じURLで再生成'}
          </button>
        </div>
      )}

      {/* 調査済み・提案生成中 → 派手な「作成中」進捗パネル（会社情報は下にすぐ表示） */}
      {prep.status === 'researched' && !prep.proposalMarkdown && generating && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-fuchsia-600 to-indigo-600 text-white p-6 shadow-lg shadow-purple-500/25 shodan-no-print">
          {/* 背景キラキラ */}
          {['top-4 left-6', 'top-8 right-10', 'bottom-6 left-1/3', 'bottom-10 right-1/4'].map((pos, i) => (
            <span key={i} className={`material-symbols-outlined absolute ${pos} text-white/25 animate-ping`}
              style={{ fontSize: 16 + (i % 2) * 10, animationDuration: `${1.6 + i * 0.4}s` }}>{i % 2 ? 'star' : 'auto_awesome'}</span>
          ))}
          <div className="relative z-10 flex items-center gap-4">
            <div className="relative shrink-0 animate-bounce" style={{ animationDuration: '1.5s' }}>
              <div className="absolute inset-0 -z-10 blur-xl bg-white/40 rounded-full" />
              <DoyaKun mood={PROPOSAL_STEPS[genStep].mood} size={88} float={false} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-[11px] font-black mb-1.5">
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                会社情報の調査は完了！提案資料を作成中
              </div>
              <h2 className="text-xl sm:text-2xl font-black leading-tight flex items-center gap-2">
                <span className="material-symbols-outlined animate-pulse" style={{ fontSize: 24 }}>{PROPOSAL_STEPS[genStep].icon}</span>
                {PROPOSAL_STEPS[genStep].title}
              </h2>
              <p className="text-white/90 font-bold text-sm mt-1">{PROPOSAL_STEPS[genStep].sub}</p>
            </div>
          </div>
          {/* 進捗バー */}
          <div className="relative z-10 mt-5">
            <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-white to-amber-300 transition-all duration-700 ease-out"
                style={{ width: `${Math.round(((genStep + 1) / PROPOSAL_STEPS.length) * 92)}%` }} />
            </div>
            {/* ステップ・ドット */}
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              {PROPOSAL_STEPS.map((s, i) => (
                <span key={i} className={`material-symbols-outlined rounded-full p-0.5 transition-all ${
                  i < genStep ? 'text-emerald-300' : i === genStep ? 'text-white scale-125 bg-white/15' : 'text-white/30'}`}
                  style={{ fontSize: 17 }}>{i < genStep ? 'check_circle' : s.icon}</span>
              ))}
              <span className="ml-auto text-xs font-black text-white/80">下に会社情報を表示中。完成し次第ここに提案が並びます ✨</span>
            </div>
          </div>
        </div>
      )}

      {/* 調査済みだが自動生成が止まった等 → 手動の作成導線（フォールバック） */}
      {prep.status === 'researched' && !prep.proposalMarkdown && !generating && (
        <div className="flex items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 px-5 py-4 flex-wrap shodan-no-print">
          <DoyaKun mood="thumbsup" size={52} float={false} />
          <span className="flex-1 min-w-[180px] text-purple-800 font-bold text-sm">企業調査は完了しました。続けて提案資料を作成しましょう。</span>
          <button onClick={generate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-xs hover:-translate-y-0.5 transition-all">
            {sym('bolt', 16)}提案資料を作成する
          </button>
        </div>
      )}

      {/* 完了したが成果物が空（生成不全）→ 再生成導線 */}
      {prep.status === 'done' && !r && !a && !prep.proposalMarkdown && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center gap-3 flex-wrap">
          <DoyaKun mood="surprise" size={48} float={false} />
          <span className="flex-1 min-w-[180px] text-amber-800 font-bold text-sm">結果が空でした。サイトが取得できなかった可能性があります。再生成をお試しください。</span>
          <button onClick={retry} disabled={retrying}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white font-black text-xs hover:bg-amber-700 transition-colors disabled:opacity-50">
            {sym('refresh', 16)}{retrying ? '再生成中…' : '再生成する'}
          </button>
        </div>
      )}

      {/* 深掘り調査 */}
      {r && (
        <Card title="深掘りリサーチ" icon="travel_explore" accent="text-purple-700">
          {/* サイトのトップ画像＋調査したページのサムネイル */}
          {(r.crawledUrls?.length || r.ogImage) && (
            <div className="mb-4">
              <SiteShot url={r.url} ogImage={r.ogImage} className="w-full aspect-[16/9] mb-2" label={r.companyName || r.url} />
              {r.crawledUrls && r.crawledUrls.length > 1 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {r.crawledUrls.slice(1, 5).map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="block hover:opacity-90 transition-opacity">
                      <SiteShot url={u} className="w-full aspect-[16/10]" label={(() => { try { return new URL(u).pathname.replace(/\/$/, '') || '/' } catch { return u } })()} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat icon="groups" label="実従業員数" value={r.employeeCount != null ? `約${r.employeeCount}名` : '不明'} sub={r.employeeCount != null ? (r.employeeCountSource === 'gbizinfo' ? 'gBizINFO 公的データ' : r.employeeCountSource === 'website' ? 'サイト記載' : '') : '公的データ・サイトに記載なし'} />
            <Stat icon="campaign" label="マーケ実施" value={r.marketing.snsChannels.length || r.marketing.martechTools.length ? '実施あり' : '痕跡少'} sub={r.marketing.summary} />
            <Stat icon="public" label="保有サイト/メディア" value={r.ownedMedia.hasOwnedMedia ? `${r.ownedMedia.mediaUrls.length}件` : '確認できず'} sub={r.ownedMedia.mediaUrls[0] ? (() => { try { return new URL(r.ownedMedia.mediaUrls[0]).hostname } catch { return '関連ページあり' } })() : '公式サイトのみ'} />
            <Stat icon="share" label="SNS/チャネル" value={r.marketing.snsChannels.length ? `${r.marketing.snsChannels.length}媒体` : '確認できず'} sub={r.marketing.snsChannels.join('、') || r.marketing.martechTools.join('、') || '—'} />
          </div>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {r.industry && <div><span className="font-black text-slate-400">業種：</span><span className="font-bold text-slate-700">{r.industry}</span></div>}
            {r.capital && <div><span className="font-black text-slate-400">資本金：</span><span className="font-bold text-slate-700">{r.capital}</span></div>}
            {r.foundedYear && <div><span className="font-black text-slate-400">設立：</span><span className="font-bold text-slate-700">{r.foundedYear}</span></div>}
            {r.representative && <div><span className="font-black text-slate-400">代表者：</span><span className="font-bold text-slate-700">{r.representative}</span></div>}
            {r.address && <div className="md:col-span-2"><span className="font-black text-slate-400">所在地：</span><span className="font-bold text-slate-700">{r.address}</span></div>}
            {r.description && <div className="md:col-span-2 mt-1"><span className="font-black text-slate-400">事業内容：</span><span className="font-bold text-slate-700">{r.description}</span></div>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {r.marketing.snsChannels.map((s) => <span key={s} className="text-[11px] font-black px-2.5 py-1 rounded-full bg-sky-50 text-sky-700">{s}</span>)}
            {r.marketing.martechTools.map((s) => <span key={s} className="text-[11px] font-black px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">{s}</span>)}
            {r.marketing.hasContactForm && <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">問い合わせ導線</span>}
            {r.marketing.hasLeadMagnet && <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">リード獲得施策</span>}
            {r.marketing.runsAds && <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">広告運用</span>}
          </div>
        </Card>
      )}

      {/* プレスリリース・最新動向（PR TIMES） */}
      {r?.pressReleases && r.pressReleases.length > 0 && (
        <Card title="プレスリリース・最新動向（PR TIMES）" icon="campaign" accent="text-purple-700">
          <div className="grid sm:grid-cols-2 gap-3">
            {r.pressReleases.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noreferrer"
                className="group flex gap-3 rounded-2xl border border-slate-200 p-3 hover:border-purple-300 hover:shadow-md transition-all">
                <div className="w-24 h-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-slate-300">{sym('article', 22)}</div>
                  )}
                </div>
                <div className="min-w-0">
                  {p.date && <div className="text-[11px] font-black text-purple-500">{p.date}</div>}
                  <div className="text-sm font-bold text-slate-800 line-clamp-2 group-hover:text-purple-700">{p.title}</div>
                </div>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* 提案資料（画像スライド）の作成 — プレスリリースの直下 */}
      {prep.status === 'done' && prep.slidesJson && prep.slidesJson.length > 0 && (
        <Card title="提案資料（スライド）" icon="slideshow" accent="text-purple-700">
          {prep.slideImages && prep.slideImages.some((s) => s.imageUrl) ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <DoyaKun mood="success" size={48} float={false} />
                <p className="font-bold text-slate-700 text-sm">スライド画像が{prep.slideImages.filter((s) => s.imageUrl).length}枚あります。編集画面で修正できます。</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {prep.slideImages.filter((s) => s.imageUrl).slice(0, 4).map((s, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={s.imageUrl as string} alt={s.title} className="w-full aspect-video object-cover rounded-lg border border-slate-200" loading="lazy" />
                ))}
              </div>
              <Link href={`/shodan/${encodeURIComponent(orgSlug)}/p/${id}/slides`} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-sm hover:-translate-y-0.5 transition-all">{sym('edit', 16)}提案スライドを編集</Link>
            </div>
          ) : slidesBusy ? (
            <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-100 p-6 text-center">
              <div className="flex justify-center"><DoyaKun mood={SLIDE_FUN_MSGS[funMsg].mood} size={96} /></div>
              <p className="font-black text-purple-700 text-base mt-2 transition-all">{SLIDE_FUN_MSGS[funMsg].text}</p>
              {/* 進捗バー */}
              <div className="max-w-sm mx-auto mt-4">
                <div className="flex items-center justify-between text-xs font-black text-slate-500 mb-1">
                  <span>提案スライドを作成中…</span>
                  <span>{slidesProgress ? `${slidesProgress.done}/${slidesProgress.total}枚` : '準備中'}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/70 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-700" style={{ width: slidesProgress ? `${Math.round((slidesProgress.done / Math.max(1, slidesProgress.total)) * 100)}%` : '8%' }} />
                </div>
              </div>
              {/* 組み上がるスライドのモック */}
              <div className="flex justify-center gap-2 mt-5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="w-16 aspect-video rounded-lg bg-white border border-purple-200 grid place-items-center animate-pulse" style={{ animationDelay: `${i * 0.25}s` }}>
                    <span className="material-symbols-outlined text-purple-300" style={{ fontSize: 16 }}>{['title', 'insert_chart', 'lightbulb', 'description'][i]}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-bold text-slate-400 mt-4">タブを閉じずにお待ちください。完成後そのまま編集画面へ移動します。</p>
            </div>
          ) : (
            <div className="flex items-center gap-4 flex-wrap">
              <DoyaKun mood="present" size={56} float={false} />
              <div className="flex-1 min-w-[180px]">
                <p className="font-bold text-slate-700 text-sm">構成をもとに、提案資料をスライド画像として作成します。</p>
                <p className="text-xs font-bold text-slate-400 mt-0.5">作成後、各スライドを修正できる編集画面に移動します。</p>
              </div>
              <button onClick={genSlideImages}
                className="inline-flex items-center gap-1.5 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-sm shadow-lg shadow-purple-500/25 hover:-translate-y-0.5 transition-all">
                {sym('auto_awesome', 18)}提案資料を作成する
              </button>
            </div>
          )}
        </Card>
      )}

      {/* 現状分析 */}
      {a?.currentStateAssessment && (
        <Card title="現状分析（はっきりめ）" icon="analytics" accent="text-purple-700">
          <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{a.currentStateAssessment}</p>
          {(a.strengths?.length > 0 || a.weaknesses?.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <div className="font-black text-emerald-700 text-sm mb-2 flex items-center gap-1">{sym('trending_up', 16)}強み</div>
                <ul className="list-disc pl-5 space-y-1 text-sm font-bold text-emerald-900">{a.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4">
                <div className="font-black text-rose-700 text-sm mb-2 flex items-center gap-1">{sym('trending_down', 16)}弱み・伸びしろ</div>
                <ul className="list-disc pl-5 space-y-1 text-sm font-bold text-rose-900">{a.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 課題仮説 */}
      {a && a.hypotheses.length > 0 && (
        <Card title="課題仮説" icon="psychology" accent="text-purple-700">
          <div className="space-y-3">
            {a.hypotheses.map((h, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 p-4">
                <div className="font-black text-slate-900 flex items-start gap-2"><span className="text-purple-600">{i + 1}.</span>{h.issue}</div>
                {h.basis && <div className="text-sm font-bold text-slate-500 mt-1.5"><span className="text-slate-400">根拠：</span>{h.basis}</div>}
                {h.impact && <div className="text-sm font-bold text-rose-600 mt-1"><span className="text-rose-400">放置リスク：</span>{h.impact}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 解決策 */}
      {a && a.solutions.length > 0 && (
        <Card title="解決策（ご提案の柱）" icon="lightbulb" accent="text-purple-700">
          <div className="grid md:grid-cols-2 gap-3">
            {a.solutions.map((s, i) => (
              <div key={i} className="rounded-2xl bg-purple-50/60 border border-purple-100 p-4">
                <div className="font-black text-purple-900">{s.title}</div>
                {s.detail && <div className="text-sm font-bold text-slate-700 mt-1.5">{s.detail}</div>}
                {s.expectedEffect && <div className="text-sm font-bold text-emerald-700 mt-1.5 flex items-start gap-1">{sym('check', 14)}{s.expectedEffect}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 商談メモ */}
      {a && (a.talkingPoints.length > 0 || a.firstMessage) && (
        <Card title="商談で使うメモ" icon="record_voice_over" accent="text-purple-700">
          {a.firstMessage && (
            <div className="rounded-2xl bg-slate-900 text-white p-4 mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-purple-300 flex items-center gap-1">{sym('waving_hand', 16)}最初の一言</span>
                <button onClick={() => copyText(a.firstMessage)} className="text-slate-300 hover:text-white flex items-center gap-1 text-xs font-bold">{sym('content_copy', 14)}コピー</button>
              </div>
              <p className="font-bold leading-relaxed">{a.firstMessage}</p>
            </div>
          )}
          {a.talkingPoints?.length > 0 && (
            <ul className="space-y-1.5">
              {a.talkingPoints.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm font-bold text-slate-700">{sym('chevron_right', 18)}{t}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div id="shodan-proposal" className="scroll-mt-4" />
      {/* 提案（スライド / 文書） */}
      {(prep.proposalMarkdown || (prep.slidesJson && prep.slidesJson.length > 0)) && (
        <Card title="提案資料" icon="slideshow" accent="text-purple-700">
          {/* タブ */}
          <div className="flex items-center gap-2 mb-4 shodan-no-print">
            {prep.slidesJson && prep.slidesJson.length > 0 && (
              <button onClick={() => setView('slides')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-sm transition-colors ${view === 'slides' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{sym('slideshow', 16)}スライド</button>
            )}
            {prep.proposalMarkdown && (
              <button onClick={() => setView('doc')} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-sm transition-colors ${view === 'doc' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{sym('description', 16)}文書</button>
            )}
          </div>

          {view === 'slides' && prep.slidesJson && prep.slidesJson.length > 0 ? (
            <SlideDeck slides={prep.slidesJson} fileBase={prep.targetName || 'proposal'} />
          ) : prep.proposalMarkdown ? (
            <>
              <div className="flex items-center gap-2 mb-4 flex-wrap shodan-no-print">
                <button onClick={copyProposal} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white font-black text-sm hover:bg-purple-700 transition-colors">{sym('content_copy', 16)}コピー</button>
                <button onClick={downloadProposal} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-colors">{sym('download', 16)}.md保存</button>
                <button onClick={printProposal} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-colors">{sym('print', 16)}印刷 / PDF</button>
              </div>
              <div className="rounded-2xl bg-white border border-slate-100 p-5">
                <Markdown source={prep.proposalMarkdown} />
              </div>
            </>
          ) : null}
        </Card>
      )}
    </div>
  )
}
