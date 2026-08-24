import { sendYurusenAppStoreReport, YURUSEN_APP_ID } from '@/lib/yurusen-appstore-report'
import { fetchYurusenEngagement } from '@/lib/yurusen-engagement'
import { sendAppMorningDigest, type DigestConfig, type DigestResult } from '@/lib/app-morning-digest'

// ============================================
// ゆるせん「朝刊」— 1日1通の統合ダイジェスト（JST 10:25）
//
// 組み立ては app-morning-digest.ts に集約。ここはゆるせん固有の設定だけを持つ。
// 呪い日記の朝刊と同じ粒度に揃えるため、DL/売上に加えて
// 流入経路・国別・ストア/順位・SNS を載せる。
//
// アプリ内の動き（DAU/綴じた人/裁き/ガチャ/川柳/課金）は自前Supabaseから集計する。
//   接続は YURUSEN_SUPABASE_URL / YURUSEN_SUPABASE_SERVICE_ROLE_KEY（集計は yurusen-engagement.ts）。
//
// 通知先: SLACK_YURUSEN_APPSTORE_WEBHOOK_URL（未設定は SLACK_APPSTORE_WEBHOOK_URL）
// ============================================

/** ゆるせんのASO対象語（2026-08 時点。ブランド語＋非ブランド語） */
const YURUSEN_KEYWORDS = [
  'ゆるせん',
  '許せない',
  '愚痴',
  'ストレス発散',
  '怒り',
  '閻魔帳',
  'モヤモヤ',
  '仕返し',
  '人間関係 悩み',
  '匿名 吐き出す',
]

export const YURUSEN_DIGEST_CONFIG: DigestConfig = {
  appLabel: 'ゆるせん',
  appId: YURUSEN_APP_ID,
  webhookEnvs: ['SLACK_YURUSEN_APPSTORE_WEBHOOK_URL', 'SLACK_APPSTORE_WEBHOOK_URL'],
  fetchSales: () => sendYurusenAppStoreReport({ deliver: false }),
  fetchEngagement: fetchYurusenEngagement,
  marketingKeywords: YURUSEN_KEYWORDS,
  marketingSnapshotKey: 'yurusen_marketing_snapshot',
  youtubeSnapshotKey: 'yurusen_digest_youtube_snapshot',
  youtubeChannels: [
    { id: 'UCsOC1bRqk36MMJCEwHmFlhw', label: 'エンマ@ゆるせん公式' },
    { id: 'UCoOB-sCUoY_fs8GNRQtvtKg', label: 'Enma | Yurusen Official（英語）' },
  ],
}

export type { DigestResult }

/** ゆるせんの朝刊を Slack に1通で送る */
export function sendYurusenMorningDigest(opts: { deliver?: boolean } = {}) {
  return sendAppMorningDigest(YURUSEN_DIGEST_CONFIG, opts)
}
