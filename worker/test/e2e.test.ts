// ローカル検証: 本物の Postgres と ffmpeg を使い、Supabase Storage だけを同じ形の模擬サーバーに置き換える。
// 実行: DATABASE_URL=postgresql://... SAMPLE_VIDEO=/path/sample.mp4 npx tsx --test test/e2e.test.ts
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createReadStream, createWriteStream, mkdirSync, statSync, existsSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, before, test } from 'node:test'
import type { AddressInfo } from 'node:net'

const root = await mkdtemp(join(tmpdir(), 'mock-storage-'))
const seen: { method: string; range?: string }[] = []
const served: Record<string, number> = {}
const mockAai = { posts: 0, gets: 0 }
let failUploads = false
const server = createServer((req, res) => {
  const url = new URL(req.url!, 'http://x')
  const m = url.pathname.match(/^\/storage\/v1\/object\/(sign\/)?([^/]+)\/(.+)$/)
  if (!m) return void res.writeHead(404).end()
  if (req.headers.authorization !== 'Bearer test-key' && !m[1]) return void res.writeHead(401).end()
  const file = join(root, m[2], decodeURIComponent(m[3]))
  if (req.method === 'POST' && m[1]) {
    if (!existsSync(file)) return void res.writeHead(404).end('{}')
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ signedURL: `/object/sign/${m[2]}/${m[3]}?token=secret-token` }))
  } else if (req.method === 'GET' && m[1]) {
    if (!existsSync(file)) return void res.writeHead(404).end()
    const size = statSync(file).size
    const range = req.headers.range
    seen.push({ method: 'GET', range })
    const r = range?.match(/bytes=(\d*)-(\d*)/)
    if (r) {
      const start = r[1] ? Number(r[1]) : 0
      const end = r[2] ? Math.min(Number(r[2]), size - 1) : size - 1
      res.writeHead(206, { 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1, 'accept-ranges': 'bytes' })
      served[m[3]] = (served[m[3]] || 0) + (end - start + 1)
      createReadStream(file, { start, end }).pipe(res)
    } else {
      res.writeHead(200, { 'content-length': size, 'accept-ranges': 'bytes' })
      served[m[3]] = (served[m[3]] || 0) + size
      createReadStream(file).pipe(res)
    }
  } else if (req.method === 'POST' && failUploads) {
    req.resume()
    res.writeHead(503).end('{}')
  } else if (req.method === 'POST') {
    mkdirSync(dirname(file), { recursive: true })
    req.pipe(createWriteStream(file)).on('finish', () => res.writeHead(200, { 'content-type': 'application/json' }).end('{"Key":"ok"}'))
  } else res.writeHead(405).end()
})
const aai = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/v2/transcript') {
    mockAai.posts++
    let b = ''
    req.on('data', (d) => (b += d))
    req.on('end', () => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id: 'tr_mock1', audio_url: JSON.parse(b).audio_url ? 'set' : 'none' })))
  } else if (req.method === 'GET' && req.url === '/v2/transcript/tr_mock1') {
    mockAai.gets++
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ status: 'completed', text: 'こんにちは', confidence: 0.9, audio_duration: 12, utterances: [{ start: 0, end: 1000, text: 'こんにちは', speaker: 'A' }] }))
  } else res.writeHead(404).end()
})
await new Promise<void>((r) => aai.listen(0, '127.0.0.1', r))
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
const port = (server.address() as AddressInfo).port

process.env.SUPABASE_URL = `http://127.0.0.1:${port}`
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
process.env.MEDIA_JOB_INPUT_BUCKETS = 'uploads'
process.env.MEDIA_OUTPUT_BUCKET = 'media-jobs'
process.env.MEDIA_HEARTBEAT_MS = '500'
process.env.MEDIA_ALLOW_HTTP = '1'
process.env.ASSEMBLYAI_API_KEY = 'mock-key'
process.env.ASSEMBLYAI_BASE_URL = `http://127.0.0.1:${(aai.address() as AddressInfo).port}/v2`

const { getPool, claimJob, closePool } = await import('../src/db.js')
const { runJob } = await import('../src/runner.js')
const pool = () => getPool()

const USER = 'user_e2e'
async function insertJob(id: string, kind: string, path: string, extra: Record<string, unknown> = {}) {
  await pool().query(
    `INSERT INTO media_job (id, "userId", kind, "inputBucket", "inputPath", params, "updatedAt") VALUES ($1,$2,$3,'uploads',$4,$5::jsonb,now())`,
    [id, USER, kind, path, JSON.stringify(extra.params ?? null)]
  )
}
async function row(id: string) {
  return (await pool().query(`SELECT * FROM media_job WHERE id=$1`, [id])).rows[0]
}

before(async () => {
  await pool().query(`DELETE FROM media_job`)
  await pool().query(`DELETE FROM "User" WHERE id=$1`, [USER])
  await pool().query(`INSERT INTO "User" (id, email, "updatedAt") VALUES ($1,'e2e@example.com',now())`, [USER])
  mkdirSync(join(root, 'uploads', USER), { recursive: true })
  const { copyFileSync } = await import('node:fs')
  copyFileSync(process.env.SAMPLE_VIDEO!, join(root, 'uploads', USER, 'sample.mp4'))
})
after(async () => {
  await closePool()
  server.close()
  aai.close()
})

test('音声の抜き出し・サムネイル・720p変換が通り、結果が保存先とDBに入る', async () => {
  await insertJob('j_audio', 'extract_audio', `${USER}/sample.mp4`)
  await insertJob('j_thumb', 'thumbnail', `${USER}/sample.mp4`, { params: { count: 3 } })
  await insertJob('j_prev', 'preview_720p', `${USER}/sample.mp4`)
  for (const id of ['j_audio', 'j_thumb', 'j_prev']) {
    const job = await claimJob('w-test', id)
    assert.ok(job, `${id} を確保できる`)
    assert.equal(job.attempts, 1)
    assert.equal((await runJob(job, 'w-test')).outcome, 'succeeded')
    const r = await row(id)
    assert.equal(r.status, 'succeeded')
    assert.equal(r.progress, 100)
    assert.equal(r.lockedBy, null)
    for (const o of r.outputs) {
      const f = join(root, o.bucket, o.path)
      assert.ok(existsSync(f), `${o.path} が保存されている`)
      assert.equal(statSync(f).size, o.size)
      assert.ok(o.path.startsWith(`${USER}/${id}/`))
    }
    console.log(id, r.outputs.map((o: { name: string; size: number }) => `${o.name}:${o.size}B`).join(' '), JSON.stringify(r.result))
  }
  assert.equal((await row('j_thumb')).outputs.length, 3)
  // 入力は全体を /tmp に落とさず、HTTP Range で読んでいる
  assert.ok(seen.some((s) => s.range), 'Range 読みが使われた')
})

test('同じジョブを2つのワーカーが同時に確保しても1つだけが取れる', async () => {
  await insertJob('j_race', 'thumbnail', `${USER}/sample.mp4`)
  const got = (await Promise.all(Array.from({ length: 8 }, (_, i) => claimJob(`w${i}`, 'j_race')))).filter(Boolean)
  assert.equal(got.length, 1)
})

test('失敗は待ちを置いて再試行され、3回で failed になる。永続エラーは即 failed', async () => {
  await insertJob('j_missing', 'thumbnail', `${USER}/nothing.mp4`)
  const j = (await claimJob('w-retry', 'j_missing'))!
  assert.equal((await runJob(j, 'w-retry')).outcome, 'failed') // 入力なし=永続エラー
  assert.equal((await row('j_missing')).status, 'failed')

  // 一時的な失敗: 出力の保存先が 503 を返し続ける
  failUploads = true
  await insertJob('j_broken', 'thumbnail', `${USER}/sample.mp4`)
  for (let n = 1; n <= 3; n++) {
    await pool().query(`UPDATE media_job SET "runAfter"=now() WHERE id='j_broken'`)
    const job = (await claimJob('w-retry', 'j_broken'))!
    assert.equal(job.attempts, n)
    const out = (await runJob(job, 'w-retry')).outcome
    const r = await row('j_broken')
    if (n < 3) {
      assert.equal(out, 'requeued')
      assert.equal(r.status, 'queued')
      assert.ok(r.runAfter.getTime() > Date.now() + (n === 1 ? 60_000 : 300_000), '待ち時間が指数で伸びる')
      assert.equal(await claimJob('w-retry', 'j_broken'), null, '待ち時間のうちは確保できない')
    } else {
      assert.equal(out, 'failed')
      assert.equal(r.status, 'failed')
    }
  }
  failUploads = false
  // 読めないファイルは、再試行せずすぐ failed
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(root, 'uploads', USER, 'broken.mp4'), 'not a video')
  await insertJob('j_garbage', 'preview_720p', `${USER}/broken.mp4`)
  assert.equal((await runJob((await claimJob('w-retry', 'j_garbage'))!, 'w-retry')).outcome, 'failed')
})

test('心拍が止まったジョブは別のワーカーが拾い直す。回数を使い切ったものは拾わない', async () => {
  await insertJob('j_stale', 'thumbnail', `${USER}/sample.mp4`)
  await claimJob('w-dead', 'j_stale')
  assert.equal(await claimJob('w-new', 'j_stale'), null, '心拍が新しいうちは拾えない')
  await pool().query(`UPDATE media_job SET "heartbeatAt"=now()-interval '6 minutes' WHERE id='j_stale'`)
  const again = await claimJob('w-new', 'j_stale')
  assert.ok(again)
  assert.equal(again.attempts, 2)
  // 古いワーカーがロックを失ったあとに更新しても反映されない
  const { touch, markSucceeded } = await import('../src/db.js')
  assert.equal(await touch('j_stale', 'w-dead'), false)
  assert.equal(await markSucceeded('j_stale', 'w-dead', [], {}), false)

  await pool().query(`UPDATE media_job SET attempts=3, "heartbeatAt"=now()-interval '6 minutes' WHERE id='j_stale'`)
  assert.equal(await claimJob('w-third', 'j_stale'), null)
})

test('許可していないバケットや ../ を含む入力は読まない', async () => {
  await pool().query(
    `INSERT INTO media_job (id, "userId", kind, "inputBucket", "inputPath", "updatedAt") VALUES ('j_bad1',$1,'thumbnail','secret-bucket','a.mp4',now()), ('j_bad2',$1,'thumbnail','uploads','../x.mp4',now())`,
    [USER]
  )
  for (const id of ['j_bad1', 'j_bad2']) {
    const job = (await claimJob('w-bad', id))!
    assert.equal((await runJob(job, 'w-bad')).outcome, 'failed')
  }
})

test('まとめ処理は入力を1回だけ読み、音声・720p・サムネイルを作る。文字起こしは続けて積まれる', async () => {
  const size = statSync(join(root, 'uploads', USER, 'sample.mp4')).size
  // 別々に流した場合の読み出し量(比較用)
  for (const k of Object.keys(served)) delete served[k]
  for (const [id, kind] of [['s_a', 'extract_audio'], ['s_t', 'thumbnail'], ['s_p', 'preview_720p']] as const) {
    await insertJob(id, kind, `${USER}/sample.mp4`)
    const j = (await claimJob('w-sep', id))!
    await runJob(j, 'w-sep')
  }
  const separate = served[`${USER}/sample.mp4`] ?? 0
  for (const k of Object.keys(served)) delete served[k]

  await insertJob('j_all', 'process_all', `${USER}/sample.mp4`, { params: { thumbnails: 2, transcribe: true } })
  const job = (await claimJob('w-all', 'j_all'))!
  const res = await runJob(job, 'w-all')
  assert.equal(res.outcome, 'succeeded')
  const r = await row('j_all')
  assert.deepEqual(r.outputs.map((o: { name: string }) => o.name).sort(), ['audio.mp3', 'preview-720p.mp4', 'thumb-1.jpg', 'thumb-2.jpg'])
  const together = served[`${USER}/sample.mp4`] ?? 0
  console.log(`入力${size}B: 別々=${separate}B(${(separate / size).toFixed(1)}回分) / まとめ=${together}B(${(together / size).toFixed(1)}回分)`)
  assert.ok(together <= size * 2.2, '入力の読み込みは約1回分(確認の読み込みを含めても2.2倍以内)')
  assert.ok(together < separate, 'まとめた方が読み出しが少ない')

  // 続けて積まれた文字起こしを、同じ実行の中で処理する
  assert.equal(res.followUpIds.length, 1)
  const child = (await claimJob('w-all', res.followUpIds[0]))!
  assert.equal(child.kind, 'transcribe')
  assert.equal(child.inputBucket, 'media-jobs')
  assert.equal((await runJob(child, 'w-all')).outcome, 'succeeded')
  const c = await row(child.id)
  assert.equal(c.status, 'succeeded')
  assert.equal(mockAai.posts, 1)
  assert.equal(c.result.assemblyId, 'tr_mock1')
  assert.equal(c.outputs[0].name, 'transcript.json')

  // 同じ親からは二重に積まれない
  const again = await pool().query(`SELECT count(*)::int AS n FROM media_job WHERE "dedupeKey"='transcribe:j_all'`)
  assert.equal(again.rows[0].n, 1)
})

test('文字起こしの再試行は、保存済みのIDを待つだけで二重に依頼しない', async () => {
  const before = mockAai.posts
  await pool().query(
    `INSERT INTO media_job (id, "userId", kind, "inputBucket", "inputPath", result, "updatedAt") VALUES ('j_tr_retry',$1,'transcribe','media-jobs',$2,'{"assemblyId":"tr_mock1"}'::jsonb,now())`,
    [USER, `${USER}/j_all/audio.mp3`]
  )
  const j = (await claimJob('w-tr', 'j_tr_retry'))!
  assert.equal((await runJob(j, 'w-tr')).outcome, 'succeeded')
  assert.equal(mockAai.posts, before, '新しい依頼(課金)は発生しない')
})

test('他人の出力や別ユーザーの階層は文字起こしの入力にできない', async () => {
  await pool().query(
    `INSERT INTO media_job (id, "userId", kind, "inputBucket", "inputPath", "updatedAt") VALUES ('j_tr_bad',$1,'transcribe','media-jobs','someone_else/j/audio.mp3',now())`,
    [USER]
  )
  const j = (await claimJob('w-tr', 'j_tr_bad'))!
  assert.equal((await runJob(j, 'w-tr')).outcome, 'failed')
})

test('HLS・concat など別の場所を読みに行く形式は拒否する(SSRF対策)', async () => {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(join(root, 'uploads', USER, 'evil.m3u8'), '#EXTM3U\n#EXT-X-TARGET-DURATION:1\n#EXTINF:1,\nfile:///etc/hosts\n#EXT-X-ENDLIST\n')
  writeFileSync(join(root, 'uploads', USER, 'evil.txt'), "ffconcat version 1.0\nfile '/etc/hosts'\n")
  for (const [id, f] of [['j_evil1', 'evil.m3u8'], ['j_evil2', 'evil.txt']]) {
    await insertJob(id, 'process_all', `${USER}/${f}`)
    const j = (await claimJob('w-evil', id))!
    assert.equal((await runJob(j, 'w-evil')).outcome, 'failed')
    const r = await row(id)
    assert.equal(r.status, 'failed')
    assert.equal(r.outputs, null)
  }
})
