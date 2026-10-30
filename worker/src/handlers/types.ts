import type { JobRow } from '../db.js'

export type OutputFile = { name: string; localPath: string; contentType: string }

export type HandlerContext = {
  job: JobRow
  /** ffmpeg に渡す入力(署名つきURL) */
  inputUrl: string
  /** この実行専用の作業フォルダ(終了時に消す) */
  workDir: string
  /** 進み具合の報告。ratio は 0-1。ここで 5%〜90% に割り当てる */
  progress: (ratio: number, stage: string) => void
}

/** 成功のあとに続けて積むジョブ(例: 音声ができたら文字起こし) */
export type FollowUp = { kind: string; inputBucket: string; inputPath: string; params?: Record<string, unknown>; dedupeKey: string }

export type HandlerResult = { outputs: OutputFile[]; result: Record<string, unknown>; followUps?: FollowUp[] }

export type Handler = (ctx: HandlerContext) => Promise<HandlerResult>
