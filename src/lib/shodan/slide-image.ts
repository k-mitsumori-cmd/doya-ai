// ============================================
// ドヤ商談準備 提案スライドの画像生成（ドヤスライド方式を流用）
// 既存の slidesJson(構成テキスト) を1枚絵のスライド画像へ。gpt-image-2（composeSlideImage）。
// ============================================
import { composeSlideImage, type ComposeProject } from '@/lib/doyaslide/generate'
import type { ProposalSlide } from './types'

export interface SlideImage {
  title: string
  imageUrl: string | null // 生成失敗時は null（slidesJson と同じ索引で整列保持するためのプレースホルダ）
  role?: string
}

function shodanProject(prepId: string): ComposeProject {
  return {
    id: `shodan-${prepId}`,
    aspectRatio: 'wide', // 16:9
    themeColor: '#7f19e6',
    stylePreset: 'corporate', // 企業提案向け
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

/** 1スライドを画像生成して返す（extra: チャット修正の追記指示） */
export async function generateSlideImage(userId: string, prepId: string, slide: ProposalSlide, index: number, extra?: string): Promise<SlideImage> {
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
  return { title: slide.title, imageUrl: res.imageUrl, role }
}
