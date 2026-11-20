// ドヤAI LP 共通の型（lp-kit）。サービスごとの文言は設定ファイル（例: seo/lp-content.ts）に集める。
import type { ReactNode } from 'react'

/** 日本語の見出し。文節の配列で持ち、PC とスマホで改行の位置を別々に指定できる。 */
export type PhraseSpec = {
  /** 文節の配列。文節の途中では折れない（inline-block + nowrap）。句読点は文節の末尾に含める。 */
  phrases: string[]
  /** PC で、この番号の文節の後ろで改行する */
  breakPc?: number[]
  /** スマホで、この番号の文節の後ろで改行する */
  breakSp?: number[]
  /** 黄色の線を引く文節の番号（差し色） */
  mark?: number[]
}

export type IconKey = 'search' | 'list' | 'check' | 'pen' | 'file' | 'shield' | 'link' | 'layers'
export type BearItem = 'none' | 'pen' | 'doc' | 'lens'

export type HeroVariant = 'a' | 'a2' | 'b' | 'c'

export type DemoTab = { id: string; label: string; from: number }

export type LpKitContent = {
  serviceName: string
  ctaHref: string
  loginHref: string
  pricingHref: string
  hero: {
    heading: PhraseSpec
    sub: string
    ctaLabel: string
    subCtaLabel: string
    note: string
    facts: string[]
    /** 案B: 右に置く既存の絵（縦横比を指定して、読み込み時にずれないようにする） */
    image?: { src: string; alt: string; width: number; height: number }
    /** 案A+ / 案C: ドヤくんの絵（背景が透明の画像）と、案Cの浮かぶ札 */
    bear?: { src: string; alt: string }
    chips?: string[]
  }
  stage: {
    heading: PhraseSpec
    lead: string
    windowTitle: string
    tabs: DemoTab[]
    /** 入力から完成までの長さ（ms） */
    duration: number
    /** 完成の画面を見せておく長さ（ms） */
    hold: number
    caption: string
  }
  stats: {
    items: { value: number; unit: string; label: string; desc?: string }[]
    marqueeLabel: string
    marquee: string[]
  }
  showcase: {
    heading: PhraseSpec
    lead: string
    items: { title: string; keyword: string; note: string }[]
  }
  features: {
    heading: PhraseSpec
    items: { icon: IconKey; title: string; desc: string; bullets: string[] }[]
  }
  statement: { label: string; phrases: string[]; breakPc?: number[]; breakSp?: number[] }
  steps: {
    heading: PhraseSpec
    items: { title: string; desc: string; item: BearItem }[]
    bearLines: string[]
  }
  faq: {
    heading: PhraseSpec
    items: { q: string; a: string }[]
    pricingLinkLabel: string
  }
  finalCta: {
    heading: PhraseSpec
    imageSrc: string
    imageAlt: string
  }
  footerLinks: { label: string; href: string }[]
}

/** サービスごとの「画面の再現」。コードで描く。 */
export type LpKitVisuals = {
  /** 実演の画面。t は経過時間(ms)、tab は今の段階の番号 */
  demo: (t: number, tab: number) => ReactNode
  /** ヒーロー案A: 右に置く製品画面の縮小版（実演の簡易版） */
  heroA?: ReactNode
  /** 流れの図（実演の下） */
  flow: ReactNode
  /** 作れる物の見本（showcase.items と同じ数） */
  outputs: ReactNode[]
  /** 機能の見せ場の画面（features.items と同じ数） */
  features: ReactNode[]
}
