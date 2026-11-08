'use client'
// ドヤくんの紹介ページの中身。絵は ds/kun（public/character）の今ある絵だけを使う
// プロフィールの中身は 2026-11-08 本人の指示（喜多方ラーメン・格闘技と卓球・ダースチョーク・チキータ）
import Link from 'next/link'
import { DoyaKun, type KunPose } from '@/components/ds/kun'
import styles from './doyakun.module.css'

type Scene = { pose: KunPose; title: string; text: string }

const SCENES: Scene[] = [
  { pose: 'point', title: '使い方を案内します', text: 'はじめてのツールでも、次に押すところを指さしで教えます。' },
  { pose: 'working', title: '作業を進めます', text: 'バナーや資料づくりなど、頼まれた仕事をこつこつ進めます。' },
  { pose: 'thinking', title: '一緒に考えます', text: 'どう書くか、何から始めるか、迷ったときの相談相手です。' },
  { pose: 'success', title: 'できたら知らせます', text: '仕事が終わったら、できあがりを持って戻ってきます。' },
]

type ProfileRow = { label: string; value: string; pose: KunPose; detail?: string[] }

const PROFILE: ProfileRow[] = [
  { label: 'なまえ', value: 'ドヤくん', pose: 'hello' },
  { label: 'しごと', value: '仕事の相棒（バディ）', pose: 'handshake' },
  {
    label: 'とくい',
    value: '段取り・資料づくり・はげますこと',
    pose: 'thumbsup',
    detail: [
      'ダースチョーク（格闘技の絞め技。相手の腕ごと首をとらえて、がっちり極める）',
      'チキータ（卓球のバックハンドの台上技。手首をひねって、横回転のボールで先手をとる）',
    ],
  },
  { label: 'しゅみ', value: '格闘技と卓球', pose: 'jump' },
  {
    label: 'すきなもの',
    value: '喜多方ラーメン',
    pose: 'ramen',
    detail: [
      'すっきりした醤油スープに、平打ちのちぢれ麺。',
      'チャーシューで麺が見えなくなる「肉そば」が定番。',
      'いちばんのごちそうは、朝に食べる「朝ラー」。',
    ],
  },
]

const GALLERY: { pose: KunPose; label: string }[] = [
  { pose: 'hello', label: 'あいさつ' }, { pose: 'thumbsup', label: 'いいね' }, { pose: 'present', label: '発表' },
  { pose: 'chart', label: '分析' }, { pose: 'write', label: '書く' }, { pose: 'mic', label: 'インタビュー' },
  { pose: 'camera', label: '撮影' }, { pose: 'money', label: 'お金の管理' }, { pose: 'calendar', label: '予定' },
  { pose: 'search', label: '調べる' }, { pose: 'survey', label: 'アンケート' }, { pose: 'focus', label: '集中' },
  { pose: 'ponder', label: '考えごと' }, { pose: 'launch', label: '公開' }, { pose: 'love', label: 'ありがとう' },
  { pose: 'surprise', label: 'びっくり' }, { pose: 'ramen', label: '喜多方ラーメン' }, { pose: 'jump', label: 'やった！' },
  { pose: 'run', label: '急いでます' }, { pose: 'sleep', label: 'おやすみ' }, { pose: 'clock', label: '時間' },
]

const ASK_STEPS: { pose: KunPose; text: (brand: string) => JSX.Element }[] = [
  { pose: 'point', text: (brand) => <>画面の左下（パソコンでは右下）の「<strong>{brand}に頼む</strong>」を押します。</> },
  { pose: 'write', text: () => <>やりたいことを、ふだんの言葉で書きます。例:「来週の展示会のバナーを作って」</> },
  { pose: 'working', text: () => <>ドヤくんが進め方を確かめてから、作業を始めます。</> },
]

/** 見出しの左に置く小さなドヤくん */
function Heading({ id, pose, children }: { id: string; pose: KunPose; children: string }) {
  return (
    <h2 id={id} className={styles.h2}>
      <DoyaKun pose={pose} size={44} className={styles.h2Kun} />
      <span>{children}</span>
    </h2>
  )
}

export default function DoyaKunIntro({ brand }: { brand: string }) {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="doyakun-title">
        <div className={styles.heroArt}>
          <DoyaKun pose="hello" act="cheer" size={180} label="手を振るドヤくん" className={styles.heroKun} />
          <DoyaKun pose="ramen" size={64} className={styles.heroSideA} />
          <DoyaKun pose="thumbsup" size={64} className={styles.heroSideB} />
        </div>
        <div className={styles.heroText}>
          <p className={styles.kicker}>{brand}の相棒</p>
          <h1 id="doyakun-title" className={styles.title}>ドヤくんとは？</h1>
          <p className={styles.lead}>
            ドヤくんは、{brand}のなかで、あなたの仕事を手伝うクマです。
            画面のあちこちに出てきて、使い方の案内から、作業、できあがりの報告までを一緒に進めます。
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="doyakun-profile">
        <Heading id="doyakun-profile" pose="present">プロフィール</Heading>
        <dl className={styles.profile}>
          {PROFILE.map((p) => (
            <div key={p.label} className={styles.profileRow}>
              <dt><DoyaKun pose={p.pose} size={48} className={styles.rowKun} /><span>{p.label}</span></dt>
              <dd>
                {p.value}
                {p.detail ? (
                  <ul className={styles.detail}>
                    {p.detail.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="doyakun-help">
        <Heading id="doyakun-help" pose="working">ドヤくんがすること</Heading>
        <ul className={styles.scenes}>
          {SCENES.map((s) => (
            <li key={s.pose} className={styles.scene}>
              <DoyaKun pose={s.pose} size={96} />
              <div>
                <h3 className={styles.h3}>{s.title}</h3>
                <p className={styles.sceneText}>{s.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="doyakun-ask">
        <Heading id="doyakun-ask" pose="point">ドヤくんに頼むには</Heading>
        <ol className={styles.steps}>
          {ASK_STEPS.map((st, i) => (
            <li key={st.pose} className={styles.step}>
              <DoyaKun pose={st.pose} size={64} />
              <span className={styles.stepNum}>{i + 1}</span>
              <p className={styles.stepText}>{st.text(brand)}</p>
            </li>
          ))}
        </ol>
        <Link href="/home" className={styles.cta}>ホームで頼んでみる</Link>
      </section>

      <section className={styles.section} aria-labelledby="doyakun-gallery">
        <Heading id="doyakun-gallery" pose="love">いろいろなドヤくん</Heading>
        <ul className={styles.gallery}>
          {GALLERY.map((g) => (
            <li key={g.pose} className={styles.galleryItem}>
              <DoyaKun pose={g.pose} size={88} />
              <span className={styles.galleryLabel}>{g.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
