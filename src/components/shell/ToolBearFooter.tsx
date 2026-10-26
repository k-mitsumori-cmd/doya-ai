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
import { useState } from 'react'
import { useInViewOnce } from '@/components/ds/motion'
import styles from './ToolBearFooter.module.css'

type Motion = 'hop' | 'stamp' | 'wave' | 'walk' | 'think'

const BEAR_FOOTER: Record<string, { motion: Motion; line: string }> = {
  // マーケティング
  aio: { motion: 'walk', line: 'AIに見つけてもらいましょう' },
  seo: { motion: 'walk', line: '記事づくりをお手伝いします' },
  banner: { motion: 'hop', line: 'いいバナーができそうです' },
  adimage: { motion: 'hop', line: '広告の画像をつくりましょう' },
  persona: { motion: 'wave', line: 'お客さまの姿を描きましょう' },
  interview: { motion: 'wave', line: 'お話をきれいにまとめます' },
  asklink: { motion: 'walk', line: '質問をすぐに集めましょう' },
  popup: { motion: 'hop', line: 'ポップアップで声をかけましょう' },
  tenjikai: { motion: 'walk', line: '展示会の準備を進めましょう' },
  // 営業
  sfa: { motion: 'hop', line: '次の一手を準備しましょう' },
  shodan: { motion: 'think', line: '商談の準備はおまかせください' },
  aishodan: { motion: 'think', line: '商談の練習をしましょう' },
  cunning: { motion: 'think', line: '話す要点をまとめておきます' },
  doyalist: { motion: 'walk', line: 'リストづくりをお手伝いします' },
  doyaslide: { motion: 'walk', line: '資料づくりをお手伝いします' },
  // 採用・人材管理
  hr: { motion: 'wave', line: 'チームの様子を見守っています' },
  mensetsu: { motion: 'wave', line: '面接の準備をいっしょに' },
  shanai: { motion: 'wave', line: '社内の声を集めましょう' },
  kintai: { motion: 'stamp', line: '今日も打刻おつかれさまです' },
  // 経理・バックオフィス
  quote: { motion: 'hop', line: '見積もりをすぐに作れます' },
  promane: { motion: 'stamp', line: '進み具合をいっしょに確かめます' },
  income: { motion: 'hop', line: '入金の確認、おつかれさまです' },
  expense: { motion: 'stamp', line: '支払いの予定もばっちりです' },
}

export default function ToolBearFooter({ serviceId }: { serviceId: string }) {
  const conf = BEAR_FOOTER[serviceId]
  const { ref, seen } = useInViewOnce<HTMLDivElement>('0px 0px -40px 0px')
  // 押すたびに key を変えて、動きをはじめからもう一度出す
  const [round, setRound] = useState(0)
  if (!conf) return null
  return (
    <div ref={ref} className={styles.footer} data-motion={conf.motion} data-seen={seen ? 'true' : undefined}>
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
