'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { shodanGet, shodanSend } from '@/lib/shodan/client'
import Markdown from '@/components/shodan/Markdown'
import { DoyaKun, SiteShot } from '@/components/shodan/ui'
import SlideDeck from '@/components/shodan/SlideDeck'
import type { CompanyResearch, CompanyAnalysis, ProposalSlide } from '@/lib/shodan/types'
import toast from 'react-hot-toast'

const sym = (name: string, size = 18) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>

type Prep = {
  id: string; targetUrl: string; targetName: string | null; status: string; errorMessage: string | null
  research: CompanyResearch | null; analysis: CompanyAnalysis | null; proposalMarkdown: string | null; slidesJson: ProposalSlide[] | null; createdAt: string
}

const FREQ: Record<string, { label: string; cls: string }> = {
  high: { label: '高頻度', cls: 'text-emerald-600' }, medium: { label: '中頻度', cls: 'text-sky-600' },
  low: { label: '低頻度', cls: 'text-amber-600' }, inactive: { label: 'ほぼ停止', cls: 'text-rose-600' }, unknown: { label: '不明', cls: 'text-slate-400' },
}
const SCALE: Record<string, string> = { large: '大規模', medium: '中規模', small: '小規模', unknown: '不明' }

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

  // 生成中なら数秒ごとにポーリングして done/failed になったら止める
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    let alive = true
    const fetchOnce = () =>
      shodanGet<{ item: Prep }>(`/api/shodan/preparations/${id}`, orgSlug)
        .then((d) => {
          if (!alive) return
          setPrep(d.item)
          if (d.item.status !== 'processing' && timer) { clearInterval(timer); timer = null }
        })
        .catch(() => { if (alive) setNotFound(true) })
    fetchOnce()
    timer = setInterval(fetchOnce, 5000)
    return () => { alive = false; if (timer) clearInterval(timer) }
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

      {/* 調査済み・提案未生成 → 提案作成導線 */}
      {prep.status === 'researched' && !prep.proposalMarkdown && (
        <div className="flex items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 px-5 py-4 flex-wrap">
          <DoyaKun mood={generating ? 'present' : 'thumbsup'} size={52} float={generating} />
          <span className="flex-1 min-w-[180px] text-purple-800 font-bold text-sm">
            {generating ? '提案資料を作成中です…' : '企業調査は完了しました。続けて提案資料を作成しましょう。'}
          </span>
          {!generating && (
            <button onClick={generate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-xs hover:-translate-y-0.5 transition-all">
              {sym('bolt', 16)}提案資料を作成する
            </button>
          )}
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
            <Stat icon="article" label="オウンドメディア" value={r.ownedMedia.hasOwnedMedia ? `${SCALE[r.ownedMedia.siteScale]}（約${r.ownedMedia.articleCountEstimate}記事）` : 'なし'} sub={r.ownedMedia.mediaUrls[0] || ''} />
            <Stat icon="update" label="記事更新頻度" value={<span className={FREQ[r.ownedMedia.updateFrequency]?.cls}>{FREQ[r.ownedMedia.updateFrequency]?.label}</span>} sub={r.ownedMedia.latestArticleDate ? `最新: ${r.ownedMedia.latestArticleDate}` : r.ownedMedia.frequencyNote} />
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
