// ============================================
// ドヤ商談準備 提案スライドの画像生成（ドヤスライド方式を流用）
// 既存の slidesJson(構成テキスト) を1枚絵のスライド画像へ。gpt-image-2（composeSlideImage）。
// 生成画像は shodan 非公開バケットへ保存し、配信は署名URL（機密性確保）。
// ============================================
import { composeSlideImage, type ComposeProject } from '@/lib/doyaslide/generate'
import { raceTimeout } from '@/lib/fetch-timeout'
import { uploadPng } from './storage'
import type { ProposalSlide } from './types'

// DBに保存する形（imagePath は非公開バケット内パス。失敗時 null）
export interface StoredSlide {
  title: string
  imagePath: string | null
  role?: string
}
// クライアントに返す形（署名URL）
export interface SlideImage {
  title: string
  imageUrl: string | null
  role?: string
}

function shodanProject(prepId: string): ComposeProject {
  return {
    id: `shodan-${prepId}`,
    aspectRatio: 'wide', // 16:9
    themeColor: '#7f19e6',
    stylePreset: 'corporate',
    logoUrl: null,
    logoPosition: 'top-right',
    logoSize: 'M',
    logoBackingChip: false,
  }
}
function roleFromType(t?: string): string {
  if (t === 'cover') return '表紙'
  if (t === 'agenda') return '目次'
  if (t === 'closing') return 'まとめ'
  return ''
}
function visualPromptFor(slide: ProposalSlide): string {
  const bullets = (slide.bullets || []).join(' / ')
  return [
    'プロのビジネス提案スライド（1枚絵）。',
    `主役の見出し: 「${slide.title}」。`,
    slide.subtitle ? `補足: ${slide.subtitle}。` : '',
    bullets ? `要点を読みやすく図解的にレイアウト: ${bullets}。` : '',
    'クリーンで信頼感のある企業デザイン。余白を活かし、文字は大きく可読性高く。',
  ].filter(Boolean).join('')
}

/** 1スライドを画像生成し、shodan非公開バケットへ保存してパスを返す（extra: 修正の追記指示） */
export async function generateSlideImage(userId: string, prepId: string, slide: ProposalSlide, index: number, extra?: string): Promise<StoredSlide> {
  const role = roleFromType(slide.type)
  const res = await composeSlideImage(
    userId,
    shodanProject(prepId),
    {
      index: index + 1,
      role: role || null,
      headline: slide.title,
      subText: (slide.bullets || []).join('\n') || slide.subtitle || null,
      visualPrompt: visualPromptFor(slide),
    },
    extra
  )
  // 生成結果（doyaslideの公開URL）を取得し、shodan非公開バケットへ再保存（各I/Oはタイムアウトで保護＝ハング防止）
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 25000)
  let buf: Buffer
  try {
    const resp = await fetch(res.imageUrl, { signal: ctrl.signal })
    if (!resp.ok) throw new Error('生成画像の取得に失敗しました')
    buf = Buffer.from(await resp.arrayBuffer())
  } finally {
    clearTimeout(to)
  }
  const path = `shodan/slides/${prepId}/${index}-${Date.now()}.png`
  await raceTimeout('uploadSlide', 25000, uploadPng(path, buf))
  return { title: slide.title, imagePath: path, role }
}
