// 小分け送信（multipart.ts）の検査。本物の S3 クライアントと、Node で書いた S3 互換の偽サーバー、記憶の中の偽 DB を使う。
// 本番にも Supabase にも触れない。実行: npx tsx --test src/lib/direct-upload/multipart.test.ts
// ・署名付きURL へ 100MB を小分けで PUT し、ETag・再開（届いたパートだけを数える）・つなぎ合わせを確かめる
// ・署名付きURL に空の本文のチェックサムが入らないこと、リージョンが必須であること、他人の送信を操作できないことを確かめる
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createHash } from 'node:crypto'
import type { AddressInfo } from 'node:net'

const MB = 1024 * 1024

// ---------- 偽の S3（パス形式。署名の中身は検証せず、期限・リージョン・チェックサムの形だけ本物に近づけて見る） ----------
type Part = { size: number; etag: string }
function startFakeS3() {
  const uploads = new Map<string, { key: string; parts: Map<number, Part>; closed?: boolean }>()
  const objects = new Map<string, number>()
  let seq = 0
  const log: string[] = []
  const server = http.createServer((req, res) => {
    const u = new URL(req.url!, 'http://x')
    const [, bucket, ...rest] = u.pathname.split('/')
    const key = rest.join('/')
    const q = u.searchParams
    const send = (status: number, body = '', headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'content-type': 'application/xml', ...headers }); res.end(body)
    }
    const chunks: Buffer[] = []
    let size = 0
    const hash = createHash('md5')
    req.on('data', (c: Buffer) => { size += c.length; hash.update(c); if (req.method === 'POST') chunks.push(c) })
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString() // POST（つなげるパートの一覧）だけ保持する
      if (req.method === 'POST' && q.has('uploads')) {
        const id = `up-${++seq}`
        uploads.set(id, { key: `${bucket}/${key}`, parts: new Map() })
        log.push(`create ${id}`)
        return send(200, `<InitiateMultipartUploadResult><Bucket>${bucket}</Bucket><Key>${key}</Key><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`)
      }
      const up = uploads.get(q.get('uploadId') || '')
      if (req.method === 'PUT' && q.has('partNumber')) {
        if (!up || up.closed) return send(404, '<Error><Code>NoSuchUpload</Code></Error>')
        // 署名付きURL の形（期限・署名・リージョン）。リージョン違いは本物の S3 でも署名エラーになる
        if (!q.get('X-Amz-Signature') || !/\/us-east-1\/s3\/aws4_request$/.test(q.get('X-Amz-Credential') || '')) {
          return send(403, '<Error><Code>SignatureDoesNotMatch</Code></Error>')
        }
        // 本物の S3 は、URL にチェックサムがあれば本文と照合する。空の本文の CRC32（AAAAAA==）は一致せず拒否される
        const crc = q.get('x-amz-checksum-crc32')
        if (crc) return send(400, '<Error><Code>BadDigest</Code></Error>')
        const n = Number(q.get('partNumber'))
        const etag = `"${hash.digest('hex')}"`
        up.parts.set(n, { size, etag })
        return send(200, '', { ETag: etag })
      }
      if (req.method === 'GET' && q.has('uploadId')) {
        if (!up || up.closed) return send(404, '<Error><Code>NoSuchUpload</Code></Error>')
        const marker = Number(q.get('part-number-marker') || 0)
        const max = Number(q.get('max-parts') || 1000)
        const all = [...up.parts.entries()].sort((a, b) => a[0] - b[0]).filter(([n]) => n > marker)
        const page = all.slice(0, max)
        const trunc = all.length > page.length
        const xml = page.map(([n, p]) => `<Part><PartNumber>${n}</PartNumber><ETag>${p.etag}</ETag><Size>${p.size}</Size></Part>`).join('')
        return send(200, `<ListPartsResult><Bucket>${bucket}</Bucket><Key>${key}</Key><UploadId>${q.get('uploadId')}</UploadId><PartNumberMarker>${marker}</PartNumberMarker><NextPartNumberMarker>${page.length ? page[page.length - 1][0] : 0}</NextPartNumberMarker><MaxParts>${max}</MaxParts><IsTruncated>${trunc}</IsTruncated>${xml}</ListPartsResult>`)
      }
      if (req.method === 'POST' && q.has('uploadId')) {
        if (!up || up.closed) return send(404, '<Error><Code>NoSuchUpload</Code></Error>')
        // 本文（つなげるパートの一覧）を読む
        {
          const listed = [...body.matchAll(/<Part>(.*?)<\/Part>/g)].map(m => ({
            n: Number(/<PartNumber>(\d+)<\/PartNumber>/.exec(m[1])![1]),
            etag: /<ETag>([^<]*)<\/ETag>/.exec(m[1])![1].replace(/&quot;/g, '"'),
          }))
          if (listed.length === 0) return send(400, '<Error><Code>MalformedXML</Code></Error>')
          let total = 0
          let prev = 0
          for (const l of listed) {
            const p = up.parts.get(l.n)
            if (!p || p.etag !== l.etag || l.n <= prev) return send(400, '<Error><Code>InvalidPart</Code></Error>')
            total += p.size; prev = l.n
          }
          objects.set(up.key, total); up.closed = true
          log.push(`complete ${q.get('uploadId')}`)
          return send(200, `<CompleteMultipartUploadResult><Bucket>${bucket}</Bucket><Key>${key}</Key><ETag>"x-${listed.length}"</ETag></CompleteMultipartUploadResult>`)
        }
      }
      if (req.method === 'DELETE' && q.has('uploadId')) {
        if (up) { up.closed = true; log.push(`abort ${q.get('uploadId')}`) }
        return send(204)
      }
      if (req.method === 'HEAD') {
        const o = objects.get(`${bucket}/${key}`)
        if (o === undefined) return send(404)
        return send(200, '', { 'content-length': String(o) })
      }
      if (req.method === 'DELETE') { objects.delete(`${bucket}/${key}`); return send(204) }
      send(400, '<Error><Code>Unsupported</Code></Error>')
    })
  })
  return new Promise<{ url: string; uploads: typeof uploads; objects: typeof objects; log: string[]; close: () => Promise<void> }>(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      resolve({ url: `http://127.0.0.1:${port}`, uploads, objects, log, close: () => new Promise(r => server.close(() => r())) })
    })
  })
}

// ---------- 偽の DB（この部品が使う分だけ） ----------
type Row = Record<string, any>
function fakePrisma() {
  const sessions: Row[] = []
  const stored: Row[] = []
  let n = 0
  const api: any = {
    directUploadSession: {
      findMany: async ({ where }: any) => sessions.filter(r =>
        (!where.userId || r.userId === where.userId) && (!where.status || r.status === where.status) &&
        (!where.createdAt?.lt || r.createdAt < where.createdAt.lt)),
      findFirst: async ({ where }: any) => sessions.find(r => r.id === where.id && r.userId === where.userId) ?? null,
      create: async ({ data }: any) => { const r = { id: `s${++n}`, status: 'UPLOADING', createdAt: new Date(), ...data }; sessions.push(r); return r },
      update: async ({ where, data }: any) => Object.assign(sessions.find(r => r.id === where.id)!, data),
    },
    storedFile: { upsert: async ({ create }: any) => { stored.push(create); return create } },
    $executeRaw: async () => 0,
    $transaction: async (x: any) => (typeof x === 'function' ? x(api) : Promise.all(x)),
  }
  return { api, sessions, stored }
}

// ---------- 準備：外部の部品を差し替えて multipart.ts を読み込む ----------
const db = fakePrisma()
const Module = require('module')
const origLoad = Module._load
Module._load = function (request: string, ...rest: any[]) {
  if (request === '@/lib/prisma') return { __esModule: true, default: db.api, prisma: db.api }
  if (request === './stored-files') {
    return {
      getUsedBytes: async () => 0,
      getUserPlan: async () => 'FREE',
      quotaMessage: () => null,
      initialExpiry: () => null,
    }
  }
  return origLoad.call(this, request, ...rest)
}

let fake: Awaited<ReturnType<typeof startFakeS3>>
let mp: typeof import('./multipart')

test.before(async () => {
  fake = await startFakeS3()
  process.env.SUPABASE_S3_ENDPOINT = fake.url
  process.env.SUPABASE_S3_ACCESS_KEY_ID = 'test-key'
  process.env.SUPABASE_S3_SECRET_ACCESS_KEY = 'test-secret'
  process.env.SUPABASE_S3_REGION = 'us-east-1'
  mp = require('./multipart')
})
test.after(async () => { Module._load = origLoad; await fake.close() })

/** ブラウザの代わり：署名付きURL へパートを PUT する */
async function putPart(row: any, n: number, fileSize: number) {
  const [{ url }] = await mp.presignParts(row, [n])
  const total = mp.totalPartsOf(row)
  const size = n === total ? fileSize - row.partSize * (total - 1) : row.partSize
  return fetch(url, { method: 'PUT', body: Buffer.alloc(size, n) })
}

const SIZE = 100 * MB

test('署名付きURL に空の本文のチェックサムが入らず、content-length を署名する', async () => {
  const { id } = await mp.startMultipart('u1', { fileName: 'a.mp4', mimeType: 'video/mp4', fileSize: SIZE })
  const row = await mp.getOwnSession('u1', id)
  const [{ url }] = await mp.presignParts(row, [1])
  const u = new URL(url)
  assert.equal(u.searchParams.get('x-amz-checksum-crc32'), null)
  assert.equal(u.searchParams.get('x-amz-sdk-checksum-algorithm'), null)
  assert.match(u.searchParams.get('X-Amz-SignedHeaders') || '', /content-length/)
  assert.match(u.searchParams.get('X-Amz-Credential') || '', /\/us-east-1\/s3\//)
  await mp.abortMultipart(row)
})

test('100MB を小分けで送り、つなぎ合わせて台帳に入る（ETag つき）', async () => {
  const { id, partSize, totalParts } = await mp.startMultipart('u1', { fileName: 'b.mp4', mimeType: 'video/mp4', fileSize: SIZE })
  assert.equal(partSize, 16 * MB)
  assert.equal(totalParts, 7) // 16MB × 6 + 4MB
  const row = await mp.getOwnSession('u1', id)
  for (let n = 1; n <= totalParts; n++) {
    const r = await putPart(row, n, SIZE)
    assert.equal(r.status, 200)
    assert.ok(r.headers.get('etag'))
  }
  const out = await mp.completeMultipart(row)
  assert.equal(out.fileSize, SIZE)
  assert.equal(fake.objects.get(`direct-uploads/${out.objectKey}`), SIZE)
  assert.equal(db.stored.at(-1)!.fileSize, BigInt(SIZE))
  assert.equal((await mp.getOwnSession('u1', id)).status, 'COMPLETED')
  // 2回目の完了は同じ結果（重複登録しない）
  assert.equal((await mp.completeMultipart(await mp.getOwnSession('u1', id))).fileSize, SIZE)
})

test('途中で切れても、届いたパートだけを数えて、残りだけを送れば完了する（再開）', async () => {
  const { id, totalParts } = await mp.startMultipart('u1', { fileName: 'c.mov', mimeType: 'video/quicktime', fileSize: SIZE })
  let row = await mp.getOwnSession('u1', id)
  for (const n of [1, 2, 3]) await putPart(row, n, SIZE)
  // 4つ目は途中で切れた想定で送らない。新しい画面で状況を問い合わせる
  row = await mp.getOwnSession('u1', id)
  const have = await mp.listUploadedParts(row)
  assert.deepEqual(have.map(p => p.partNumber), [1, 2, 3])
  assert.ok(have.every(p => p.size === row.partSize))
  // 足りないまま完了しようとしたら断る
  await assert.rejects(() => mp.completeMultipart(row), (e: any) => e.status === 409 && /届いていない/.test(e.message))
  for (let n = 4; n <= totalParts; n++) await putPart(row, n, SIZE)
  assert.equal((await mp.completeMultipart(row)).fileSize, SIZE)
})

test('同じパートを送り直しても数は増えない', async () => {
  const { id } = await mp.startMultipart('u1', { fileName: 'd.mp3', mimeType: 'audio/mpeg', fileSize: 40 * MB })
  const row = await mp.getOwnSession('u1', id)
  await putPart(row, 1, 40 * MB); await putPart(row, 1, 40 * MB)
  assert.equal((await mp.listUploadedParts(row)).length, 1)
  await mp.abortMultipart(row)
})

test('他人の送信は見えず、続きも完了もできない', async () => {
  const { id } = await mp.startMultipart('u1', { fileName: 'e.mp4', mimeType: 'video/mp4', fileSize: SIZE })
  await assert.rejects(() => mp.getOwnSession('u2', id), (e: any) => e.status === 404)
  await assert.rejects(() => mp.getOwnSession('u2', '../x'), (e: any) => e.status === 400)
  await mp.abortMultipart(await mp.getOwnSession('u1', id))
})

test('パート番号の範囲外・件数超過は断る', async () => {
  const { id, totalParts } = await mp.startMultipart('u1', { fileName: 'f.mp4', mimeType: 'video/mp4', fileSize: SIZE })
  const row = await mp.getOwnSession('u1', id)
  for (const bad of [[0], [totalParts + 1], [1.5], [], 'x', Array.from({ length: 21 }, (_, i) => i + 1)]) {
    await assert.rejects(() => mp.presignParts(row, bad), (e: any) => e.status === 400)
  }
  await mp.abortMultipart(row)
  await assert.rejects(() => mp.presignParts(row, [1]), (e: any) => e.status === 409)
})

test('動画・音声以外、上限超え、不正なサイズは始められない', async () => {
  const base = { fileName: 'x.bin', mimeType: 'video/mp4', fileSize: MB }
  await assert.rejects(() => mp.startMultipart('u1', { ...base, mimeType: 'application/pdf' }), (e: any) => e.status === 400)
  await assert.rejects(() => mp.startMultipart('u1', { ...base, mimeType: '' }), (e: any) => e.status === 400)
  await assert.rejects(() => mp.startMultipart('u1', { ...base, fileSize: mp.MULTIPART_MAX_FILE_SIZE + 1 }), (e: any) => e.status === 400)
  await assert.rejects(() => mp.startMultipart('u1', { ...base, fileSize: 0 }), (e: any) => e.status === 400)
  await assert.rejects(() => mp.startMultipart('u1', { ...base, fileSize: 1.5 }), (e: any) => e.status === 400)
})

test('1人が同時に進められるのは6本まで', async () => {
  const ids: string[] = []
  for (let i = 0; i < 6; i++) ids.push((await mp.startMultipart('u9', { fileName: 'g.mp4', mimeType: 'video/mp4', fileSize: MB })).id)
  await assert.rejects(() => mp.startMultipart('u9', { fileName: 'g.mp4', mimeType: 'video/mp4', fileSize: MB }), (e: any) => e.status === 429)
  for (const id of ids) await mp.abortMultipart(await mp.getOwnSession('u9', id))
})

test('24時間たった未完了の送信は、掃除で S3 側も中止される', async () => {
  const { id } = await mp.startMultipart('u5', { fileName: 'h.mp4', mimeType: 'video/mp4', fileSize: SIZE })
  const row = db.sessions.find(r => r.id === id)!
  const upId = row.uploadId
  row.createdAt = new Date(Date.now() - 25 * 3600 * 1000)
  const r = await mp.purgeStaleMultipart()
  assert.ok(r.aborted >= 1 && r.failed === 0)
  assert.equal(row.status, 'ABORTED')
  assert.ok(fake.log.includes(`abort ${upId}`))
})

test('S3 の設定が欠けたら（リージョンを含め）始められない', async () => {
  // s3() はクライアントを保持するため、別のモジュールとして読み直して確かめる
  const saved = process.env.SUPABASE_S3_REGION
  delete process.env.SUPABASE_S3_REGION
  delete require.cache[require.resolve('./multipart')]
  const fresh = require('./multipart') as typeof import('./multipart')
  await assert.rejects(
    () => fresh.startMultipart('u7', { fileName: 'i.mp4', mimeType: 'video/mp4', fileSize: MB }),
    /SUPABASE_S3_REGION/,
  )
  process.env.SUPABASE_S3_REGION = saved
  delete require.cache[require.resolve('./multipart')]
  mp = require('./multipart')
})

test('旗が true のときだけ有効', () => {
  const v = process.env.DIRECT_UPLOAD_MULTIPART_ENABLED
  delete process.env.DIRECT_UPLOAD_MULTIPART_ENABLED
  assert.equal(mp.multipartEnabled(), false)
  process.env.DIRECT_UPLOAD_MULTIPART_ENABLED = '1'
  assert.equal(mp.multipartEnabled(), false)
  process.env.DIRECT_UPLOAD_MULTIPART_ENABLED = 'true'
  assert.equal(mp.multipartEnabled(), true)
  if (v === undefined) delete process.env.DIRECT_UPLOAD_MULTIPART_ENABLED; else process.env.DIRECT_UPLOAD_MULTIPART_ENABLED = v
})
