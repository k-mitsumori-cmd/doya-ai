// ============================================
// ドヤくんとは？ — クマ（ドヤくん）の紹介ページ（/doyakun）
// ============================================
// 2026-11-08 本人の指示: 左のメニューの一番下に「ドヤくんとは？」を置き、クマの紹介ページを作る。
//   名前は一度「バディちゃん」としたが、同じ日に「ドヤくんにしましょう」で、今までの呼び名「ドヤくん」にそろえた。
// - ログインしていれば共通の枠（AppShell）の中で開く（registry.ts の 'doyakun'）。ログインしていなくても、枠なしで読める。
// - DB・AI には触れない。絵は public/character の今ある絵だけを使う。
import type { Metadata } from 'next'
import { brandName } from '@/lib/brand'
import DoyaKunIntro from './DoyaKunIntro'

export const metadata: Metadata = {
  // サイト名は root layout の title.template が付ける（自分で付けると「| ドヤバディ | ドヤバディ」と重なる）
  title: 'ドヤくんとは？',
  description: `${brandName()}の相棒のクマ、ドヤくんの紹介です。`,
}

export default function DoyaKunPage() {
  return <DoyaKunIntro brand={brandName()} />
}
