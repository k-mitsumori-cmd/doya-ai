/**
 * NanoBananaPro APIのモック実装
 * 
 * 開発時やAPI未接続時のフォールバックとして使用
 */

import { GenerateBannerRequest, GenerateBannerResponse, GeneratedImage } from './types'

// モック画像URL（プレースホルダー）
const MOCK_IMAGE_BASE = 'https://placehold.co'

// バリエーションごとのカラー
const VARIANT_COLORS = {
  A: { bg: '3B82F6', text: 'FFFFFF' }, // Blue
  B: { bg: 'F59E0B', text: 'FFFFFF' }, // Amber
  C: { bg: '10B981', text: 'FFFFFF' }, // Emerald
}

/**
 * モック画像URLを生成
 */
function generateMockImageUrl(width: number, height: number, variant: string, prompt: string): string {
  const colors = VARIANT_COLORS[variant as keyof typeof VARIANT_COLORS] || VARIANT_COLORS.A
  
  // プロンプトから最初の20文字を抽出してラベルに
  const label = encodeURIComponent(
    `${variant}: ${prompt.slice(0, 30)}...`
      .replace(/\n/g, ' ')
      .trim()
  )
  
  return `${MOCK_IMAGE_BASE}/${width}x${height}/${colors.bg}/${colors.text}?text=${label}`
}

/**
 * モックでバナーを生成
 */
export async function generateBannerMock(
  request: GenerateBannerRequest,
  variants: string[] = ['A', 'B', 'C']
): Promise<GenerateBannerResponse> {
  // 実際のAPI呼び出しをシミュレートするための遅延
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000))
  
  const images: GeneratedImage[] = variants.map((variant, index) => ({
    id: `mock-${Date.now()}-${variant}`,
    url: generateMockImageUrl(
      request.size.width,
      request.size.height,
      variant,
      request.prompt
    ),
    width: request.size.width,
    height: request.size.height,
    seed: Math.floor(Math.random() * 1000000),
  }))
  
  return {
    id: `mock-job-${Date.now()}`,
    status: 'success',
    images,
    usage: {
      credits: 1,
      remaining: 999,
    },
  }
}

/**
 * モック画像をダウンロード可能なBufferに変換
 * （実際はプレースホルダー画像をfetchして返す）
 */
export async function downloadMockImageToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * 開発モードかどうかを判定
 */
export function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NANOBANANAPRO_API_KEY
}

