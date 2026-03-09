// ============================================
// ドヤムービーAI - Kling 3.0 API クライアント
// ============================================
import jwt from 'jsonwebtoken'

const KLING_BASE_URL = 'https://api.klingai.com'
const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY ?? ''
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY ?? ''

// ---- JWT トークン生成 ----

let cachedToken: { token: string; expiresAt: number } | null = null

function generateToken(): string {
  const now = Math.floor(Date.now() / 1000)

  // キャッシュが有効なら再利用（5分前に更新）
  if (cachedToken && cachedToken.expiresAt > now + 300) {
    return cachedToken.token
  }

  const payload = {
    iss: KLING_ACCESS_KEY,
    exp: now + 1800, // 30分有効
    nbf: now - 5,
  }

  const token = jwt.sign(payload, KLING_SECRET_KEY, {
    algorithm: 'HS256',
    header: { alg: 'HS256', typ: 'JWT' },
  })

  cachedToken = { token, expiresAt: now + 1800 }
  return token
}

// ---- API リクエストヘルパー ----

async function klingFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = generateToken()
  const res = await fetch(`${KLING_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`Kling API error ${res.status}: ${text}`)
  }

  return res.json()
}

// ---- 型定義 ----

export interface KlingVideoOptions {
  model?: string           // デフォルト: 'kling-v3'
  duration?: string        // '5' or '10'
  aspectRatio?: string     // '16:9', '9:16', '1:1'
  mode?: 'std' | 'pro'    // standard or professional
  negativePrompt?: string
  callbackUrl?: string
}

export interface KlingTaskResult {
  task_id: string
  task_status: 'submitted' | 'processing' | 'succeed' | 'failed'
  task_status_msg?: string
  task_result?: {
    videos: Array<{
      id: string
      url: string
      duration: string
    }>
  }
  created_at?: number
  updated_at?: number
}

// ---- テキストから動画生成 ----

export async function createTextToVideo(
  prompt: string,
  options: KlingVideoOptions = {}
): Promise<string> {
  const body: Record<string, any> = {
    model_name: options.model || 'kling-v3',
    prompt,
    duration: options.duration || '5',
    aspect_ratio: options.aspectRatio || '16:9',
    mode: options.mode || 'std',
  }

  if (options.negativePrompt) {
    body.negative_prompt = options.negativePrompt
  }
  if (options.callbackUrl) {
    body.callback_url = options.callbackUrl
  }

  const data = await klingFetch('/v1/videos/text2video', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const taskId = data?.data?.task_id
  if (!taskId) {
    throw new Error(`Kling API: task_id not returned. Response: ${JSON.stringify(data)}`)
  }

  return taskId
}

// ---- 画像から動画生成 ----

export async function createImageToVideo(
  imageUrl: string,
  prompt: string,
  options: KlingVideoOptions = {}
): Promise<string> {
  const body: Record<string, any> = {
    model_name: options.model || 'kling-v3',
    image: imageUrl,
    prompt,
    duration: options.duration || '5',
    aspect_ratio: options.aspectRatio || '16:9',
    mode: options.mode || 'std',
  }

  if (options.negativePrompt) {
    body.negative_prompt = options.negativePrompt
  }
  if (options.callbackUrl) {
    body.callback_url = options.callbackUrl
  }

  const data = await klingFetch('/v1/videos/image2video', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const taskId = data?.data?.task_id
  if (!taskId) {
    throw new Error(`Kling API: task_id not returned. Response: ${JSON.stringify(data)}`)
  }

  return taskId
}

// ---- タスク状態確認 ----

export async function getTaskStatus(taskId: string): Promise<KlingTaskResult> {
  const data = await klingFetch(`/v1/videos/text2video/${taskId}`, {
    method: 'GET',
  })

  return {
    task_id: data?.data?.task_id ?? taskId,
    task_status: data?.data?.task_status ?? 'processing',
    task_status_msg: data?.data?.task_status_msg,
    task_result: data?.data?.task_result,
    created_at: data?.data?.created_at,
    updated_at: data?.data?.updated_at,
  }
}

// ---- 完了までポーリング ----

export async function waitForCompletion(
  taskId: string,
  onProgress?: (progress: number) => Promise<void>,
  maxWaitMs = 180_000, // 最大3分
  intervalMs = 3_000,  // 3秒間隔
): Promise<string> {
  const startTime = Date.now()
  let lastProgress = 0

  while (Date.now() - startTime < maxWaitMs) {
    const result = await getTaskStatus(taskId)

    if (result.task_status === 'succeed') {
      if (onProgress) await onProgress(100)
      const videoUrl = result.task_result?.videos?.[0]?.url
      if (!videoUrl) {
        throw new Error('Kling: 動画URLが返されませんでした')
      }
      return videoUrl
    }

    if (result.task_status === 'failed') {
      throw new Error(`Kling 動画生成失敗: ${result.task_status_msg || '不明なエラー'}`)
    }

    // 経過時間からざっくり進捗を推定
    const elapsed = Date.now() - startTime
    const estimatedProgress = Math.min(90, Math.round((elapsed / maxWaitMs) * 90))
    if (estimatedProgress > lastProgress) {
      lastProgress = estimatedProgress
      if (onProgress) await onProgress(estimatedProgress)
    }

    await new Promise(r => setTimeout(r, intervalMs))
  }

  throw new Error('Kling: 動画生成がタイムアウトしました（3分以上経過）')
}

// ---- プロンプト構築ヘルパー ----

export function buildVideoPrompt(
  scenes: Array<{ videoPrompt?: string; narrationText?: string; texts?: Array<{ content: string }> }>,
  productName: string,
  productDescription: string,
): string {
  // 各シーンの情報を統合した1つの動画生成プロンプトを作成
  const sceneDescriptions = scenes.map((scene, i) => {
    if (scene.videoPrompt) return scene.videoPrompt
    // videoPromptがない場合はテキスト情報から構築
    const textContent = scene.texts?.map(t => t.content).join(', ') || ''
    const narration = scene.narrationText || ''
    return `Scene ${i + 1}: ${textContent}. ${narration}`.trim()
  })

  const prompt = [
    `Professional advertising video for "${productName}".`,
    productDescription ? `Product: ${productDescription}.` : '',
    `Scenes: ${sceneDescriptions.join(' | ')}`,
    'High quality, cinematic lighting, clean modern design, professional commercial style.',
    'Smooth transitions, eye-catching visuals, advertising quality.',
  ].filter(Boolean).join(' ')

  return prompt
}
