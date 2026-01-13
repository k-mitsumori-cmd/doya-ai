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
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1時間
const JOB_MAX_AGE = 60 * 60 * 1000 // 1時間

setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobStorage.entries()) {
    if (now - job.createdAt > JOB_MAX_AGE) {
      jobStorage.delete(id)
      console.log(`[LP-SITE] 古いワイヤーフレーム生成ジョブを削除: ${id}`)
    }
  }
}, CLEANUP_INTERVAL)

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

