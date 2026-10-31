// ============================================
// 費用の単価（ここだけに置く）
// ============================================
// 日次コストレポート（daily-report.ts）と、ドヤパワーの減る量（doya-power/heavy-costs.ts）が、
// 同じ単価から計算する。単価が変わったら、この表だけを直す。
//
// ⚠️ 各社の公式の使用量・請求の API で取れる費用は、その値を使う（providers.ts）。
//    この表は「取れないものを使用量から見積もる」ときと、ドヤパワーの原価計算に使う。
// ⚠️ confirmedAt が「未確認」の行は、公開されている価格の記憶に基づく仮の値。
//    各社の画面（出典の URL）で見て、確認した日付に書き換えること。

/** 円換算のレート。spend-report.ts / gcp-usage.ts と同じ値 */
export const USD_TO_JPY = 150

/** 消費税率。Stripe の売上（税込）から税抜きの売上を出すときに使う */
export const CONSUMPTION_TAX_RATE = 0.1

export type UnitPrice = {
  /** 単位あたりの価格（米ドル） */
  usd: number
  /** 単位の説明 */
  unit: string
  /** 出典（公式の価格ページ） */
  source: string
  /** 確認した日。「未確認」のものは確認が要る */
  confirmedAt: string
}

export const UNIT_PRICES = {
  /** Supabase Storage の保管。1GB・1か月。Pro は 100GB まで込み（超えた分の単価） */
  supabaseStorageGbMonth: {
    usd: 0.021,
    unit: '1GB・1か月（Pro は 100GB まで込み）',
    source: 'https://supabase.com/pricing',
    confirmedAt: '未確認',
  },
  /** Supabase の配信（egress）。1GB。Pro は 250GB まで込み（超えた分の単価） */
  supabaseEgressGb: {
    usd: 0.09,
    unit: '1GB（Pro は 250GB まで込み）',
    source: 'https://supabase.com/pricing',
    confirmedAt: '未確認',
  },
  /** Supabase Pro の月額の基本料 */
  supabaseProBase: {
    usd: 25,
    unit: '1か月（プロジェクトごとの基本料）',
    source: 'https://supabase.com/pricing',
    confirmedAt: '未確認',
  },
  /** Supabase の DB のディスク。1GB・1か月（Pro は 8GB まで込み） */
  supabaseDbGbMonth: {
    usd: 0.125,
    unit: '1GB・1か月（Pro は 8GB まで込み）',
    source: 'https://supabase.com/pricing',
    confirmedAt: '未確認',
  },
  /** Vercel Pro の月額の基本料（1席）。実費は Billing API で取る。取れないときの目安 */
  vercelProSeat: {
    usd: 20,
    unit: '1席・1か月',
    source: 'https://vercel.com/pricing',
    confirmedAt: '未確認',
  },
  /** AssemblyAI の文字起こし。音声1時間（Universal） */
  assemblyAiHour: {
    usd: 0.15,
    unit: '音声1時間（Universal）',
    source: 'https://www.assemblyai.com/pricing',
    confirmedAt: '未確認',
  },
  /** Google Cloud Run Jobs の CPU。1 vCPU・1秒（高い側の単価で見る） */
  cloudRunVcpuSecond: {
    usd: 0.000024,
    unit: '1 vCPU・1秒',
    source: 'https://cloud.google.com/run/pricing',
    confirmedAt: '未確認',
  },
  /** Google Cloud Run Jobs のメモリ。1GiB・1秒 */
  cloudRunGibSecond: {
    usd: 0.0000025,
    unit: '1GiB・1秒',
    source: 'https://cloud.google.com/run/pricing',
    confirmedAt: '未確認',
  },
  /** Stripe の決済手数料。国内カードの料率（税込の決済額に対して） */
  stripeFeeRate: {
    usd: 0.036,
    unit: '決済額に対する率（3.6%）',
    source: 'https://stripe.com/jp/pricing',
    confirmedAt: '未確認',
  },
} as const satisfies Record<string, UnitPrice>

export const toJpy = (usd: number): number => usd * USD_TO_JPY

/**
 * 動画の処理（Cloud Run Jobs の専用ワーカー）の見積りの前提。
 * ⚠️ 実測前の仮置き。ワーカーの稼働ログ（秒数）が取れたら、実測の中央値と高い側に差し替える。
 */
export const VIDEO_WORKER_ASSUMPTIONS = {
  vcpu: 4,
  memoryGib: 8,
  /** 動画1GBを変換するのにかかる秒数（高い側。約10〜15分の動画の1080p 変換を想定） */
  secondsPerGb: 900,
  /** 変換後のファイルの大きさ（元に対する割合）。保管と配信の増えた分 */
  outputRatio: 0.35,
} as const

/** 1ポイントが賄う原価（円）。docs/architecture/management-agent/PRICING-NEW-2026-10-25.md §3 の「ふつう」の値 */
export const POWER_COST_BASIS_JPY = 3
