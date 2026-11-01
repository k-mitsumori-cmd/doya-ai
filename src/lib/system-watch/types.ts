// ドヤAIの常時確認（system-watch）の型。
// 確認は「読むだけ」で行う。本番の利用者のデータを作ったり変えたりしない。

/** 確認の分類。通知で「どこが」壊れたかを示す。 */
export type WatchArea = '画面' | 'API' | 'DB' | '台帳' | 'cron' | '外部サービス' | '設定' | '旗'

/** 1回の確認の結果。 */
export type CheckOutcome = {
  ok: boolean
  /** 確認した URL（画面・API・外部サービス） */
  url?: string
  /** HTTP の状態コード */
  status?: number
  /** 失敗の要約（エラー文の要点。秘密の値は入れない） */
  error?: string
  /** 補足（件数、往復時間など） */
  detail?: string
  /** 旗の値など、変化を知らせたい値。失敗とは別に扱う */
  observed?: string
  /** 前提がそろわず回さなかった（有料の確認では費用に数えない） */
  skipped?: boolean
}

export type CheckDef = {
  id: string
  area: WatchArea
  /** 人が読む名前（例: 画面「ドヤバナー」） */
  label: string
  /** urgent=緊急（@channel）、action=要対応 */
  severity: 'urgent' | 'action'
  /** 何回続けて失敗したら知らせるか。一時的な揺れで知らせないため、外への取得は 2 */
  threshold: number
  /** 失敗が続くとき、知らせ直す間隔（既定 6時間）。直すのに日数がかかる設定の不足は 24時間にする */
  repeatMs?: number
  /** 確認そのものの時間の上限（既定 25秒）。エージェントの作業のように長くかかる確認だけ長くする */
  timeoutMs?: number
  /** 直し方の候補 */
  hints: string[]
  run: () => Promise<CheckOutcome>
}

/** 確認ごとの続きの状態（SystemSetting に JSON で残す）。 */
export type CheckState = {
  ok: boolean
  /** 連続した失敗の回数 */
  failCount: number
  /** 今の状態（成功または失敗）になった時刻 */
  since: string
  /** 失敗を知らせた時刻（知らせていなければ null） */
  notifiedAt: string | null
  /** 前回の失敗の見分け（状態コードとエラーの種類）。変わったら知らせ直す */
  signature?: string
  lastError?: string
  /** 旗などの観測値 */
  observed?: string
}

export type CheckResult = CheckOutcome & { id: string; area: WatchArea; label: string; severity: 'urgent' | 'action'; hints: string[]; at: string; ms: number }

/** 判定の結果、通知に載せる1件。 */
export type WatchEvent =
  | { type: 'failure'; result: CheckResult; state: CheckState; reason: 'new' | 'repeat' | 'changed' }
  | { type: 'recovery'; result: CheckResult; downSince: string; failCount: number }
  | { type: 'observed-change'; result: CheckResult; before: string | undefined }
