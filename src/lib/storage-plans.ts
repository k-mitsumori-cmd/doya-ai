// ============================================
// 保存できる量と、保持する日数（プランごと・単一ソース）
// ============================================
// 動画・音声など、利用者がアップロードして当方の保存場所に置くファイルの上限。
// 値を変えたいときは、このファイルの STORAGE_PLANS だけを編集する。
// 案の値と理由は reference/13-stored-files.md を参照。

import { isPaidPlan } from '@/lib/unified-plan'

export type StoragePlanKey = 'free' | 'light' | 'pro' | 'enterprise'

export type StoragePlan = {
  label: string
  /** 保存できる合計（バイト） */
  quotaBytes: number
  /**
   * ファイルを置いてから消えるまでの日数。null は「契約している間はずっと」。
   * 契約をやめて無料に変わったあとの扱いは postCancelGraceDays を参照。
   */
  retentionDays: number | null
}

const GB = 1024 ** 3

export const STORAGE_PLANS: Record<StoragePlanKey, StoragePlan> = {
  free: { label: '無料プラン', quotaBytes: 2 * GB, retentionDays: 30 },
  light: { label: 'LIGHT', quotaBytes: 20 * GB, retentionDays: null },
  pro: { label: 'プロプラン', quotaBytes: 50 * GB, retentionDays: null },
  enterprise: { label: 'エンタープライズ', quotaBytes: 200 * GB, retentionDays: null },
}

/** 有料から無料に変わったとき、既存ファイルを消すまでの猶予（日） */
export const POST_CANCEL_GRACE_DAYS = 30
/** 消す何日前に、画面とメールで知らせるか */
export const EXPIRY_NOTICE_DAYS = 7

export function storagePlanKey(plan?: string | null): StoragePlanKey {
  const p = (plan || '').trim().toUpperCase()
  if (!isPaidPlan(p)) return 'free'
  if (p === 'LIGHT') return 'light'
  if (p === 'ENTERPRISE' || p === 'BUSINESS') return 'enterprise'
  return 'pro'
}

export function storagePlanFor(plan?: string | null): StoragePlan {
  return STORAGE_PLANS[storagePlanKey(plan)]
}

export function formatBytes(n: number): string {
  if (n >= GB) return `${(n / GB).toFixed(n >= 10 * GB ? 0 : 1)}GB`
  return `${Math.max(0, Math.round(n / 1024 ** 2))}MB`
}
