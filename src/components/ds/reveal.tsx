'use client'
// ============================================
// ds/Reveal — 骨組み（Skeleton）から中身へ、重ねて薄く入れ替える（M9）
// ============================================
// 読み込みが終わったとき、骨組みを消してから中身を出すと、一瞬の空白と高さのがたつきが出る。
// ここでは骨組みと中身を同じ場所に重ね、骨組みは薄くなって消え、中身は薄く現れる。
// - 重ねるので、高さは「高いほう」のまま（中身が骨組みより低くなっても、入れ替えの間は縮まない。CLS を増やさない）
// - 動かすのは opacity だけ。動きを減らす設定では、すぐ入れ替える
// - 骨組みが出ていなかった（読み込みが速かった）ときは、重ねずに中身をそのまま出す
// 使い方: <Reveal loading={loading} skeleton={<Skeleton />}>{content}</Reveal>
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePrefersReducedMotion } from './motion'
import styles from './reveal.module.css'

const LEAVE_MS = 280

export function Reveal({ loading, skeleton, children }: { loading: boolean; skeleton: ReactNode; children: ReactNode }) {
  const reduced = usePrefersReducedMotion()
  // 骨組みを実際に出したか（出していないなら、薄く入れ替える相手がいない）
  const shown = useRef(false)
  if (loading && skeleton) shown.current = true
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (loading) { setLeaving(false); return }
    if (!shown.current) return
    shown.current = false
    if (reduced) return
    setLeaving(true)
    const t = setTimeout(() => setLeaving(false), LEAVE_MS + 40)
    return () => clearTimeout(t)
  }, [loading, reduced])

  if (loading) return <>{skeleton}</>
  if (!leaving) return <>{children}</>
  return (
    <div className={styles.stack}>
      <div className={styles.content}>{children}</div>
      <div className={styles.skeleton} aria-hidden>{skeleton}</div>
    </div>
  )
}
