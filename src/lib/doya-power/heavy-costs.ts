// ============================================
// 重い処理のドヤパワーの量（原価から計算する）
// ============================================
// 大きなファイルのアップロード・動画の処理・保管・文字起こし・Gmail の送信は、原価が処理の大きさで決まる。
// 量は、src/lib/cost/unit-prices.ts の単価から計算する。単価や前提を変えると、ここも自動で変わる。
//
// 決まり: 量は「原価（円）÷ 1ポイントが賄う原価（POWER_COST_BASIS_JPY）」を切り上げた整数。
//         切り上げるので、どの操作も原価より安くならない（heavy-costs の回帰テストで確かめる）。
// ⚠️ gmail.send は原価がほぼ 0 なので、原価から計算せず、迷惑メールの歯止めとして決めた値（POLICY）を使う。
//    この値は営業・価格の判断（本人に決めてもらう）。

import {
  POWER_COST_BASIS_JPY,
  UNIT_PRICES,
  VIDEO_WORKER_ASSUMPTIONS as W,
  toJpy,
} from '@/lib/cost/unit-prices'

/** 原価（円）からドヤパワーの量を出す。1未満にはしない */
export function powerFromCostJpy(costJpy: number): number {
  if (!Number.isFinite(costJpy) || costJpy <= 0) return 1
  // 浮動小数点のわずかなずれで 1 つ多くならないように、小さな許容を引いてから切り上げる
  return Math.max(1, Math.ceil(costJpy / POWER_COST_BASIS_JPY - 1e-9))
}

/** 大きなファイル 1GB をアップロードして置く原価（円）: 保管1か月 ＋ 配信1回 */
export function uploadGbCostJpy(): number {
  return toJpy(UNIT_PRICES.supabaseStorageGbMonth.usd + UNIT_PRICES.supabaseEgressGb.usd)
}

/** 保管を1か月延ばす原価（円）。1GBあたり */
export function storageGbMonthCostJpy(): number {
  return toJpy(UNIT_PRICES.supabaseStorageGbMonth.usd)
}

/** 動画 1GB を専用ワーカーで処理する原価（円）: 計算 ＋ 元の動画の取り込み（配信）＋ 変換後の保管と配信 */
export function videoProcessGbCostJpy(): number {
  const perSecondUsd =
    W.vcpu * UNIT_PRICES.cloudRunVcpuSecond.usd + W.memoryGib * UNIT_PRICES.cloudRunGibSecond.usd
  const computeUsd = W.secondsPerGb * perSecondUsd
  const intakeUsd = UNIT_PRICES.supabaseEgressGb.usd
  const outputUsd =
    W.outputRatio * (UNIT_PRICES.supabaseStorageGbMonth.usd + UNIT_PRICES.supabaseEgressGb.usd)
  return toJpy(computeUsd + intakeUsd + outputUsd)
}

/** 文字起こし 60 分の原価（円）。やり直し・無音の区間などの増えを見て 1.3 倍で置く */
export const TRANSCRIBE_RETRY_MARGIN = 1.3
export function transcribeHourCostJpy(): number {
  return toJpy(UNIT_PRICES.assemblyAiHour.usd) * TRANSCRIBE_RETRY_MARGIN
}

/** 方針で決めた値（原価ではない）。本人が決める */
export const POLICY = {
  /** Gmail の送信 1通。原価はほぼ 0。迷惑メールの歯止めと、使った分の見える化のため */
  'gmail.send': 1,
} as const

/** 計算した量。costs.ts の表がこれを取り込む */
export const HEAVY_POWER_COSTS = {
  /** 大きなファイルのアップロード 1GB ごと（保管1か月＋配信1回を含む） */
  'upload.gb': powerFromCostJpy(uploadGbCostJpy()),
  /** 保管の延長 1GB・1か月ごと（アップロードに含まれる最初の1か月のあと） */
  'storage.gb.month': powerFromCostJpy(storageGbMonthCostJpy()),
  /** 動画の処理（専用ワーカー）1GB ごと */
  'video.process.gb': powerFromCostJpy(videoProcessGbCostJpy()),
  /** Gmail の送信 1通 */
  'gmail.send': POLICY['gmail.send'],
} as const

/** 画面・報告に出す、量の根拠（原価・量・前提）。報告の表を作るのにも使う */
export function heavyCostBasis() {
  return [
    { action: 'upload.gb', unit: '1GB', costJpy: uploadGbCostJpy(), power: HEAVY_POWER_COSTS['upload.gb'], basis: '保管1か月＋配信1回' },
    { action: 'storage.gb.month', unit: '1GB・1か月', costJpy: storageGbMonthCostJpy(), power: HEAVY_POWER_COSTS['storage.gb.month'], basis: '保管のみ' },
    { action: 'video.process.gb', unit: '1GB', costJpy: videoProcessGbCostJpy(), power: HEAVY_POWER_COSTS['video.process.gb'], basis: `Cloud Run ${W.vcpu}vCPU/${W.memoryGib}GiB × ${W.secondsPerGb}秒＋取り込み＋変換後の保管と配信` },
    { action: 'transcribe.hour', unit: '音声60分', costJpy: transcribeHourCostJpy(), power: powerFromCostJpy(transcribeHourCostJpy()), basis: `AssemblyAI ×${TRANSCRIBE_RETRY_MARGIN}` },
    { action: 'gmail.send', unit: '1通', costJpy: 0, power: HEAVY_POWER_COSTS['gmail.send'], basis: '原価ほぼ0。方針で決めた値' },
  ] as const
}
