// ============================================
// ドヤスライド スライド画像生成ヘルパー（共通）
// ============================================
// generate / regenerate / chat から共通で使う「1スライドをフル画像化 → ロゴ合成」処理。
import { generateImageWithFallback } from '@/lib/image-generator'
import { ASPECT_TO_SIZE } from './constants'
import { buildImagePrompt } from './prompts'
import { compositeLogo, fetchBuffer } from './logo'
import { uploadSlideImage, uploadComposedImage } from './storage'
import type { AspectRatio, LogoPosition, LogoSize } from './types'

export interface ComposeProject {
  id: string
  aspectRatio: string
  themeColor: string
  stylePreset: string
  logoUrl?: string | null
  logoPosition: string
  logoSize: string
  logoBackingChip: boolean
}

export interface ComposeSlide {
  role?: string | null
  headline?: string | null
  subText?: string | null
  visualPrompt: string
}

export interface ComposeResult {
  rawImageUrl: string
  imageUrl: string
  model: string
  fallbackUsed: boolean
}

/** 1スライドを生成して（ロゴがあれば）合成し、URLを返す */
export async function composeSlideImage(
  userId: string,
  project: ComposeProject,
  slide: ComposeSlide,
  extraInstruction?: string
): Promise<ComposeResult> {
  const size = ASPECT_TO_SIZE[(project.aspectRatio as AspectRatio)] || ASPECT_TO_SIZE.wide
  const hasLogo = !!project.logoUrl

  const prompt = buildImagePrompt({
    slide,
    themeColor: project.themeColor,
    stylePreset: project.stylePreset,
    hasLogo,
    logoPosition: (project.logoPosition as LogoPosition) || 'top-right',
    extraInstruction,
  })

  const img = await generateImageWithFallback({ prompt, size, quality: 'high' })

  // ロゴ合成前の生画像を保存
  const rawImageUrl = await uploadSlideImage(userId, project.id, img.base64, img.mimeType)

  let imageUrl = rawImageUrl
  if (hasLogo && project.logoUrl) {
    try {
      const logoBuf = await fetchBuffer(project.logoUrl)
      const composed = await compositeLogo(Buffer.from(img.base64, 'base64'), logoBuf, {
        position: (project.logoPosition as LogoPosition) || 'top-right',
        size: (project.logoSize as LogoSize) || 'M',
        backingChip: project.logoBackingChip,
      })
      imageUrl = await uploadComposedImage(userId, project.id, composed)
    } catch (e) {
      // 合成に失敗してもロゴ無し画像で続行
      console.error('[doyaslide] ロゴ合成失敗:', (e as any)?.message)
      imageUrl = rawImageUrl
    }
  }

  return { rawImageUrl, imageUrl, model: img.model, fallbackUsed: img.fallbackUsed }
}
