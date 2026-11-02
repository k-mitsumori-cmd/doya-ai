'use client'

// ドヤバナーAI「作り方は2つ」の入口（ゼロから作る／見本から作る）
// 2026-11-01 本人の指摘「ゼロから作る機能と見本から作るの差がわからない」。
// - 2つの画面の上に同じ部品を出し、いま開いている方に印を付ける。もう一方へはここから移る。
// - 書いてあることは、実際の動きと合わせてある。
//   ゼロから作る: /banner/dashboard/create → /api/banner/generate（用途・業種・サイズ・キーワードから新しく考える）
//   見本から作る: /banner/dashboard → /api/banner/test/generate（選んだ見本の画像を参照して、文字だけ入れ替える）
//   どちらも既定は3案、今月の枚数の枠（serviceId='banner'）は共通。
// ⚠️ ドヤパワーの量はここに直書きしない（旗が off の人には出さない決まりのため。画面の生成ボタンの札が出す）。
// ⚠️ 絵文字は使わない。絵は ds/kun のドヤくん（すでにあるポーズ）。
import Link from 'next/link'
import { DoyaKun, type KunPose } from '@/components/ds'
import { BANNER_DASHBOARD_BASE } from '@/lib/banner/nav'
import styles from './BannerModeChooser.module.css'

export type BannerMode = 'scratch' | 'template'

const MODES: {
  id: BannerMode
  href: string
  title: string
  pose: KunPose
  summary: string
  rows: { label: string; text: string }[]
}[] = [
  {
    id: 'scratch',
    href: BANNER_DASHBOARD_BASE + '/create',
    title: 'ゼロから作る',
    pose: 'write',
    summary: '見本を使わず、AIが新しいデザインを考えます。',
    rows: [
      { label: '入れるもの', text: '用途・業種・サイズ・キーワード' },
      { label: 'できる物', text: '見本にとらわれない、新しいデザインの3案' },
      { label: '向いている人', text: '目的は決まっていて、見た目のお手本は無い人' },
    ],
  },
  {
    id: 'template',
    href: BANNER_DASHBOARD_BASE,
    title: '見本から作る',
    pose: 'point',
    summary: '気に入った見本を1つ選び、文字だけを入れ替えます。',
    rows: [
      { label: '入れるもの', text: '見本を1つ選び、バナーに入れる文字' },
      { label: 'できる物', text: '選んだ見本と同じ雰囲気の3案' },
      { label: '向いている人', text: '「この感じにしたい」という見本がある人' },
    ],
  },
]

export default function BannerModeChooser({ current }: { current: BannerMode }) {
  return (
    <section className={styles.wrap} aria-labelledby="banner-mode-title">
      <h2 id="banner-mode-title" className={styles.heading}>バナーの作り方は2つあります。どちらで作りますか。</h2>
      <div className={styles.grid}>
        {MODES.map((m) => {
          const here = m.id === current
          return (
            <Link
              key={m.id}
              href={m.href}
              className={styles.card}
              data-current={here ? 'true' : undefined}
              aria-current={here ? 'page' : undefined}
            >
              <span className={styles.top}>
                <DoyaKun pose={m.pose} size={56} />
                <span className={styles.head}>
                  <span className={styles.title}>{m.title}</span>
                  <span className={styles.summary}>{m.summary}</span>
                </span>
              </span>
              <dl className={styles.rows}>
                {m.rows.map((r) => (
                  <div key={r.label} className={styles.row}>
                    <dt>{r.label}</dt>
                    <dd>{r.text}</dd>
                  </div>
                ))}
              </dl>
              <span className={styles.state}>{here ? 'いま開いている画面です' : 'この作り方に移る'}</span>
            </Link>
          )
        })}
      </div>
      <p className={styles.note}>どちらも、1回で3案ができます。今月の枚数の枠は共通です。</p>
    </section>
  )
}
