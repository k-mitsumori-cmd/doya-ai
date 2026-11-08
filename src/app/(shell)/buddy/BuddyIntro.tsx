'use client'
// バディちゃんの紹介ページの中身。絵は ds/kun（public/character）の今ある絵だけを使う
import Link from 'next/link'
import { DoyaKun, type KunPose } from '@/components/ds/kun'
import styles from './buddy.module.css'

type Scene = { pose: KunPose; title: string; text: string }

const SCENES: Scene[] = [
  { pose: 'point', title: '使い方を案内します', text: 'はじめてのツールでも、次に押すところを指さしで教えます。' },
  { pose: 'working', title: '作業を進めます', text: 'バナーや資料づくりなど、頼まれた仕事をこつこつ進めます。' },
  { pose: 'thinking', title: '一緒に考えます', text: 'どう書くか、何から始めるか、迷ったときの相談相手です。' },
  { pose: 'success', title: 'できたら知らせます', text: '仕事が終わったら、できあがりを持って戻ってきます。' },
]

const PROFILE: { label: string; value: string }[] = [
  { label: 'なまえ', value: 'バディちゃん' },
  { label: 'しごと', value: '仕事の相棒（バディ）' },
  { label: 'とくい', value: '段取り・資料づくり・はげますこと' },
  { label: 'すきなもの', value: 'ラーメンと、ドヤ顔で「できました」と言う瞬間' },
]

const GALLERY: KunPose[] = ['hello', 'thumbsup', 'present', 'chart', 'write', 'mic', 'camera', 'money', 'calendar', 'ramen', 'jump', 'sleep']

export default function BuddyIntro({ brand }: { brand: string }) {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="buddy-title">
        <DoyaKun pose="hello" act="cheer" size={180} label="手を振るバディちゃん" className={styles.heroKun} />
        <div className={styles.heroText}>
          <p className={styles.kicker}>{brand}の相棒</p>
          <h1 id="buddy-title" className={styles.title}>バディちゃんとは？</h1>
          <p className={styles.lead}>
            バディちゃんは、{brand}のなかで、あなたの仕事を手伝うクマです。
            画面のあちこちに出てきて、使い方の案内から、作業、できあがりの報告までを一緒に進めます。
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="buddy-profile">
        <h2 id="buddy-profile" className={styles.h2}>プロフィール</h2>
        <dl className={styles.profile}>
          {PROFILE.map((p) => (
            <div key={p.label} className={styles.profileRow}>
              <dt>{p.label}</dt>
              <dd>{p.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="buddy-help">
        <h2 id="buddy-help" className={styles.h2}>バディちゃんがすること</h2>
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

      <section className={styles.section} aria-labelledby="buddy-ask">
        <h2 id="buddy-ask" className={styles.h2}>バディちゃんに頼むには</h2>
        <ol className={styles.steps}>
          <li>画面の左下（パソコンでは右下）の「<strong>{brand}に頼む</strong>」を押します。</li>
          <li>やりたいことを、ふだんの言葉で書きます。例:「来週の展示会のバナーを作って」</li>
          <li>バディちゃんが進め方を確かめてから、作業を始めます。</li>
        </ol>
        <Link href="/home" className={styles.cta}>ホームで頼んでみる</Link>
      </section>

      <section className={styles.section} aria-labelledby="buddy-gallery">
        <h2 id="buddy-gallery" className={styles.h2}>いろいろなバディちゃん</h2>
        <ul className={styles.gallery}>
          {GALLERY.map((pose) => (
            <li key={pose} className={styles.galleryItem}>
              <DoyaKun pose={pose} size={88} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
