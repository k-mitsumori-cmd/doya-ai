'use client'
// ============================================
// 共通の枠から出す知らせ（優先 A のうち、ツールに手を入れずに出せるもの）
// ============================================
// (1) 初回のようこそ3枚 / (3)(6) ツールを初めて開いたときの「できること」3点
// (10) 新機能のお知らせ / (18) ドヤパワーの残りが2割
// (2) はじめの手順チェックリスト / (37) 通信が切れたときの知らせ / (36) 調整中のツール / (35) お支払いがうまくいかなかったとき
// ⚠️ NoticeProvider の中だけで動く（旗が off なら ShellGate がこの部品を置かない）。
// ⚠️ 出す・出さないの決まり（順番・作業中・once）は queue.ts。ここは「何を足すか」だけ。
import { usePathname } from 'next/navigation'
import { useContext, useEffect, useRef } from 'react'
import { ALL_SHELL_TOOLS, type ShellTool } from '@/components/shell/tools'
import { ShellPowerContext } from '@/components/shell/power'
import { useAccountCompany } from '@/components/shell/company-context'
import { getServiceById } from '@/lib/services'
import { activeAnnouncements } from '@/lib/notice/announcements'
import { useNotice } from './NoticeProvider'
import { loadUpsellInfo } from '@/components/pricing/UpsellActions'

export const WELCOME_ID = 'welcome:v1'
export const CHECKLIST_ID = 'checklist:v1'

/** はじめの手順。済んだかどうかは、この端末で分かることだけで決める（DB は読まない） */
function startSteps(company: ReturnType<typeof useAccountCompany>): { label: string; done: boolean; href?: string }[] {
  const has = (key: string, test: (v: string) => boolean) => { try { const v = window.localStorage.getItem(key); return v ? test(v) : false } catch { return false } }
  return [
    { label: '会社を登録する', done: Boolean(company), href: '/home' },
    { label: 'ツールを1つ使ってみる', done: has('doya-shell-recent-v1', (v) => /"[a-z]/.test(v)), href: '/home' },
    { label: 'ドヤくんに仕事を頼む（経営ホーム）', done: has('doya-home-agent:v1', () => true), href: '/home' },
  ]
}

function toolForPath(pathname: string): ShellTool | undefined {
  return ALL_SHELL_TOOLS.find((t) => {
    if (t.id === 'home') return false
    const base = t.href.split('?')[0].replace(/\/$/, '')
    return pathname === base || pathname.startsWith(`${base}/`)
  })
}

/** 日ごとに1回（日本時間の年月日） */
function dayKey(d: Date): string {
  const j = new Date(d.getTime() + 9 * 3_600_000)
  return j.toISOString().slice(0, 10)
}

/** 月ごとに1回（日本時間の年月） */
function monthKey(d: Date): string {
  const j = new Date(d.getTime() + 9 * 3_600_000)
  return `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function ShellNotices() {
  const { enabled: on, ready, push, hasSeen, notify } = useNotice()
  const company = useAccountCompany()
  // 見た記録を読み終えてから足す
  const enabled = on && ready
  const pathname = usePathname() || '/'
  const power = useContext(ShellPowerContext)
  const started = useRef(false)

  // (1) ようこそ（最初に枠を開いたとき）と (10) 新機能
  useEffect(() => {
    if (!enabled || started.current) return
    started.current = true
    // ようこそをまだ見ていない人には、新機能を出さない（はじめての人に古いお知らせは要らない。ようこそより先に出てしまうのも防ぐ）
    const welcomed = hasSeen(WELCOME_ID)
    push({
      id: WELCOME_ID, kind: 'hint', once: true, eyebrow: 'ようこそ', title: '',
      pages: [
        { pose: 'hello', eyebrow: 'ようこそ', title: 'ドヤAI へようこそ。ドヤくんが案内します', body: '1つの契約で、すべてのツールを使えます。作った物は、ほかのツールでも使えます。' },
        { pose: 'point', eyebrow: 'ようこそ 2/3', title: 'まずは経営ホームから', body: '会社の数字と、今日やることが並びます。左のメニュー（スマホは下のタブ）から、ほかのツールへ移れます。' },
        { pose: 'jump', eyebrow: 'ようこそ 3/3', title: 'わからない所は、ドヤくんが知らせます', body: '初めて開いたツールでは、できることを3つ出します。出すのは1日1つまでで、残りはメニューの「お知らせ」から開けます。' },
      ],
      primary: { label: 'はじめる' },
    })
    // (2) はじめの手順。ようこそのあとに出し、全部済んでいれば出さない
    const steps = startSteps(company)
    if (steps.some((x) => !x.done)) {
      push({ id: CHECKLIST_ID, kind: 'hint', once: true, pose: 'point', eyebrow: 'はじめの手順', title: 'この3つで、ドヤAI の使い方がつかめます',
        checklist: steps, primary: { label: 'わかった' } })
    }
    for (const a of welcomed ? activeAnnouncements(new Date()) : []) {
      push({ id: a.id, kind: 'feature', once: true, paced: true, pose: a.pose ?? 'jump', eyebrow: '新機能', title: a.title, body: a.body,
        primary: a.href ? { label: '試してみる', href: a.href } : { label: 'わかった' }, secondary: { label: 'あとで', done: false } })
    }
  }, [enabled, push, hasSeen, company])

  // (35) お支払いがうまくいかなかったとき（past_due・unpaid）。文と行き先は新料金の正本（/api/pricing/billing の subscription.view）だけが持つ。
  // ⚠️ 新料金の旗（NEW_PRICING_ROLLOUT）が off なら 404 になるので、何も出さない。tone が bad のときだけ、その日に1回。
  // 支払いは大事なので、知らせの量が「エラーだけ」でも出す（kind: error）
  useEffect(() => {
    if (!enabled) return
    let live = true
    void fetch('/api/pricing/billing', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { subscription?: { view?: { tone?: string; title?: string; body?: string; action?: { label: string; href: string } | null } } | null } | null) => {
        const v = data?.subscription?.view
        if (!live || !v || v.tone !== 'bad' || !v.title) return
        push({ id: `billing:${v.title}:${dayKey(new Date())}`, kind: 'error', tone: 'warn', once: true, pose: 'focus', eyebrow: 'お支払い',
          title: v.title, body: v.body || undefined, primary: v.action ? { label: v.action.label, href: v.action.href } : { label: 'わかった' }, secondary: v.action ? { label: 'あとで', done: false } : undefined })
      })
      .catch(() => { /* 読めなくても画面はそのまま */ })
    return () => { live = false }
  }, [enabled, push])

  // (37) 通信が切れたとき。作業中でも出す（エラーと同じ扱い）。つながったらトーストで知らせる
  useEffect(() => {
    if (!enabled) return
    const off = () => push({ id: 'offline', kind: 'error', tone: 'warn', pose: 'focus', eyebrow: '通信が切れました',
      title: 'インターネットにつながっていません', body: '入力した内容は、この画面に残っています。つながったら、続きから進められます。', primary: { label: 'わかった' } })
    const back = () => notify({ tone: 'info', title: 'インターネットにつながりました', sub: '続きから進められます', durationMs: 3000 })
    window.addEventListener('offline', off); window.addEventListener('online', back)
    if (typeof navigator !== 'undefined' && navigator.onLine === false) off()
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', back) }
  }, [enabled, push, notify])

  // (3)(6) ツールを初めて開いた・切り替えたとき、そのツールでできることを3つ
  useEffect(() => {
    if (!enabled) return
    const tool = toolForPath(pathname)
    if (!tool) return
    const service = getServiceById(tool.id)
    // (36) 調整中のツール（services.ts の status: 'maintenance'）を開いたら、その日に1回知らせる。エラーと同じ扱いで先に出す
    if (service?.status === 'maintenance') {
      push({ id: `maintenance:${tool.id}:${dayKey(new Date())}`, kind: 'error', tone: 'warn', once: true, pose: 'focus', eyebrow: '調整中のツール',
        title: `${tool.name} は、いま調整中です`, body: '一部の機能が動かないことがあります。作ったものの確認と編集は、そのままできます。直ったら、新機能のお知らせで知らせます。',
        primary: { label: 'わかった' } })
    }
    const features = service?.features?.slice(0, 3) ?? []
    if (!features.length) return
    push({ id: `tool-intro:${tool.id}`, kind: 'hint', once: true, paced: true, hideWithBand: true, pose: 'point', eyebrow: `${tool.name} でできること`, title: tool.lead || tool.hint, points: features, primary: { label: '使ってみる' } })
  }, [enabled, pathname, push])

  // (18) ドヤパワーの残りが2割以下（その月に1回）
  const remaining = power.balance?.remaining
  const limit = power.balance?.limit
  useEffect(() => {
    if (!enabled || remaining == null || !limit || remaining / limit > 0.2) return
    // 新料金の旗が on（upsell が読める）なら、PowerOutNotices が powerOutView で出すので、ここは出さない
    let live = true
    void loadUpsellInfo().then((info) => { if (live && !info) push({
      id: `power-low:${monthKey(new Date())}`, kind: 'hint', tone: 'warn', once: true, pose: 'focus', eyebrow: 'ドヤパワー',
      title: `ドヤパワーの残りが ${remaining.toLocaleString('ja-JP')} になりました`,
      body: `上限 ${limit.toLocaleString('ja-JP')} の2割を切りました。毎朝、少しずつ戻ります。足りないときは、プランで増やせます。`,
      primary: { label: 'プランを見る', href: '/pricing' }, secondary: { label: '閉じる' },
    }) })
    return () => { live = false }
  }, [enabled, remaining, limit, push])

  return null
}
