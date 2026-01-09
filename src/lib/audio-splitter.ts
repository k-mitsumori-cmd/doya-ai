/**
 * 大きな音声/動画ファイルを分割して処理するためのユーティリティ
 * 
 * 注意: Vercelのサーバーレス関数ではffmpegが使えないため、
 * ファイルを直接GCSから取得して、時間ベースで分割する必要があります。
 */

import { getStorage } from './gcs'

// getBucketNameをインポートできないため、直接実装
function getBucketName(): string {
  const bucketName = process.env.GCS_BUCKET_NAME || 'doya-interview-storage'
  return bucketName
}

/**
 * ファイルを時間ベースで分割（簡易版）
 * 実際の分割にはffmpegが必要ですが、Vercelでは使用できないため、
 * ここでは分割ロジックのインターフェースのみを定義します。
 */
export interface AudioChunk {
  startTime: number // 秒
  endTime: number // 秒
  duration: number // 秒
}

/**
 * ファイルの長さを推定（簡易版）
 * 実際の実装では、メタデータから取得する必要があります。
 */
export async function estimateAudioDuration(fileSize: number, mimeType: string): Promise<number> {
  // 簡易的な推定（実際の実装では、メタデータから取得）
  // MP3: 約1MB = 1分（128kbpsの場合）
  // MP4: 約10MB = 1分（一般的な品質）
  
  if (mimeType.includes('audio')) {
    // 音声ファイル: 1MB ≈ 1分（128kbps）
    return (fileSize / (1024 * 1024)) * 60
  } else if (mimeType.includes('video')) {
    // 動画ファイル: 10MB ≈ 1分（一般的な品質）
    return (fileSize / (10 * 1024 * 1024)) * 60
  }
  
  // デフォルト: 1MB = 1分
  return (fileSize / (1024 * 1024)) * 60
}

/**
 * ファイルを時間ベースでチャンクに分割
 * @param duration ファイルの長さ（秒）
 * @param chunkDuration 各チャンクの長さ（秒、デフォルト: 10分）
 */
export function splitIntoChunks(duration: number, chunkDuration: number = 600): AudioChunk[] {
  const chunks: AudioChunk[] = []
  let startTime = 0
  
  while (startTime < duration) {
    const endTime = Math.min(startTime + chunkDuration, duration)
    chunks.push({
      startTime,
      endTime,
      duration: endTime - startTime,
    })
    startTime = endTime
  }
  
  return chunks
}

/**
 * GCSからファイルの一部を取得（範囲リクエスト）
 * 注意: GCSは範囲リクエストをサポートしていますが、
 * 音声/動画ファイルの場合は、適切な分割ポイントで切る必要があります。
 */
export async function getFileChunkFromGCS(
  fileUrl: string,
  startByte: number,
  endByte: number
): Promise<Buffer> {
  const storage = await getStorage()
  const bucket = storage.bucket(getBucketName())
  
  // URLからパスを抽出
  const urlPattern = /https:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/
  const match = fileUrl.match(urlPattern)
  
  if (!match || !match[1]) {
    throw new Error('Invalid file URL')
  }
  
  const filePath = decodeURIComponent(match[1])
  const file = bucket.file(filePath)
  
  // 範囲リクエストでファイルの一部を取得
  const [buffer] = await file.download({
    start: startByte,
    end: endByte,
  })
  
  return buffer
}

