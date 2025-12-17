/**
 * NanoBananaPro API型定義
 * 実際のAPIに合わせて調整すること
 */

export interface GenerateBannerRequest {
  prompt: string
  size: {
    width: number
    height: number
  }
  referenceImages?: string[] // 参照画像URL（任意）
  seed?: number // 再現性のためのシード値
  variations?: number // 生成数（1-4）
  style?: string // スタイル指定
}

export interface GenerateBannerResponse {
  id: string
  status: 'success' | 'pending' | 'failed'
  images: GeneratedImage[]
  usage?: {
    credits: number
    remaining: number
  }
  error?: {
    code: string
    message: string
  }
}

export interface GeneratedImage {
  id: string
  url: string // 一時URL（有効期限あり）
  width: number
  height: number
  seed: number
}

export interface EditBannerRequest {
  imageUrl: string
  instructions: string
  mask?: string // マスク画像URL
}

export interface EditBannerResponse {
  id: string
  status: 'success' | 'pending' | 'failed'
  images: GeneratedImage[]
  error?: {
    code: string
    message: string
  }
}

export interface NanoBananaClientConfig {
  apiKey: string
  baseUrl: string
  timeout?: number // ミリ秒
  maxRetries?: number
}

export class NanoBananaError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'NanoBananaError'
  }
}

