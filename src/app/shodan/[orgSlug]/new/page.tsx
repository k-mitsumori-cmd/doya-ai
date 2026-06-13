'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { shodanGet, shodanSend } from '@/lib/shodan/client'
import { DoyaKun, SiteShot, sym } from '@/components/shodan/ui'
import type { CompanyResearch } from '@/lib/shodan/types'
import toast from 'react-hot-toast'

type Phase = 'input' | 'researching' | 'reveal' | 'generating'

// 調査中に流す「現在進行形」メッセージ（実処理と並行して体感を演出）
const RESEARCH_TICKER = [
  '企業サイトを読み込んでいます…',
  '会社概要・事業内容を読み取っています…',
  '従業員数を公的データ(gBizINFO)と照合しています…',
  'SNS・広告・計測ツールの利用状況を調べています…',
  'オウンドメディア（ブログ/ニュース）を探しています…',
  '記事の更新頻度を分析しています…',
  '調査結果をまとめています…',
]

const FREQ: Record<string, string> = { high: '高頻度', medium: '中頻度', low: '低頻度', inactive: 'ほぼ停止', unknown: '不明' }
const SCALE: Record<string, string> = { large: '大規模', medium: '中規模', small: '小規模', unknown: '不明' }

function findingsFrom(r: CompanyResearch) {
  return [
    { icon: 'apartment', label: '企業名', value: r.companyName || '（不明）' },
    { icon: 'groups', label: '実従業員数', value: r.employeeCount != null ? `約${r.employeeCount}名（${r.employeeCountSource === 'gbizinfo' ? '公的データ' : r.employeeCountSource === 'website' ? 'サイト記載' : '推定'}）` : '記載なし' },
    { icon: 'category', label: '業種', value: r.industry || '—' },
    { icon: 'campaign', label: 'マーケ施策', value: r.marketing.summary },
    { icon: 'article', label: 'オウンドメディア', value: r.ownedMedia.hasOwnedMedia ? `${SCALE[r.ownedMedia.siteScale]}（約${r.ownedMedia.articleCountEstimate}記事）` : '見当たらない' },
    { icon: 'update', label: '記事更新頻度', value: `${FREQ[r.ownedMedia.updateFrequency]}（${r.ownedMedia.latestArticleDate || '最新日不明'}）` },
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
      // 調査結果を見せてから生成へ
      await new Promise((r) => setTimeout(r, 2600))
      // フェーズ2：提案資料の生成
      setPhase('generating')
      const g = await shodanSend<{ id: string; status: string }>(`/api/shodan/preparations/${d.id}/generate`, orgSlug, 'POST')
      if (g.status !== 'done') throw new Error('提案生成に失敗しました')
      toast.success('商談準備が完成しました！')
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
      <h1 className="text-2xl font-black text-slate-900">新規 商談準備</h1>
      <p className="text-sm font-bold text-slate-400 mt-1 mb-6">商談先企業のURLを入れるだけ。調査→課題仮説→提案資料まで自動で作成します。</p>

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
            <div className="flex justify-center"><DoyaKun mood="focus" size={120} /></div>
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

        {phase === 'generating' && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-3xl bg-white border border-purple-100 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <DoyaKun mood="present" size={72} />
              <div>
                <p className="font-black text-purple-700 text-lg flex items-center gap-2">
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>提案資料を作成中…
                </p>
                <p className="text-xs font-bold text-slate-400">調査結果をもとに、提案書を組み立てています。</p>
              </div>
            </div>

            {/* 資料が組み上がる演出（ドキュメント＋スライドのモックアップ） */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <div className="mx-auto max-w-md bg-white rounded-xl shadow-md border border-slate-100 p-5">
                <motion.div initial={{ width: 0 }} animate={{ width: '70%' }} transition={{ duration: 0.6 }}
                  className="h-5 rounded bg-gradient-to-r from-purple-400 to-fuchsia-400 mb-4" />
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6] }}
                    transition={{ delay: 0.3 + i * 0.35, duration: 1.2, repeat: Infinity, repeatType: 'reverse' }}
                    className={`h-3 rounded bg-slate-200 mb-2 ${i % 3 === 0 ? 'w-1/3 bg-purple-200' : i % 2 === 0 ? 'w-5/6' : 'w-full'}`} />
                ))}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.25 }}
                      className="aspect-video rounded-lg bg-gradient-to-br from-purple-100 to-fuchsia-100 border border-purple-200 grid place-items-center">
                      <span className="material-symbols-outlined text-purple-400" style={{ fontSize: 18 }}>{['insert_chart', 'lightbulb', 'description'][i]}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
              <p className="text-center text-[11px] font-bold text-slate-400 mt-3">エグゼクティブサマリー・課題・ご提案・効果・進め方 を構成中…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
