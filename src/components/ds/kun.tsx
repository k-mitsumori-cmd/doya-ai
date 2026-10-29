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

/** public/character にあるポーズ（2026-10-29 時点の全部） */
export type KunPose =
  | 'hello' | 'point' | 'working' | 'thinking' | 'ponder' | 'focus' | 'present' | 'success' | 'thumbsup' | 'love'
  | 'jump' | 'launch' | 'finish' | 'run' | 'surprise' | 'sleep' | 'ramen' | 'throw' | 'bug' | 'error'

/** 小さな動き。idle: 入るだけ / work: 作業中（上下） / think: 考え中（傾く） / cheer: できた（跳ねる） */
export type KunAct = 'idle' | 'work' | 'think' | 'cheer'

export function kunSrc(pose: KunPose | `mascot:${string}`): string {
  if (pose.startsWith('mascot:')) return `/ui-renewal/mascots/${pose.slice('mascot:'.length).replace(/[^a-z-]/g, '')}.webp`
  return `/character/${pose}-512.webp`
}

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
      <img src={kunSrc(pose)} alt={label ?? ''} aria-hidden={label ? undefined : true} width={size} height={size} className={styles.img} draggable={false} />
      {say ? <span className={styles.say}>{say}</span> : null}
    </span>
  )
}
