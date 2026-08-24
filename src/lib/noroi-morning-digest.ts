import { sendAppStoreReport } from '@/lib/appstore-report'
import { sendNoroiEngagementReport } from '@/lib/noroi-engagement-report'
import { sendAppMorningDigest, type DigestConfig, type DigestResult } from '@/lib/app-morning-digest'

// ============================================
// 呪い日記「朝刊」— 1日1通の統合ダイジェスト（JST 10:00）
//
// 組み立ては app-morning-digest.ts に集約。ここは呪い日記固有の設定だけを持つ。
// 旧: appstore-report / appstore-marketing-report / noroi-engagement-report /
//     appstore-country-report / appstore-source-report の5通を統合したもの。
//
// 通知先: SLACK_APPSTORE_WEBHOOK_URL
// ============================================

const NOROI_APP_ID = '6786964992'

export const NOROI_DIGEST_CONFIG: DigestConfig = {
  appLabel: '呪い日記',
  appId: NOROI_APP_ID,
  webhookEnvs: ['SLACK_APPSTORE_WEBHOOK_URL'],
  fetchSales: () => sendAppStoreReport({ deliver: false }),
  fetchEngagement: () => sendNoroiEngagementReport({ deliver: false }),
  marketingSnapshotKey: 'appstore_marketing_snapshot',
  youtubeSnapshotKey: 'noroi_digest_youtube_snapshot',
  youtubeChannels: [
    { id: 'UCxfO6w6rf-jzF2IFl34NQSA', label: 'ノロッピー@呪い日記' },
    { id: 'UCuWdi7IEVypvhApM-b5_t4A', label: 'Curse Diary（英語）' },
  ],
  engagementLabels: { posts: '日記', draws: 'ガチャ' },
}

export type { DigestResult }

/** 呪い日記の朝刊を Slack に1通で送る */
export function sendNoroiMorningDigest(opts: { deliver?: boolean } = {}) {
  return sendAppMorningDigest(NOROI_DIGEST_CONFIG, opts)
}
