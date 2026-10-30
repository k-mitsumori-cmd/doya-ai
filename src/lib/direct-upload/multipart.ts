// ============================================
// 直接アップロード：S3互換マルチパート（動画など大きなファイル向け）
// ============================================
// 小分け（パート）にして送り、切れたら届いていないパートだけ送り直す。
//  1. startMultipart   … 送信を始める（UploadId を取り、DB に記録）
//  2. presignParts     … パートごとの署名付きURLを発行（ブラウザが直接 PUT する）
//  3. listUploadedParts… 届いたパートを S3 に問い合わせる（再開の正本は S3）
//  4. completeMultipart… つなげて、実際の大きさを確かめ、DB に記録
//
// ⚠️ 使うには Supabase の S3 アクセスキー（SUPABASE_S3_*）が要る。キーの発行と、
//    バケットの 1 ファイル上限の設定は Supabase の設定変更なので、人が行う。
//    DIRECT_UPLOAD_MULTIPART_ENABLED=true にするまで API は閉じている。

import { randomUUID } from 'crypto'
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import prisma from '@/lib/prisma'

export const MULTIPART_BUCKET = process.env.DIRECT_UPLOAD_MULTIPART_BUCKET || 'direct-uploads'
/** 1本の上限。バケット側の上限（Supabase の設定）と小さい方が効く */
export const MULTIPART_MAX_FILE_SIZE = Number(process.env.DIRECT_UPLOAD_MULTIPART_MAX_BYTES) || 5 * 1024 * 1024 * 1024
export const MULTIPART_MIN_PART = 16 * 1024 * 1024 // 8〜16MB の範囲。S3 の最小 5MB より大きく
const MAX_PARTS = 10000
const PRESIGN_EXPIRES = 3600

const ALLOWED_PREFIX = ['video/', 'audio/']

export function multipartEnabled(): boolean {
  return process.env.DIRECT_UPLOAD_MULTIPART_ENABLED === 'true'
}

let _s3: S3Client | null = null
function s3(): S3Client {
  if (_s3) return _s3
  const endpoint = process.env.SUPABASE_S3_ENDPOINT
  const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3未設定: SUPABASE_S3_ENDPOINT / SUPABASE_S3_ACCESS_KEY_ID / SUPABASE_S3_SECRET_ACCESS_KEY')
  }
  _s3 = new S3Client({
    endpoint,
    region: process.env.SUPABASE_S3_REGION || 'ap-northeast-1',
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })
  return _s3
}

export class MultipartError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

/** ファイルの大きさから 1 パートの大きさを決める（10000 パートを超えない） */
export function choosePartSize(fileSize: number): number {
  return Math.max(MULTIPART_MIN_PART, Math.ceil(fileSize / (MAX_PARTS - 1)))
}

function safeName(name: string): string {
  const ext = (name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
  return `${randomUUID()}.${ext}`
}

export async function startMultipart(userId: string, input: { fileName: unknown; mimeType: unknown; fileSize: unknown; purpose?: unknown }) {
  const { fileName, mimeType, fileSize } = input
  if (typeof fileName !== 'string' || !fileName || fileName.length > 300) throw new MultipartError('ファイル名が不正です')
  const mime = typeof mimeType === 'string' ? mimeType.split(';')[0].trim().toLowerCase() : ''
  if (!ALLOWED_PREFIX.some(p => mime.startsWith(p))) throw new MultipartError('動画・音声のファイルのみ対応しています')
  if (!Number.isSafeInteger(fileSize) || (fileSize as number) <= 0) throw new MultipartError('ファイルサイズが不正です')
  if ((fileSize as number) > MULTIPART_MAX_FILE_SIZE) {
    throw new MultipartError(`ファイルサイズが大きすぎます（上限${Math.round(MULTIPART_MAX_FILE_SIZE / 1024 / 1024 / 1024 * 10) / 10}GB）`)
  }
  const size = fileSize as number
  const objectKey = `${userId}/${safeName(fileName)}`
  const out = await s3().send(new CreateMultipartUploadCommand({ Bucket: MULTIPART_BUCKET, Key: objectKey, ContentType: mime }))
  if (!out.UploadId) throw new MultipartError('送信を始められませんでした', 503)
  const partSize = choosePartSize(size)
  const row = await prisma.directUploadSession.create({
    data: {
      userId, bucket: MULTIPART_BUCKET, objectKey, uploadId: out.UploadId,
      fileName: fileName.slice(0, 300), mimeType: mime, fileSize: BigInt(size), partSize,
      purpose: typeof input.purpose === 'string' ? input.purpose.slice(0, 60) : null,
    },
  })
  return { id: row.id, partSize, totalParts: Math.ceil(size / partSize) }
}

export async function getOwnSession(userId: string, id: unknown) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new MultipartError('送信IDが不正です')
  const row = await prisma.directUploadSession.findFirst({ where: { id, userId } })
  if (!row) throw new MultipartError('見つかりませんでした', 404)
  return row
}

type Session = Awaited<ReturnType<typeof getOwnSession>>

export function totalPartsOf(row: Session): number {
  return Math.ceil(Number(row.fileSize) / row.partSize)
}

export async function presignParts(row: Session, partNumbers: unknown) {
  if (row.status !== 'UPLOADING') throw new MultipartError('この送信は終了しています', 409)
  const total = totalPartsOf(row)
  if (!Array.isArray(partNumbers) || partNumbers.length === 0 || partNumbers.length > 20) throw new MultipartError('パート番号が不正です')
  const nums = partNumbers.map(Number)
  if (nums.some(n => !Number.isInteger(n) || n < 1 || n > total)) throw new MultipartError('パート番号が不正です')
  return Promise.all(nums.map(async partNumber => ({
    partNumber,
    // 最後のパートだけ小さい。大きさはブラウザが切り出すので、ここでは署名だけ
    url: await getSignedUrl(
      s3(),
      new UploadPartCommand({ Bucket: row.bucket, Key: row.objectKey, UploadId: row.uploadId, PartNumber: partNumber }),
      { expiresIn: PRESIGN_EXPIRES }
    ),
  })))
}

export async function listUploadedParts(row: Session): Promise<{ partNumber: number; size: number }[]> {
  if (row.status !== 'UPLOADING') return []
  const parts: { partNumber: number; size: number }[] = []
  let marker: string | undefined
  for (;;) {
    const out = await s3().send(new ListPartsCommand({
      Bucket: row.bucket, Key: row.objectKey, UploadId: row.uploadId, PartNumberMarker: marker, MaxParts: 1000,
    }))
    for (const p of out.Parts || []) parts.push({ partNumber: p.PartNumber!, size: Number(p.Size) })
    if (!out.IsTruncated) break
    marker = String(out.NextPartNumberMarker)
  }
  return parts
}

export async function completeMultipart(row: Session) {
  if (row.status === 'COMPLETED') return { objectKey: row.objectKey, fileSize: Number(row.fileSize) }
  if (row.status !== 'UPLOADING') throw new MultipartError('この送信は終了しています', 409)
  const total = totalPartsOf(row)
  const parts = await listPartsWithEtag(row)
  const have = new Set(parts.map(p => p.PartNumber))
  const missing: number[] = []
  for (let i = 1; i <= total; i++) if (!have.has(i)) missing.push(i)
  if (missing.length) throw new MultipartError(`届いていない部分があります（${missing.length}個）`, 409)
  await s3().send(new CompleteMultipartUploadCommand({
    Bucket: row.bucket, Key: row.objectKey, UploadId: row.uploadId,
    MultipartUpload: { Parts: parts.map(p => ({ PartNumber: p.PartNumber, ETag: p.ETag })) },
  }))
  // つないだあとの実際の大きさを確かめる（申告は信用しない）
  const head = await s3().send(new HeadObjectCommand({ Bucket: row.bucket, Key: row.objectKey }))
  const actual = Number(head.ContentLength)
  if (actual !== Number(row.fileSize) || actual > MULTIPART_MAX_FILE_SIZE) {
    await s3().send(new DeleteObjectCommand({ Bucket: row.bucket, Key: row.objectKey }))
    await prisma.directUploadSession.update({ where: { id: row.id }, data: { status: 'ABORTED' } })
    throw new MultipartError('ファイルの大きさが一致しませんでした。もう一度送ってください', 409)
  }
  await prisma.directUploadSession.update({ where: { id: row.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
  return { objectKey: row.objectKey, fileSize: actual }
}

async function listPartsWithEtag(row: Session) {
  const parts: { PartNumber: number; ETag: string }[] = []
  let marker: string | undefined
  for (;;) {
    const out = await s3().send(new ListPartsCommand({
      Bucket: row.bucket, Key: row.objectKey, UploadId: row.uploadId, PartNumberMarker: marker, MaxParts: 1000,
    }))
    for (const p of out.Parts || []) parts.push({ PartNumber: p.PartNumber!, ETag: p.ETag! })
    if (!out.IsTruncated) break
    marker = String(out.NextPartNumberMarker)
  }
  return parts.sort((a, b) => a.PartNumber - b.PartNumber)
}

export async function abortMultipart(row: Session) {
  if (row.status === 'UPLOADING') {
    await s3().send(new AbortMultipartUploadCommand({ Bucket: row.bucket, Key: row.objectKey, UploadId: row.uploadId })).catch(() => {})
    await prisma.directUploadSession.update({ where: { id: row.id }, data: { status: 'ABORTED' } })
  }
}
