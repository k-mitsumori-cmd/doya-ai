import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Cloudflare R2 (S3互換) ストレージクライアント
 */
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAME = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

/**
 * 画像をストレージに保存
 * @param key ストレージキー（例: banners/user123/job456/A.png）
 * @param buffer 画像バッファ
 * @param contentType MIMEタイプ
 * @returns 公開URL
 */
export async function uploadImage(
  key: string,
  buffer: Buffer,
  contentType: string = 'image/png'
): Promise<{ url: string; key: string; size: number }> {
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))
  
  return {
    url: `${PUBLIC_URL}/${key}`,
    key,
    size: buffer.length,
  }
}

/**
 * 署名付きURLを生成（プライベートバケット用）
 */
export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })
  
  return await getSignedUrl(s3Client, command, { expiresIn })
}

/**
 * URLから画像をダウンロードしてバッファに変換
 */
export async function downloadImageToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`)
  }
  
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * ストレージキーを生成
 */
export function generateStorageKey(userId: string, jobId: string, variant: string): string {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  return `banners/${date}/${userId}/${jobId}/${variant}.png`
}

