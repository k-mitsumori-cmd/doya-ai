'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { shodanGet } from '@/lib/shodan/client'
import Markdown from '@/components/shodan/Markdown'
import type { CompanyResearch, CompanyAnalysis } from '@/lib/shodan/types'
import toast from 'react-hot-toast'

const sym = (name: string, size = 18) => <span className="material-symbols-outlined" style={{ fontSize: size }}>{name}</span>

type Prep = {
  id: string; targetUrl: string; targetName: string | null; status: string; errorMessage: string | null
  research: CompanyResearch | null; analysis: CompanyAnalysis | null; proposalMarkdown: string | null; createdAt: string
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
  const [prep, setPrep] = useState<Prep | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    shodanGet<{ item: Prep }>(`/api/shodan/preparations/${id}`, orgSlug)
      .then((d) => setPrep(d.item))
      .catch(() => setNotFound(true))
  }, [orgSlug, id])

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

  if (notFound) return <div className="p-8 text-center text-slate-400 font-bold">商談準備が見つかりませんでした。<Link href={`/shodan/${encodeURIComponent(orgSlug)}`} className="text-purple-600 underline ml-1">一覧へ戻る</Link></div>
  if (!prep) return <div className="p-8 text-center text-slate-400 font-bold">読み込み中…</div>

  const r = prep.research
  const a = prep.analysis

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
        <Link href={`/shodan/${encodeURIComponent(orgSlug)}`} className="hover:text-purple-600 flex items-center gap-1">{sym('arrow_back', 16)}一覧</Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{prep.targetName || prep.targetUrl}</h1>
          <a href={prep.targetUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-purple-600 hover:underline flex items-center gap-1 mt-1">{sym('open_in_new', 14)}{prep.targetUrl}</a>
        </div>
      </div>

      {prep.status === 'failed' && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 font-bold text-sm">
          生成に失敗しました。{prep.errorMessage ? `（${prep.errorMessage}）` : ''} URLを確認して再度お試しください。
        </div>
      )}

      {/* 深掘り調査 */}
      {r && (
        <Card title="深掘りリサーチ" icon="travel_explore" accent="text-purple-700">
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

      {/* 提案資料 */}
      {prep.proposalMarkdown && (
        <Card title="提案資料" icon="description" accent="text-purple-700">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={copyProposal} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white font-black text-sm hover:bg-purple-700 transition-colors">{sym('content_copy', 16)}コピー</button>
            <button onClick={downloadProposal} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-colors">{sym('download', 16)}.md保存</button>
          </div>
          <div className="rounded-2xl bg-white border border-slate-100 p-5">
            <Markdown source={prep.proposalMarkdown} />
          </div>
        </Card>
      )}
    </div>
  )
}
