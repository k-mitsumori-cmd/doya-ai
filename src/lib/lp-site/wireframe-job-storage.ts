// ============================================
// ワイヤーフレーム生成ジョブの一時ストレージ
// ============================================

import { SectionWireframe } from './types'

export type WireframeJobStatus = 'PROCESSING' | 'COMPLETED' | 'ERROR'

export interface WireframeJob {
  id: string
  status: WireframeJobStatus
  wireframes: SectionWireframe[]
  error?: string
  createdAt: number
  updatedAt: number
}

// メモリベースの一時ストレージ（本番環境ではデータベースに移行推奨）
const jobStorage = new Map<string, WireframeJob>()

// 古いジョブをクリーンアップ（1時間以上経過したジョブを削除）
// 注意: サーバーレス環境ではsetIntervalは推奨されないため、使用時のみクリーンアップを実行
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1時間
const JOB_MAX_AGE = 60 * 60 * 1000 // 1時間

// クリーンアップ関数（必要に応じて手動で呼び出す）
export function cleanupOldJobs(): void {
  const now = Date.now()
  for (const [id, job] of jobStorage.entries()) {
    if (now - job.createdAt > JOB_MAX_AGE) {
      jobStorage.delete(id)
      console.log(`[LP-SITE] 古いワイヤーフレーム生成ジョブを削除: ${id}`)
    }
  }
}

// サーバーレス環境ではsetIntervalは推奨されないため、コメントアウト
// 必要に応じて、getWireframeJobやupdateWireframeJob内でクリーンアップを実行
// setInterval(() => {
//   cleanupOldJobs()
// }, CLEANUP_INTERVAL)

export function createWireframeJob(): string {
  const id = `wireframe-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const job: WireframeJob = {
    id,
    status: 'PROCESSING',
    wireframes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  jobStorage.set(id, job)
  return id
}

export function getWireframeJob(id: string): WireframeJob | null {
  // 取得時に古いジョブをクリーンアップ（サーバーレス環境対応）
  cleanupOldJobs()
  return jobStorage.get(id) || null
}

export function updateWireframeJob(
  id: string,
  updates: Partial<Pick<WireframeJob, 'status' | 'wireframes' | 'error'>>
): void {
  const job = jobStorage.get(id)
  if (!job) {
    throw new Error(`ワイヤーフレーム生成ジョブが見つかりません: ${id}`)
  }
  
  jobStorage.set(id, {
    ...job,
    ...updates,
    updatedAt: Date.now(),
  })
}

export function deleteWireframeJob(id: string): void {
  jobStorage.delete(id)
}

