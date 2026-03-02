import { GoogleAuth } from 'google-auth-library'

const MONITORING_API = 'https://monitoring.googleapis.com/v3'

type MetricPoint = {
  method: string
  responseCode: string
  count: number
}

type CostEstimate = {
  geminiApiUsd: number
  geminiApiJpy: number
  totalUsd: number
  totalJpy: number
}

export type GCPUsageReport = {
  projectId: string
  periodStart: string
  periodEnd: string
  geminiApi: {
    totalRequests: number
    requestsByMethod: { method: string; count: number }[]
    errorCount: number
    errorRate: number
  }
  otherApis: { service: string; count: number }[]
  estimatedCost: CostEstimate
  monthly: {
    periodStart: string
    totalRequests: number
    errorCount: number
    estimatedCost: CostEstimate
  }
  error?: string
}

// Gemini API 料金（USD / 1Mトークン）- 2025年時点の参考価格
// 実際の料金はモデル・利用量によって変動します
const GEMINI_PRICING = {
  // Gemini 2.0 Flash（メイン利用想定）
  inputPerMToken: 0.10,   // $0.10 / 1M input tokens
  outputPerMToken: 0.40,  // $0.40 / 1M output tokens
  // 1リクエストあたりの平均トークン数（推定）
  avgInputTokens: 2000,
  avgOutputTokens: 800,
}

// 為替レート（概算）
const USD_TO_JPY = 150

/**
 * サービスアカウント認証でアクセストークンを取得
 */
async function getAccessToken(): Promise<string> {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credentialsJson) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set')
  }

  const credentials = JSON.parse(credentialsJson)
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/monitoring.read'],
  })

  const client = await auth.getClient()
  const token = await client.getAccessToken()
  if (!token.token) {
    throw new Error('Failed to get access token')
  }
  return token.token
}

/**
 * Cloud Monitoring API v3 でタイムシリーズを取得
 */
async function queryTimeSeries(
  projectId: string,
  filter: string,
  startTime: string,
  endTime: string,
  token: string,
): Promise<any> {
  const params = new URLSearchParams({
    filter,
    'interval.startTime': startTime,
    'interval.endTime': endTime,
    'aggregation.alignmentPeriod': '86400s',
    'aggregation.perSeriesAligner': 'ALIGN_SUM',
  })

  const url = `${MONITORING_API}/projects/${projectId}/timeSeries?${params.toString()}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[GCP Usage] Monitoring API error ${res.status}: ${body}`)
    return null
  }

  return res.json()
}

/**
 * Gemini API (generativelanguage.googleapis.com) のリクエスト数を取得
 */
function parseRequestCounts(data: any): MetricPoint[] {
  if (!data?.timeSeries) return []

  const points: MetricPoint[] = []
  for (const series of data.timeSeries) {
    const labels = series.metric?.labels || {}
    const method = labels.method || 'unknown'
    const responseCode = labels.response_code || labels.response_code_class || '2xx'

    for (const point of series.points || []) {
      const value = point.value?.int64Value || point.value?.doubleValue || 0
      points.push({
        method,
        responseCode: String(responseCode),
        count: Number(value),
      })
    }
  }
  return points
}

/**
 * 全サービスのAPIリクエスト数を取得し、サービス別に集計
 */
function parseServiceCounts(data: any): { service: string; count: number }[] {
  if (!data?.timeSeries) return []

  const serviceMap = new Map<string, number>()
  for (const series of data.timeSeries) {
    const service = series.resource?.labels?.service || 'unknown'
    // Gemini API は別セクションで表示するので除外
    if (service === 'generativelanguage.googleapis.com') continue

    for (const point of series.points || []) {
      const value = Number(point.value?.int64Value || point.value?.doubleValue || 0)
      serviceMap.set(service, (serviceMap.get(service) || 0) + value)
    }
  }

  return Array.from(serviceMap.entries())
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count)
}

/** リクエスト数からコスト推定を計算 */
function calcCostEstimate(successRequests: number): CostEstimate {
  const inputCostUsd = (successRequests * GEMINI_PRICING.avgInputTokens * GEMINI_PRICING.inputPerMToken) / 1_000_000
  const outputCostUsd = (successRequests * GEMINI_PRICING.avgOutputTokens * GEMINI_PRICING.outputPerMToken) / 1_000_000
  const geminiApiUsd = inputCostUsd + outputCostUsd
  return {
    geminiApiUsd,
    geminiApiJpy: Math.round(geminiApiUsd * USD_TO_JPY),
    totalUsd: geminiApiUsd,
    totalJpy: Math.round(geminiApiUsd * USD_TO_JPY),
  }
}

/** MetricPointから合計リクエスト数とエラー数を集計 */
function aggregatePoints(points: MetricPoint[]) {
  let totalRequests = 0
  let errorCount = 0
  for (const point of points) {
    totalRequests += point.count
    if (point.responseCode.startsWith('4') || point.responseCode.startsWith('5')) {
      errorCount += point.count
    }
  }
  return { totalRequests, errorCount }
}

/**
 * 過去24時間 + 月間のGCP使用量レポートを生成
 */
export async function fetchGCPUsageReport(): Promise<GCPUsageReport> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const zeroCost: CostEstimate = { geminiApiUsd: 0, geminiApiJpy: 0, totalUsd: 0, totalJpy: 0 }
  const zeroMonthly = { periodStart: '', totalRequests: 0, errorCount: 0, estimatedCost: zeroCost }

  if (!projectId) {
    return {
      projectId: 'unknown',
      periodStart: '',
      periodEnd: '',
      geminiApi: { totalRequests: 0, requestsByMethod: [], errorCount: 0, errorRate: 0 },
      otherApis: [],
      estimatedCost: zeroCost,
      monthly: zeroMonthly,
      error: 'GOOGLE_CLOUD_PROJECT_ID is not set',
    }
  }

  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const endTime = now.toISOString()
  const startTime = yesterday.toISOString()

  // 月初（JST基準）
  const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const monthStart = new Date(jstNow.getFullYear(), jstNow.getMonth(), 1)
  const monthStartTime = monthStart.toISOString()

  try {
    const token = await getAccessToken()

    const geminiFilter =
      'metric.type = "serviceruntime.googleapis.com/api/request_count" AND resource.labels.service = "generativelanguage.googleapis.com"'

    // 1. 過去24時間のGemini APIリクエスト数
    const geminiData = await queryTimeSeries(projectId, geminiFilter, startTime, endTime, token)
    const geminiPoints = parseRequestCounts(geminiData)

    // メソッド別に集計
    const methodMap = new Map<string, number>()
    const { totalRequests, errorCount } = aggregatePoints(geminiPoints)

    for (const point of geminiPoints) {
      const method = point.method.split('.').pop() || point.method
      methodMap.set(method, (methodMap.get(method) || 0) + point.count)
    }

    const requestsByMethod = Array.from(methodMap.entries())
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count)

    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0

    // 2. 他のAPIサービスのリクエスト数（過去24時間）
    const allServicesFilter = 'metric.type = "serviceruntime.googleapis.com/api/request_count"'
    const allServicesData = await queryTimeSeries(projectId, allServicesFilter, startTime, endTime, token)
    const otherApis = parseServiceCounts(allServicesData)

    // 3. 日次コスト推定
    const estimatedCost = calcCostEstimate(totalRequests - errorCount)

    // 4. 月間Gemini APIリクエスト数（月初〜現在）
    const monthlyGeminiData = await queryTimeSeries(projectId, geminiFilter, monthStartTime, endTime, token)
    const monthlyPoints = parseRequestCounts(monthlyGeminiData)
    const monthlyAgg = aggregatePoints(monthlyPoints)
    const monthlyCost = calcCostEstimate(monthlyAgg.totalRequests - monthlyAgg.errorCount)

    return {
      projectId,
      periodStart: startTime,
      periodEnd: endTime,
      geminiApi: {
        totalRequests,
        requestsByMethod,
        errorCount,
        errorRate,
      },
      otherApis,
      estimatedCost,
      monthly: {
        periodStart: monthStartTime,
        totalRequests: monthlyAgg.totalRequests,
        errorCount: monthlyAgg.errorCount,
        estimatedCost: monthlyCost,
      },
    }
  } catch (err: any) {
    console.error('[GCP Usage] Failed to fetch usage report:', err.message)
    return {
      projectId,
      periodStart: startTime,
      periodEnd: endTime,
      geminiApi: { totalRequests: 0, requestsByMethod: [], errorCount: 0, errorRate: 0 },
      otherApis: [],
      estimatedCost: zeroCost,
      monthly: zeroMonthly,
      error: err.message,
    }
  }
}
