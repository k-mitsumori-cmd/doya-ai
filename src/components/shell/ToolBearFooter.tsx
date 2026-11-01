'use client'
// ============================================
// ツールの画面の一番下に出すドヤくん（短いアニメーション）
// ============================================
// 2026-10-27 ユーザー「すべてのツールの一番下のところに、クマ（ドヤくん）のアニメーションを入れてほしい」。
// - ToolFrame の一番下に1つだけ置く（各ツールの画面は触らない）
// - 絵はメニューのアイコンと同じ全身の絵（ブランチ claude/bear-tool-icons-ec9201 の public/shell/bear/<id>.webp）を
//   public/shell/bear-footer/ に写したもの。メニューの絵を描き直したら、ここにも写し直す
// - 動きはツールに合わせて5種類（跳ねる・押す・手を振る・歩いてくる・考える）。画面に入ったとき1回だけ動き、絵を押すともう一度動く
// - 動きは位置と回転だけ。止まる環境でも絵は見える（F-12）。動きを減らす設定では動かさない
// - 絵の無いツール（経営ホームなど）では何も出さない
// - 吹き出しの一言は13文字まで（375px でも1行に収まる長さ。Safari は文節での折り返しに対応しないため、折り返させない）
// - 読み込みの間は見えないまま場所だけ取り、上の中身の高さが落ち着いてから見せる（読み込みで押し下げられても、ずれとして数えさせない）
import { useEffect, useState } from 'react'
import { useInViewOnce } from '@/components/ds/motion'
import styles from './ToolBearFooter.module.css'

type Motion = 'hop' | 'stamp' | 'wave' | 'walk' | 'think'

const BEAR_FOOTER: Record<string, { motion: Motion; line: string }> = {
  // マーケティング
  aio: { motion: 'walk', line: 'AIでの見え方を整えます' },
  seo: { motion: 'walk', line: '記事づくりを手伝います' },
  banner: { motion: 'hop', line: 'いいバナーができそうです' },
  adimage: { motion: 'hop', line: '広告の画像をつくります' },
  persona: { motion: 'wave', line: 'お客さまの姿を描きます' },
  interview: { motion: 'wave', line: 'お話をきれいにまとめます' },
  asklink: { motion: 'walk', line: '質問をすぐに集めます' },
  popup: { motion: 'hop', line: 'ひと声かけてみましょう' },
  tenjikai: { motion: 'walk', line: '展示会の準備を進めます' },
  // 営業
  sfa: { motion: 'hop', line: '次の一手を考えましょう' },
  shodan: { motion: 'think', line: '商談の準備はおまかせを' },
  aishodan: { motion: 'think', line: '商談の練習をしましょう' },
  cunning: { motion: 'think', line: '話す要点をまとめます' },
  doyalist: { motion: 'walk', line: 'リストづくりを手伝います' },
  doyaslide: { motion: 'walk', line: '資料づくりを手伝います' },
  // 採用・人材管理
  hr: { motion: 'wave', line: 'チームを見守っています' },
  mensetsu: { motion: 'wave', line: '面接の準備をいっしょに' },
  shanai: { motion: 'wave', line: '社内の声を集めましょう' },
  kintai: { motion: 'stamp', line: '打刻おつかれさまです' },
  // 経理・バックオフィス
  quote: { motion: 'hop', line: '見積もりをすぐ作れます' },
  promane: { motion: 'stamp', line: '進み具合を確かめます' },
  income: { motion: 'hop', line: '入金の確認おつかれさまです' },
  expense: { motion: 'stamp', line: '支払いの予定を見守ります' },
}

export default function ToolBearFooter({ serviceId }: { serviceId: string }) {
  const conf = BEAR_FOOTER[serviceId]
  // 絵はいつも見えているので、画面に入らないまま動きを出す救済（fallback）はしない（0）。画面の外で動いても見えないため
  const { ref, seen } = useInViewOnce<HTMLDivElement>('0px 0px -40px 0px', 0)
  // 押すたびに key を変えて、動きをはじめからもう一度出す
  const [round, setRound] = useState(0)
  // 上の中身（直前の兄弟の要素）の高さが 800ms 変わらなかったら「落ち着いた」とする。遅くても 8 秒で見せる
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const el = ref.current?.previousElementSibling
    if (!el || typeof ResizeObserver === 'undefined') { setSettled(true); return }
    let t = setTimeout(() => setSettled(true), 800)
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => setSettled(true), 800) })
    ro.observe(el)
    const cap = setTimeout(() => setSettled(true), 8000)
    return () => { ro.disconnect(); clearTimeout(t); clearTimeout(cap) }
  }, [ref, conf])
  if (!conf) return null
  return (
    <div ref={ref} className={styles.footer} data-motion={conf.motion} data-seen={seen && settled ? 'true' : undefined} data-settled={settled ? 'true' : undefined}>
      <div className={styles.ground} aria-hidden />
      <button
        type="button"
        className={styles.stage}
        onClick={() => setRound((n) => n + 1)}
        aria-label="ドヤくんをもう一度動かす"
      >
        <span key={round} className={styles.actor}>
          <span className={styles.fx} aria-hidden>
            <i /><i /><i />
          </span>
          {/* 小さな固定の絵なので next/image の変換は通さない（幅と高さを決めて、読み込みでずれないようにする） */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/shell/bear-footer/${serviceId}.webp`}
            width={112}
            height={112}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className={styles.bear}
          />
          <span className={styles.shadow} aria-hidden />
        </span>
      </button>
      <p className={styles.bubble}>{conf.line}</p>
    </div>
  )
}
