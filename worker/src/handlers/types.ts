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

export type HandlerResult = { outputs: OutputFile[]; result: Record<string, unknown> }

export type Handler = (ctx: HandlerContext) => Promise<HandlerResult>
