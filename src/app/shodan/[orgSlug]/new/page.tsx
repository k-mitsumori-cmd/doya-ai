'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ShodanApiError, shodanGet, shodanSend } from '@/lib/shodan/client'
import { DoyaKun, SiteShot, PageHeader, sym } from '@/components/shodan/ui'
import type { CompanyResearch } from '@/lib/shodan/types'
import toast from 'react-hot-toast'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { readOrgProfile } from '@/lib/org-profile-view'

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
  const homepageChecked = r.sourceStatus?.homepage === 'ok'
  const homepageMessage = r.sourceStatus?.homepage === 'failed' ? 'サイトを取得できず未確認' : 'サイトの取得状況が未確認'
  const employeeUnavailable = r.sourceStatus?.homepage === 'failed' || r.sourceStatus?.gbizinfo === 'failed'
  return [
    { icon: 'apartment', label: '企業名', value: r.companyName || '（不明）' },
    { icon: 'groups', label: '実従業員数', value: r.employeeCount != null ? `約${r.employeeCount}名（${r.employeeCountSource === 'gbizinfo' ? '公的データ' : r.employeeCountSource === 'website' ? 'サイト記載' : '推定'}）` : employeeUnavailable ? '取得できず・未確認' : '確認できず' },
    { icon: 'category', label: '業種', value: r.industry || '—' },
    { icon: 'campaign', label: 'マーケ施策', value: homepageChecked ? r.marketing.summary : r.sourceStatus?.homepage === 'failed' ? '公式サイトを取得できず未確認' : 'サイトの取得状況が未確認' },
    { icon: 'public', label: '保有サイト/メディア', value: r.ownedMedia.hasOwnedMedia ? `${r.ownedMedia.mediaUrls.length}件の関連ページ` : homepageChecked ? '取得したページでは確認できず' : homepageMessage },
    { icon: 'share', label: 'SNS/チャネル', value: r.marketing.snsChannels.length ? r.marketing.snsChannels.join('、') : homepageChecked ? '取得したページでは確認できず' : homepageMessage },
    { icon: 'campaign', label: 'プレスリリース', value: r.pressReleases?.length ? `${r.pressReleases.length}件を確認（PR TIMES）` : r.sourceStatus?.prtimes === 'ok' ? '取得した範囲でヒットなし' : r.sourceStatus?.prtimes === 'failed' ? 'PR TIMESを取得できず未確認' : '未確認' },
  ]
}

export default function ShodanNewPage() {
  const params = useParams<{ orgSlug: string }>()
  const orgSlug = String(params.orgSlug)
  const router = useRouter()
  const guard = useOrgSettingsGuard(orgSlug)
  const [owner, setOwner] = useState(guard.identity)
  const [unknown, setUnknown] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [confirmedId, setConfirmedId] = useState<string | null>(null)
  const attempt = useRef<'idle' | 'pending' | 'unknown' | 'confirmed' | 'limited'>('idle')
  const draft = useRef('')
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('input')
  const [tick, setTick] = useState(0)
  const [research, setResearch] = useState<CompanyResearch | null>(null)
  const [limitMessage, setLimitMessage] = useState<string | null>(null)
  const [limitAction, setLimitAction] = useState<{ href: string; label: string } | null>(null)
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)

  useEffect(() => {
    setOwner(guard.identity); setUrl(''); draft.current = ''; setPhase('input')
    setResearch(null); setConfirmedId(null)
    setLimitMessage(null); setLimitAction(null); setHasProfile(null)
    setUnknown(false); setOperationError(''); attempt.current = 'idle'
  }, [guard.identity])
  useEffect(() => {
    if (attempt.current === 'pending') {
      attempt.current = 'unknown'; setUnknown(true); setPhase('input')
      setOperationError('作成結果を確認できませんでした。重ねて作成せず、商談準備一覧をご確認ください。')
    }
  }, [guard.key])
  useEffect(() => {
    if (!guard.allowed) return
    const ticket = guard.begin('profile')
    if (!ticket) return
    shodanGet('/api/shodan/company-profile', orgSlug, { signal: ticket.signal })
      .then(d => { if (ticket.current()) setHasProfile(readOrgProfile('shodan', d).profile !== null) })
      .catch(e => { if (ticket.current()) { setHasProfile(null); if (e instanceof ShodanApiError && e.status === 401) guard.rejectAuthentication() } })
      .finally(() => ticket.end())
    return () => ticket.end()
  }, [guard.key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!guard.allowed || !confirmedId || owner !== guard.identity) return
    const ticket = guard.begin('navigation')
    if (!ticket) return
    const timer = setTimeout(() => {
      if (ticket.current()) {
        try { router.replace(`/shodan/${encodeURIComponent(orgSlug)}/p/${confirmedId}`) }
        catch { setOperationError('調査は完了しています。下のリンクから結果を開いてください。') }
      }
      ticket.end()
    }, 3400)
    return () => { clearTimeout(timer); ticket.end() }
  }, [guard.key, confirmedId, owner, orgSlug, router]) // eslint-disable-line react-hooks/exhaustive-deps

  // 調査中のティッカー送り
  useEffect(() => {
    if (phase !== 'researching') return
    setTick(0)
    const t = setInterval(() => setTick((s) => Math.min(s + 1, RESEARCH_TICKER.length - 1)), 2600)
    return () => clearInterval(t)
  }, [phase])

  const notifyUsage = () => window.dispatchEvent(new CustomEvent('shodan:usage-changed', { detail: { actor: guard.actor, organizationSlug: orgSlug } }))
  const run = async () => {
    if (!guard.active() || owner !== guard.identity || attempt.current !== 'idle') return
    const value = draft.current.trim()
    if (!value) { toast.error('URLを入力してください'); return }
    let target: URL
    try {
      target = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : 'https://' + value)
      if (value.length > 8192 || !['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error()
    } catch { setOperationError('有効な企業サイトのURLを入力してください。'); return }
    const ticket = guard.begin('create')
    if (!ticket) return
    attempt.current = 'pending'
    setLimitMessage(null); setLimitAction(null); setOperationError(''); setPhase('researching')
    try {
      const d = await shodanSend<{ id: string; status: string; research: CompanyResearch }>('/api/shodan/preparations', orgSlug, 'POST', { url: target.href }, { signal: ticket.signal })
      if (!ticket.current()) return
      attempt.current = 'confirmed'
      setConfirmedId(d.id); setResearch(d.research); setPhase('reveal'); notifyUsage()
    } catch (e) {
      if (!ticket.current()) return
      const definite = e instanceof ShodanApiError && ([400, 401, 403, 404, 413, 422, 429].includes(e.status) || e.status === 402 && e.code === 'LIMIT')
      attempt.current = e instanceof ShodanApiError && e.code === 'LIMIT' && e.status === 402 ? 'limited' : definite ? 'idle' : 'unknown'
      setUnknown(!definite); setPhase('input'); notifyUsage()
      if (e instanceof ShodanApiError && e.code === 'LIMIT') {
        setLimitMessage(e.message)
        setLimitAction(e.actionUrl && e.actionLabel ? { href: e.actionUrl, label: e.actionLabel } : null)
      } else setOperationError(definite && e instanceof Error ? e.message : '作成結果を確認できませんでした。重ねて作成せず、商談準備一覧をご確認ください。')
      if (e instanceof ShodanApiError && e.status === 401) guard.rejectAuthentication()
    } finally { ticket.end() }
  }

  if (guard.requiresLogin) return <div role="alert" className="p-6"><p>ログイン情報を確認できません。再度ログインしてください。</p><Link className="underline" href={`/auth/signin?callbackUrl=${encodeURIComponent(`/shodan/${encodeURIComponent(orgSlug)}/new`)}`}>ログイン情報を再確認する</Link></div>
  if (!guard.allowed || owner !== guard.identity) return <div role="status" className="p-6">認証情報を確認しています。</div>

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <PageHeader icon="rocket_launch" mood="point" title="新規 商談準備" subtitle="商談先企業のURLを入れるだけ。調査→課題仮説→提案資料まで自動で作成します。" />

      {operationError && <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p>{operationError}</p>{unknown && <Link className="mt-2 inline-block font-bold underline" href={`/shodan/${encodeURIComponent(orgSlug)}`}>商談準備一覧で作成結果を確認する</Link>}</div>}
      {confirmedId && <Link className="mb-4 inline-block font-bold underline" href={`/shodan/${encodeURIComponent(orgSlug)}/p/${confirmedId}`}>調査結果を開く</Link>}
      <AnimatePresence mode="wait">
        {phase === 'input' && (
          <motion.div key="input" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="relative rounded-3xl bg-white border border-purple-100 p-6 pt-8 shadow-sm overflow-hidden">
            <DoyaKun mood="point" size={96} className="!absolute -top-2 right-3" />
            <label htmlFor="shodan-new-url" className="block text-sm font-black text-slate-700 mb-2">商談先企業のURL</label>
            <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 focus-within:border-purple-400 px-4 py-3 transition-colors bg-white">
              {sym('language', 22)}
              <input id="shodan-new-url" value={url} maxLength={8192} onChange={(e) => { if (!guard.active()) return; draft.current = e.target.value; setUrl(e.target.value) }} onKeyDown={(e) => e.key === 'Enter' && run()}
                placeholder="例: https://www.example.co.jp" className="flex-1 font-bold outline-none" autoFocus />
            </div>
            {hasProfile === false && (
              <Link href={`/shodan/${encodeURIComponent(orgSlug)}/settings`}
                className="mt-3 flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 hover:bg-amber-100 transition-colors">
                {sym('info', 16)}自社情報が未登録です。先に登録すると提案精度UP →（このまま作成も可）
              </Link>
            )}
            {limitMessage && (
              <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-bold text-amber-900">{limitMessage}</p>
                {limitAction && <Link href={limitAction.href} className="mt-2 inline-flex items-center gap-1 text-sm font-black text-purple-700 underline">
                  {limitAction.label} {sym('arrow_forward', 16)}
                </Link>}
              </div>
            )}
            <motion.button data-testid="shodan-create" type="button" disabled={unknown || Boolean(limitMessage)} onClick={run} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
              className="mt-5 w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-lg shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
              {sym('bolt', 22)}{unknown ? '作成結果の確認が必要です' : limitMessage ? '今月の上限に達しています' : 'この企業の商談準備をつくる'}
            </motion.button>
            <p className="text-[11px] font-bold text-slate-400 mt-3 text-center">{unknown ? '作成結果が不明のため、新規作成を停止しています。一覧で結果をご確認ください。' : limitMessage ? '利用枠について、上の案内をご確認ください。' : '企業調査の完了まで30秒〜2分ほど。結果を待つ間はタブを開いたままお待ちください。'}</p>
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
                <p className="font-black text-emerald-700 text-lg">企業調査が完了しました</p>
                <p className="text-xs font-bold text-slate-400">調査結果をご確認いただけます。提案資料の利用条件は結果画面でご案内します。</p>
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
