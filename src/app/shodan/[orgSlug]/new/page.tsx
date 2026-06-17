'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { shodanGet, shodanSend } from '@/lib/shodan/client'
import { DoyaKun, SiteShot, PageHeader, sym } from '@/components/shodan/ui'
import type { CompanyResearch } from '@/lib/shodan/types'
import toast from 'react-hot-toast'

type Phase = 'input' | 'researching' | 'reveal'

// 調査中に流す「現在進行形」メッセージ（実処理と並行して体感を演出）
const RESEARCH_TICKER = [
  '企業サイトを読み込んでいます…',
  '会社概要・事業内容を読み取っています…',
  '従業員数を公的データ(gBizINFO)と照合しています…',
  'SNS・広告・計測ツールの利用状況を調べています…',
  'オウンドメディア（ブログ/ニュース）を探しています…',
  '実施中のマーケ・保有サイトを洗い出しています…',
  'PR TIMESでプレスリリース・最新動向を収集しています…',
  '調査結果をまとめています…',
]
// 進行に合わせたドヤくんの表情（RESEARCH_TICKER と対応）
const RESEARCH_MOODS = ['focus', 'thinking', 'point', 'working', 'thinking', 'point', 'working', 'present'] as const

function findingsFrom(r: CompanyResearch) {
  return [
    { icon: 'apartment', label: '企業名', value: r.companyName || '（不明）' },
    { icon: 'groups', label: '実従業員数', value: r.employeeCount != null ? `約${r.employeeCount}名（${r.employeeCountSource === 'gbizinfo' ? '公的データ' : r.employeeCountSource === 'website' ? 'サイト記載' : '推定'}）` : '記載なし' },
    { icon: 'category', label: '業種', value: r.industry || '—' },
    { icon: 'campaign', label: 'マーケ施策', value: r.marketing.summary },
    { icon: 'public', label: '保有サイト/メディア', value: r.ownedMedia.hasOwnedMedia ? `${r.ownedMedia.mediaUrls.length}件の関連ページ` : '公式サイトのみ確認' },
    { icon: 'share', label: 'SNS/チャネル', value: r.marketing.snsChannels.length ? r.marketing.snsChannels.join('、') : '確認できず' },
    { icon: 'campaign', label: 'プレスリリース', value: r.pressReleases?.length ? `直近${r.pressReleases.length}件を確認（PR TIMES）` : 'PR TIMESでヒットなし' },
  ]
}

export default function ShodanNewPage() {
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = decodeURIComponent(String(params.orgSlug))
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('input')
  const [tick, setTick] = useState(0)
  const [research, setResearch] = useState<CompanyResearch | null>(null)
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)
  const prepIdRef = useRef<string | null>(null)

  useEffect(() => {
    shodanGet<{ profile: any }>('/api/shodan/company-profile', orgSlug).then((d) => setHasProfile(!!d.profile)).catch(() => setHasProfile(null))
  }, [orgSlug])

  // 調査中のティッカー送り
  useEffect(() => {
    if (phase !== 'researching') return
    setTick(0)
    const t = setInterval(() => setTick((s) => Math.min(s + 1, RESEARCH_TICKER.length - 1)), 2600)
    return () => clearInterval(t)
  }, [phase])

  const run = async () => {
    if (!url.trim()) { toast.error('URLを入力してください'); return }
    setPhase('researching')
    try {
      // フェーズ1：調査
      const d = await shodanSend<{ id: string; status: string; research: CompanyResearch }>('/api/shodan/preparations', orgSlug, 'POST', { url })
      prepIdRef.current = d.id
      if (d.status === 'failed' || !d.research) throw new Error('調査に失敗しました')
      setResearch(d.research)
      setPhase('reveal')
      // 会社情報の調査が完了。提案資料の組み立ては時間がかかるので“待たせず”結果ページへ。
      // 結果ページで会社情報を即表示しつつ、提案生成は自動で継続＆進捗を派手に表示する。
      await new Promise((r) => setTimeout(r, 3400))
      toast.success('会社情報の調査が完了！提案資料の作成に進みます')
      router.replace(`/shodan/${encodeURIComponent(orgSlug)}/p/${d.id}`)
    } catch (e: any) {
      toast.error(e.message || '生成に失敗しました')
      // 調査まで終わっていれば結果ページで再生成できる
      if (prepIdRef.current && research) router.replace(`/shodan/${encodeURIComponent(orgSlug)}/p/${prepIdRef.current}`)
      else setPhase('input')
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <PageHeader icon="rocket_launch" mood="point" title="新規 商談準備" subtitle="商談先企業のURLを入れるだけ。調査→課題仮説→提案資料まで自動で作成します。" />

      <AnimatePresence mode="wait">
        {phase === 'input' && (
          <motion.div key="input" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="relative rounded-3xl bg-white border border-purple-100 p-6 pt-8 shadow-sm overflow-hidden">
            <DoyaKun mood="point" size={96} className="!absolute -top-2 right-3" />
            <label className="block text-sm font-black text-slate-700 mb-2">商談先企業のURL</label>
            <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 focus-within:border-purple-400 px-4 py-3 transition-colors bg-white">
              {sym('language', 22)}
              <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()}
                placeholder="例: https://www.example.co.jp" className="flex-1 font-bold outline-none" autoFocus />
            </div>
            {hasProfile === false && (
              <Link href={`/shodan/${encodeURIComponent(orgSlug)}/settings`}
                className="mt-3 flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 hover:bg-amber-100 transition-colors">
                {sym('info', 16)}自社情報が未登録です。先に登録すると提案精度UP →（このまま作成も可）
              </Link>
            )}
            <motion.button onClick={run} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
              className="mt-5 w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-lg shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2">
              {sym('bolt', 22)}この企業の商談準備をつくる
            </motion.button>
            <p className="text-[11px] font-bold text-slate-400 mt-3 text-center">調査〜提案生成まで30秒〜2分ほど。タブを閉じずにお待ちください。</p>
          </motion.div>
        )}

        {phase === 'researching' && (
          <motion.div key="researching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-3xl bg-white border border-purple-100 p-8 shadow-sm text-center">
            <div className="flex justify-center"><DoyaKun mood={RESEARCH_MOODS[Math.min(tick, RESEARCH_MOODS.length - 1)]} size={120} /></div>
            <p className="font-black text-purple-700 text-lg mt-3 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>企業を調査中…
            </p>
            <div className="mt-5 max-w-md mx-auto text-left space-y-2">
              {RESEARCH_TICKER.map((m, i) => (
                <motion.div key={i} initial={false}
                  animate={{ opacity: i <= tick ? 1 : 0.3, x: 0 }}
                  className={`flex items-center gap-2 text-sm font-bold ${i < tick ? 'text-emerald-600' : i === tick ? 'text-purple-700' : 'text-slate-300'}`}>
                  {sym(i < tick ? 'check_circle' : i === tick ? 'radio_button_checked' : 'radio_button_unchecked', 18)}
                  {m}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'reveal' && research && (
          <motion.div key="reveal" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="rounded-3xl bg-white border border-emerald-100 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <DoyaKun mood="thumbsup" size={64} float={false} />
              <div>
                <p className="font-black text-emerald-700 text-lg">調査できました！</p>
                <p className="text-xs font-bold text-slate-400">分かった内容はこちら。続けて提案資料を作成します…</p>
              </div>
            </div>
            <SiteShot url={research.url} ogImage={research.ogImage} className="w-full aspect-[16/9] mb-3" label={research.companyName || research.url} />
            <div className="grid sm:grid-cols-2 gap-2">
              {findingsFrom(research).map((f, i) => (
                <motion.div key={f.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.18 }}
                  className="flex items-start gap-2 rounded-xl bg-emerald-50/60 border border-emerald-100 px-3 py-2.5">
                  <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: 20 }}>{f.icon}</span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-black text-slate-400">{f.label}</div>
                    <div className="text-sm font-bold text-slate-800 truncate">{f.value}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
