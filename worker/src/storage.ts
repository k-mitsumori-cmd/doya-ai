import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { config } from './config.js'

function authHeaders(): Record<string, string> {
  const key = config.supabaseKey()
  return { apikey: key, authorization: `Bearer ${key}` }
}

function encodePath(p: string): string {
  return p.split('/').map(encodeURIComponent).join('/')
}

/** 入力の保存先を確かめる。許可していないバケットや、上の階層へ抜けるパスは読まない */
export function assertReadable(bucket: string, path: string, userId: string): void {
  // 入力は許可したバケットだけ。自分の出力バケット(音声→文字起こしなど)は、本人の階層の下だけ読める
  const ownOutput = bucket === config.outputBucket() && path.startsWith(`${userId}/`)
  if (!ownOutput && !config.inputBuckets().includes(bucket)) throw new PermanentError('入力のバケットが許可されていません')
  if (!path || path.startsWith('/') || path.split('/').some((s) => s === '..' || s === '.') || path.includes('\0')) {
    throw new PermanentError('入力のパスが正しくありません')
  }
}

export class PermanentError extends Error {}

/**
 * 入力を読むための署名つきURLを作る。ffmpeg にこのURLを直接渡すと、
 * 数GBの動画を /tmp に落とさず、必要な範囲だけを HTTP Range で読める。
 */
export async function signedInputUrl(bucket: string, path: string, userId: string, expiresIn = 6 * 3600): Promise<string> {
  assertReadable(bucket, path, userId)
  const res = await fetch(`${config.supabaseUrl()}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodePath(path)}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
    signal: AbortSignal.timeout(20_000),
  })
  if (res.status === 400 || res.status === 404) throw new PermanentError('入力のファイルが見つかりません')
  if (!res.ok) throw new Error(`署名URLの作成に失敗しました (${res.status})`)
  const json = (await res.json()) as { signedURL?: string; signedUrl?: string }
  const rel = json.signedURL || json.signedUrl
  if (!rel) throw new Error('署名URLが返りませんでした')
  if (/^https?:\/\//.test(rel)) return rel
  return `${config.supabaseUrl()}/storage/v1${rel.startsWith('/') ? '' : '/'}${rel}`
}

/** 出力を Storage に置く。ファイルをメモリに読み込まず、ストリームで送る */
export async function uploadFile(bucket: string, path: string, localPath: string, contentType: string): Promise<number> {
  const size = (await stat(localPath)).size
  const body = Readable.toWeb(createReadStream(localPath)) as unknown as ReadableStream
  const res = await fetch(`${config.supabaseUrl()}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(path)}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': contentType, 'content-length': String(size), 'x-upsert': 'true', 'cache-control': 'max-age=3600' },
    body,
    // @ts-expect-error Node の fetch はストリームの送信に duplex が必要
    duplex: 'half',
  })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200)
    throw new Error(`出力の保存に失敗しました (${res.status}) ${detail}`)
  }
  return size
}
