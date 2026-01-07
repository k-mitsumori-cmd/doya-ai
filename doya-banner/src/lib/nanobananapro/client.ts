import {
  GenerateBannerRequest,
  GenerateBannerResponse,
  NanoBananaClientConfig,
  NanoBananaError,
} from './types'

/**
 * NanoBananaPro API クライアント
 * 
 * 抽象化レイヤー: 実際のAPIエンドポイントは環境変数で設定
 * 差し替え可能な設計
 */
export class NanoBananaClient {
  private config: Required<NanoBananaClientConfig>
  
  constructor(config: NanoBananaClientConfig) {
    this.config = {
      timeout: 60000, // 60秒
      maxRetries: 3,
      ...config,
    }
  }
  
  /**
   * バナー生成
   * リトライ: 指数バックオフ
   */
  async generateBanner(request: GenerateBannerRequest): Promise<GenerateBannerResponse> {
    let lastError: NanoBananaError | null = null
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest<GenerateBannerResponse>(
          'POST',
          '/generate',
          request
        )
        
        if (response.status === 'failed' && response.error) {
          throw new NanoBananaError(
            response.error.message,
            response.error.code,
            undefined,
            this.isRetryableError(response.error.code)
          )
        }
        
        return response
      } catch (error) {
        if (error instanceof NanoBananaError) {
          lastError = error
          
          if (!error.retryable) {
            throw error
          }
          
          // 指数バックオフ: 1s, 2s, 4s...
          const delay = Math.pow(2, attempt) * 1000
          await this.sleep(delay)
        } else {
          throw error
        }
      }
    }
    
    throw lastError || new NanoBananaError('Max retries exceeded', 'MAX_RETRIES', undefined, false)
  }
  
  /**
   * HTTPリクエスト実行
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)
    
    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new NanoBananaError(
          errorBody.message || `HTTP ${response.status}`,
          errorBody.code || 'HTTP_ERROR',
          response.status,
          this.isRetryableStatusCode(response.status)
        )
      }
      
      return await response.json()
    } catch (error) {
      if (error instanceof NanoBananaError) {
        throw error
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new NanoBananaError('Request timeout', 'TIMEOUT', undefined, true)
        }
        throw new NanoBananaError(error.message, 'NETWORK_ERROR', undefined, true)
      }
      
      throw new NanoBananaError('Unknown error', 'UNKNOWN', undefined, false)
    } finally {
      clearTimeout(timeoutId)
    }
  }
  
  /**
   * リトライ可能なエラーコードか判定
   */
  private isRetryableError(code: string): boolean {
    const retryableCodes = [
      'RATE_LIMITED',
      'SERVER_ERROR',
      'TIMEOUT',
      'NETWORK_ERROR',
      'SERVICE_UNAVAILABLE',
    ]
    return retryableCodes.includes(code)
  }
  
  /**
   * リトライ可能なHTTPステータスコードか判定
   */
  private isRetryableStatusCode(status: number): boolean {
    return status === 429 || status >= 500
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * シングルトンクライアントインスタンス
 */
let clientInstance: NanoBananaClient | null = null

export function getNanoBananaClient(): NanoBananaClient {
  if (!clientInstance) {
    const apiKey = process.env.NANOBANANAPRO_API_KEY
    const baseUrl = process.env.NANOBANANAPRO_API_URL
    
    if (!apiKey || !baseUrl) {
      throw new Error('NanoBananaPro API configuration missing')
    }
    
    clientInstance = new NanoBananaClient({
      apiKey,
      baseUrl,
    })
  }
  
  return clientInstance
}

