import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import satori from 'satori'
import sharp from 'sharp'
import { renderAnnualImage } from '../../src/lib/annual-report/render.server'
import { buildAnnualReport } from '../../src/lib/annual-report/report'
import { sampleAnnualRawData } from '../../src/lib/annual-report/sample'
import { renderThumbnail } from '../../src/lib/shanai/thumbnail'

const output = '/tmp/doya-native-satori-audit'
mkdirSync(output, { recursive: true })

test('Satori compression dependency preserves a small valid archive', () => {
  const dependency = createRequire(require.resolve('satori'))
  const { zipSync, unzipSync } = dependency('fflate') as typeof import('fflate')
  const value = new TextEncoder().encode('Synthetic Japanese font archive fixture')
  const decoded = unzipSync(zipSync({ 'fixture.txt': value }))
  assert.deepEqual(Buffer.from(decoded['fixture.txt']), Buffer.from(value))
})

test('Satori escapes values at the generated SVG attribute boundary', async () => {
  const payload = 'navy"/><rect id="doya-audit-markup"/><text fill="navy'
  const svg = await satori({ type: 'div', props: { style: { color: payload }, children: 'synthetic' } }, {
    width: 320, height: 100, embedFont: false,
    fonts: [{ name: 'Noto Sans JP', data: readFileSync(path.join(process.cwd(), 'assets/fonts/NotoSansJP-Regular.ttf')), weight: 400 }],
  })
  writeFileSync(path.join(output, 'escaped-attribute.svg'), svg)
  assert.equal(svg.includes('<rect id="doya-audit-markup"'), false, 'A style value must not become an SVG element')
  assert.ok(svg.includes('&lt;rect'), 'The supplied characters must remain escaped attribute data')
})

test('both annual-report sizes render with and without the existing frame', { timeout: 90000 }, async () => {
  const report = buildAnnualReport(sampleAnnualRawData(2026), { year: 2026, reveal: ['company', 'customers', 'amounts', 'members'] })
  for (const size of ['wide', 'tall'] as const) for (const plain of [false, true]) {
    const image = await renderAnnualImage(report, size, process.cwd(), { plain })
    const metadata = await sharp(image).metadata()
    assert.equal(metadata.format, 'png')
    assert.equal(metadata.width, size === 'wide' ? 1200 : 1080)
    assert.equal(metadata.height, size === 'wide' ? 630 : 1350)
    assert.ok(image.byteLength > 10000, 'The report must contain rendered content')
    writeFileSync(path.join(output, `annual-${size}-${plain ? 'plain' : 'framed'}.png`), image)
  }
})

test('interview thumbnail renders Japanese text with and without a synthetic photo', { timeout: 90000 }, async () => {
  const syntheticPhoto = await sharp({ create: { width: 800, height: 700, channels: 3, background: '#497095' } }).jpeg().toBuffer()
  for (const photo of [null, syntheticPhoto]) {
    const image = await renderThumbnail({ photo, catchphrase: '仕事の工夫と、これからの挑戦', name: '検証 太郎', department: '検証部', position: '検証担当', companyName: '架空の検証会社', brandColor: '#0066ff' })
    const metadata = await sharp(image).metadata()
    assert.equal(metadata.format, 'png')
    assert.equal(metadata.width, 1200)
    assert.equal(metadata.height, 630)
    assert.ok(image.byteLength > 10000)
    writeFileSync(path.join(output, `interview-${photo ? 'synthetic-photo' : 'no-photo'}.png`), image)
  }
})
