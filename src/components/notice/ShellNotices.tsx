'use client'
// ============================================
// 共通の枠から出す知らせ（優先 A のうち、ツールに手を入れずに出せるもの）
// ============================================
// (1) 初回のようこそ3枚 / (3)(6) ツールを初めて開いたときの「できること」3点
// (10) 新機能のお知らせ / (18) ドヤパワーの残りが2割
// ⚠️ NoticeProvider の中だけで動く（旗が off なら ShellGate がこの部品を置かない）。
// ⚠️ 出す・出さないの決まり（順番・作業中・once）は queue.ts。ここは「何を足すか」だけ。
import { usePathname } from 'next/navigation'
import { useContext, useEffect, useRef } from 'react'
import { ALL_SHELL_TOOLS, type ShellTool } from '@/components/shell/tools'
import { ShellPowerContext } from '@/components/shell/power'
import { getServiceById } from '@/lib/services'
import { activeAnnouncements } from '@/lib/notice/announcements'
import { useNotice } from './NoticeProvider'

export const WELCOME_ID = 'welcome:v1'

function toolForPath(pathname: string): ShellTool | undefined {
  return ALL_SHELL_TOOLS.find((t) => {
    if (t.id === 'home') return false
    const base = t.href.split('?')[0].replace(/\/$/, '')
    return pathname === base || pathname.startsWith(`${base}/`)
  })
}

/** 月ごとに1回（日本時間の年月） */
function monthKey(d: Date): string {
  const j = new Date(d.getTime() + 9 * 3_600_000)
  return `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function ShellNotices() {
  const { enabled: on, ready, push, hasSeen } = useNotice()
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
        { pose: 'jump', eyebrow: 'ようこそ 3/3', title: 'わからない所は、ドヤくんが知らせます', body: '初めて開いたツールでは、できることを3つ出します。閉じた知らせは、次から出ません。' },
      ],
      primary: { label: 'はじめる' },
    })
    for (const a of welcomed ? activeAnnouncements(new Date()) : []) {
      push({ id: a.id, kind: 'feature', once: true, pose: a.pose ?? 'jump', eyebrow: '新機能', title: a.title, body: a.body,
        primary: a.href ? { label: '試してみる', href: a.href } : { label: 'わかった' }, secondary: { label: 'あとで', done: false } })
    }
  }, [enabled, push, hasSeen])

  // (3)(6) ツールを初めて開いた・切り替えたとき、そのツールでできることを3つ
  useEffect(() => {
    if (!enabled) return
    const tool = toolForPath(pathname)
    if (!tool) return
    const features = getServiceById(tool.id)?.features?.slice(0, 3) ?? []
    if (!features.length) return
    push({ id: `tool-intro:${tool.id}`, kind: 'hint', once: true, pose: 'point', eyebrow: `${tool.name} でできること`, title: tool.lead || tool.hint, points: features, primary: { label: '使ってみる' } })
  }, [enabled, pathname, push])

  // (18) ドヤパワーの残りが2割以下（その月に1回）
  const remaining = power.balance?.remaining
  const limit = power.balance?.limit
  useEffect(() => {
    if (!enabled || remaining == null || !limit || remaining / limit > 0.2) return
    push({
      id: `power-low:${monthKey(new Date())}`, kind: 'hint', tone: 'warn', once: true, pose: 'focus', eyebrow: 'ドヤパワー',
      title: `ドヤパワーの残りが ${remaining.toLocaleString('ja-JP')} になりました`,
      body: `上限 ${limit.toLocaleString('ja-JP')} の2割を切りました。毎朝、少しずつ戻ります。足りないときは、プランで増やせます。`,
      primary: { label: 'プランを見る', href: '/pricing' }, secondary: { label: '閉じる' },
    })
  }, [enabled, remaining, limit, push])

  return null
}
