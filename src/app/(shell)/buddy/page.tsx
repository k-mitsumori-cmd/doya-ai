// ============================================
// バディちゃんとは？ — クマ（バディちゃん）の紹介ページ（/buddy）
// ============================================
// 2026-11-08 本人の指示: 左のメニューの一番下に「バディちゃんとは？」を置き、クマの紹介ページを作る。名前は「バディちゃん」。
// - ログインしていれば共通の枠（AppShell）の中で開く（registry.ts の 'buddy'）。ログインしていなくても、枠なしで読める。
// - DB・AI には触れない。絵は public/character の今ある絵だけを使う。
import type { Metadata } from 'next'
import { brandName } from '@/lib/brand'
import BuddyIntro from './BuddyIntro'

export const metadata: Metadata = {
  title: `バディちゃんとは？ | ${brandName()}`,
  description: `${brandName()}の相棒のクマ、バディちゃんの紹介です。`,
}

export default function BuddyPage() {
  return <BuddyIntro brand={brandName()} />
}
