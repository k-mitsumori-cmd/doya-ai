'use client'
// ============================================
// 前のツールで作った物を、次のツールの材料にする提案（提案リスト (7)。NOTICE-PARTS §6.2）
// ============================================
// 今は「見積書 → スライド」だけ。スライドの作成・一覧の画面を開いたとき、1日以内に作った見積書があれば、知らせのカードで提案する。
// - カードを出すだけの段階では、サーバーで見積書を読まない（統括の点検 9）。
// - 「材料にする」を押したときだけ、POST /api/doyaslide/projects/from-quote に { kind, id } を送る。題や行き先は送らない（統括の点検 5）。
// - 作ったプロジェクトへ移る行き先は、サーバーが返した id から作り、形を確かめる（slideProjectPath）。
// - 同じ見積書について出すのは1回だけ（once。見た記録の id に見積書の id を使う）。
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { freshestArtifact, slideProjectPath, type RecentArtifact } from '@/lib/notice/artifacts'
import { useNotice } from './NoticeProvider'
import styles from './notice.module.css'

/** 提案を出す画面（スライドの作成と一覧）。料金の画面やプロジェクトの中では出さない */
export function isHandoffTargetPath(pathname: string): boolean {
  return pathname === '/doyaslide/new' || pathname === '/doyaslide/projects' || pathname === '/doyaslide'
}

function HandoffActions({ artifact, close }: { artifact: RecentArtifact; close: (done: boolean) => void }) {
  const router = useRouter()
  const { notify } = useNotice()
  const [busy, setBusy] = useState(false)
  const use = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/doyaslide/projects/from-quote', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: artifact.kind, id: artifact.id }),
      })
      const data = await res.json().catch(() => null) as { projectId?: unknown; error?: string; code?: string } | null
      // 201 は新しく作った資料、200 は同じ見積書から前に作った資料（同じ見積書から何度押しても1つだけ）
      const path = res.status === 201 || res.status === 200 ? slideProjectPath(data?.projectId) : null
      if (path) { close(true); router.push(path); return }
      if (res.status === 403 && data?.code === 'LIMIT_REACHED') notify({ tone: 'error', title: '今月のスライドの上限に達しています', sub: 'プランを見直すと、続けて作れます', action: { label: 'プランを見る', href: '/doyaslide/pricing' } })
      else if (res.status === 404) notify({ tone: 'error', title: '見積書が見つかりませんでした', sub: '消されたか、ほかの組織の見積書です' })
      else notify({ tone: 'error', title: '材料にできませんでした', sub: data?.error || '時間をおいて、もう一度お試しください' })
      close(true)
    } catch {
      notify({ tone: 'error', title: '材料にできませんでした', sub: '通信が切れました。もう一度お試しください' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className={styles.actions}>
      <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => close(true)} disabled={busy}>使わない</button>
      <button type="button" className={styles.btn} onClick={() => void use()} disabled={busy}>{busy ? '作っています…' : '材料にする'}</button>
    </span>
  )
}

export default function HandoffSuggest() {
  const { enabled, ready, push, recentArtifacts } = useNotice()
  const pathname = usePathname() || '/'
  useEffect(() => {
    if (!enabled || !ready || !isHandoffTargetPath(pathname)) return
    const a = freshestArtifact(recentArtifacts(), 'quote', Date.now())
    if (!a) return
    push({
      id: `handoff:quote:${a.id}`, kind: 'hint', once: true, pose: 'point', eyebrow: 'さっき開いた見積書',
      title: '見積書を、スライドの材料に使いますか？',
      body: 'さっき開いた見積書の品目と金額から、提案スライドの構成を作ります。相手の会社名や金額は、外の検索には使いません。',
      content: (close) => <HandoffActions artifact={a} close={close} />,
    })
  }, [enabled, ready, pathname, push, recentArtifacts])
  return null
}
