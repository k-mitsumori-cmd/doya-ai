const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const seconds = 2, sampleRate = 8000, samples = seconds * sampleRate
const wav = Buffer.alloc(44 + samples * 2)
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28)
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40)

let signedUrl = 'https://storage.example.test/object/sign/private/file?token=fake', mode = 'range', requests = 0
const { inspectInterviewMediaDuration } = load('src/lib/interview/media-duration.ts', {
  'mediainfo.js': { __esModule: true, default: require('mediainfo.js').default },
  './storage': { getSignedFileUrl: async () => signedUrl },
}, {
  process: { env: { SUPABASE_URL: 'https://storage.example.test' } },
  AbortSignal,
  fetch: async (_url, options) => {
    requests++
    const match = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range)
    assert.ok(match)
    const start = Number(match[1]), end = Number(match[2])
    const body = wav.subarray(start, mode === 'short' ? end : end + 1)
    return new Response(body, { status: mode === 'full' ? 200 : 206, headers: {
      'content-range': `bytes ${start}-${end}/${wav.length}`,
    } })
  },
})

;(async () => {
  assert.equal(await inspectInterviewMediaDuration('owner/project/file.wav', BigInt(wav.length)), seconds)
  assert.ok(requests >= 1)
  signedUrl = 'https://foreign.example.test/file'
  await assert.rejects(() => inspectInterviewMediaDuration('owner/project/file.wav', wav.length), /参照先/)
  signedUrl = 'https://storage.example.test/object/sign/private/file?token=fake'
  mode = 'full'
  await assert.rejects(() => inspectInterviewMediaDuration('owner/project/file.wav', wav.length), /分割取得/)
  mode = 'short'
  await assert.rejects(() => inspectInterviewMediaDuration('owner/project/file.wav', wav.length), /長さ/)
  await assert.rejects(() => inspectInterviewMediaDuration('owner/project/file.wav', null), /長さ/)
  console.log('PASS stored media duration is measured from bounded ranges and fails closed on untrusted responses')
})().catch(error => { console.error(error); process.exitCode = 1 })
