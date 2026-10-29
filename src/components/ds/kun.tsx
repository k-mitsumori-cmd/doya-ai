'use client'
// ============================================
// ds/kun — ドヤくん（クマ）の絵と、小さな動き（全ツール共通の部品）
// ============================================
// 2026-10-29 本人の指示（メイン経由）:「キャラクターがいなくて全然面白くない」「アニメーションの部分は参考の方がめちゃくちゃ良い」。
// - 場面に合ったポーズの絵（public/character/<pose>-512.webp か、ツールの 3D のクマ public/ui-renewal/mascots/<tool>.webp）を出す。
// - 動きは、位置と透明度だけ。止まるときは減速する曲線（cubic-bezier(0.22,1,0.36,1)）。
//   入ってくる: 下から少し上がって現れる（500ms）。作業中: 小さく上下する。考える: ゆっくり傾く。喜ぶ: 小さく跳ねる。
// - 動きを減らす設定（prefers-reduced-motion）では、絵だけを出す（動かさない）。
// - 展示会の待ち画面など、ほかの画面でも同じ部品を使う（ポーズの絵が足りないときは、作る絵の一覧に足す）。
// ⚠️ 絵文字は使わない。絵は今ある絵だけ。新しい絵は Codex の内蔵の画像生成で作る（有料の API は使わない）。
import styles from './kun.module.css'
import { kunSrc, kunSrcSet, TOOL_KUN, toolOfPath } from './kun-src'
import { usePathname } from 'next/navigation'
export { kunSrc, kunSrcSet, TOOL_KUN, toolOfPath } from './kun-src'

/** public/character にあるポーズ。新しいポーズは、絵を置いてから（scripts/kun-import-pose.py）ここに名前を足す */
export type KunPose =
  | 'hello' | 'point' | 'working' | 'thinking' | 'ponder' | 'focus' | 'present' | 'success' | 'thumbsup' | 'love'
  | 'jump' | 'launch' | 'finish' | 'run' | 'surprise' | 'sleep' | 'ramen' | 'throw' | 'bug' | 'error'
  // 2026-10-29 に Codex の画像生成で足した新しいポーズ（場面に合う道具を持つ）
  | 'mic' | 'calendar' | 'write' | 'survey' | 'camera' | 'search' | 'chart' | 'money' | 'clock' | 'handshake' | 'empty'
  // 2026-10-29 に Codex の画像生成で足した絵: 小さく表示する用・部署長・状態・数字のカード・ツール固有
  | 'mini-hello' | 'mini-point' | 'mini-working'
  | 'lead-marketing' | 'lead-sales' | 'lead-hr' | 'lead-admin'
  | 'waiting' | 'report' | 'todo' | 'locked'
  | 'kpi-sales' | 'kpi-incoming' | 'kpi-spend' | 'kpi-deals' | 'kpi-hiring'
  | 'tool-banner' | 'tool-adimage' | 'tool-persona' | 'tool-asklink' | 'tool-popup' | 'tool-tenjikai' | 'tool-aishodan' | 'tool-doyalist' | 'tool-promane' | 'tool-shanai' | 'tool-income'

/** 小さな動き。idle: 入るだけ / work: 作業中（上下） / think: 考え中（傾く） / cheer: できた（跳ねる） */
export type KunAct = 'idle' | 'work' | 'think' | 'cheer'

export function DoyaKun({ pose, act = 'idle', size = 96, label, say, className }: {
  pose: KunPose | `mascot:${string}`
  act?: KunAct
  /** 横幅（px） */
  size?: number
  /** 読み上げの言葉。飾りのときは渡さない（alt=""） */
  label?: string
  /** 吹き出しのひと言（短く。無ければ出さない） */
  say?: string
  className?: string
}) {
  return (
    <span className={`${styles.kun} ${className ?? ''}`} data-act={act} style={{ ['--kun-size' as string]: `${size}px` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={kunSrc(pose)} srcSet={kunSrcSet(pose)} sizes={`${size}px`} alt={label ?? ''} aria-hidden={label ? undefined : true} width={size} height={size} className={styles.img} draggable={false} loading="lazy" decoding="async" />
      {say ? <span className={styles.say}>{say}</span> : null}
    </span>
  )
}

/** 空・エラー・権限なし・準備中の種類ごとの、ドヤくんのポーズ（線のさし絵の代わり。2026-10-29 本人の承認「本物のドヤくんに替える」） */
export const EMPTY_KUN: Record<'not-generated' | 'zero' | 'no-results' | 'error' | 'forbidden' | 'preparing', { pose: KunPose; act: KunAct }> = {
  'not-generated': { pose: 'point', act: 'idle' },
  zero: { pose: 'empty', act: 'idle' },
  'no-results': { pose: 'search', act: 'think' },
  error: { pose: 'error', act: 'idle' },
  forbidden: { pose: 'locked', act: 'idle' },
  preparing: { pose: 'working', act: 'work' },
}

/** 空の状態の絵。ツールの画面（URL の最初の段がツール）で、中身が空・まだ作っていないときは、そのツール固有の絵を出す。
 *  エラー・権限なし・検索の結果なし・準備中は、はっきり伝わる共通の絵のまま */
export function useEmptyKun(kind: keyof typeof EMPTY_KUN): { pose: KunPose; act: KunAct } {
  const path = usePathname()
  if (kind === 'zero' || kind === 'not-generated') {
    const pose = TOOL_KUN[toolOfPath(path)]
    if (pose) return { pose, act: 'idle' }
  }
  return EMPTY_KUN[kind]
}
