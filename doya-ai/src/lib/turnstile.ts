/**
 * Cloudflare Turnstile検証ヘルパー
 * 
 * 管理画面のログインセキュリティを強化するためのCAPTCHA機能
 * 
 * 設定方法:
 * 1. Cloudflare Dashboardでドメインを追加
 * 2. Security -> Turnstile -> Add Widgetでサイトキーとシークレットキーを取得
 * 3. 環境変数に設定:
 *    - NEXT_PUBLIC_TURNSTILE_SITE_KEY: フロントエンド用サイトキー
 *    - TURNSTILE_SECRET_KEY: バックエンド用シークレットキー
 *    - REQUIRE_TURNSTILE: "true"に設定すると必須化
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export interface TurnstileVerifyResult {
  success: boolean
  error?: string
  'error-codes'?: string[]
  challenge_ts?: string
  hostname?: string
}

/**
 * Turnstile CAPTCHAトークンを検証
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIP?: string
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY

  if (!secretKey) {
    // シークレットキーが設定されていない場合
    if (process.env.REQUIRE_TURNSTILE === 'true') {
      return {
        success: false,
        error: 'Turnstileシークレットキーが設定されていません',
      }
    }
    // Turnstileが任意の場合は成功とみなす
    return { success: true }
  }

  if (!token) {
    return {
      success: false,
      error: 'Turnstileトークンが必要です',
    }
  }

  try {
    const formData = new URLSearchParams()
    formData.append('secret', secretKey)
    formData.append('response', token)
    if (remoteIP) {
      formData.append('remoteip', remoteIP)
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Turnstile API error: ${response.status}`,
      }
    }

    const result = await response.json()

    if (!result.success) {
      const errorCodes = result['error-codes'] || []
      let errorMessage = 'CAPTCHA検証に失敗しました'
      
      if (errorCodes.includes('timeout-or-duplicate')) {
        errorMessage = 'CAPTCHAの有効期限が切れました。ページを更新して再度お試しください。'
      } else if (errorCodes.includes('invalid-input-response')) {
        errorMessage = '無効なCAPTCHAトークンです。'
      } else if (errorCodes.includes('bad-request')) {
        errorMessage = 'CAPTCHAリクエストが不正です。'
      }

      return {
        success: false,
        error: errorMessage,
        'error-codes': errorCodes,
      }
    }

    return {
      success: true,
      challenge_ts: result.challenge_ts,
      hostname: result.hostname,
    }
  } catch (error) {
    console.error('Turnstile verification error:', error)
    return {
      success: false,
      error: 'CAPTCHA検証中にエラーが発生しました',
    }
  }
}

/**
 * Turnstileが有効かどうかを確認
 */
export function isTurnstileEnabled(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
    process.env.TURNSTILE_SECRET_KEY
  )
}

/**
 * Turnstileが必須かどうかを確認
 */
export function isTurnstileRequired(): boolean {
  return process.env.REQUIRE_TURNSTILE === 'true'
}

