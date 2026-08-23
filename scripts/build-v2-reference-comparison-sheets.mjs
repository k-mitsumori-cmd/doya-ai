import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const base = path.resolve(process.argv[2] || 'reference/generated-assets/2026-08-23-banner-template-refresh-v2')
const manifest = JSON.parse(await readFile(path.join(base, 'generation-requests.json'), 'utf8'))
const output = path.join(base, 'qa', 'reference-vs-generated')
await mkdir(output, { recursive: true })

const groups = Object.groupBy(manifest.requests, (request) => request.genreSlug)

for (const [genre, requests] of Object.entries(groups)) {
  const sorted = requests.toSorted((a, b) => a.templateId.localeCompare(b.templateId))
  const referenceTiles = await Promise.all(sorted.map((request) =>
    sharp(path.join(base, request.reference.imagePath)).resize(480, 251, { fit: 'cover' }).png().toBuffer()))
  const generatedTiles = await Promise.all(sorted.map((request) =>
    sharp(path.join(base, request.output.imagePath)).resize(480, 251, { fit: 'cover' }).png().toBuffer()))

  const labels = await sharp({ create: { width: 2400, height: 60, channels: 3, background: '#161616' } })
    .composite([
      { input: Buffer.from(`<svg width="2400" height="60"><style>text{font-family:Arial,sans-serif;font-size:28px;font-weight:700;fill:white}</style><text x="24" y="39">ACTUAL REFERENCE</text><text x="1224" y="39">GENERATED</text></svg>`) },
    ])
    .png()
    .toBuffer()

  const composites = [{ input: labels, left: 0, top: 0 }]
  referenceTiles.forEach((tile, index) => composites.push({ input: tile, left: (index % 5) * 480, top: 60 + Math.floor(index / 5) * 251 }))
  generatedTiles.forEach((tile, index) => composites.push({ input: tile, left: (index % 5) * 480, top: 562 + Math.floor(index / 5) * 251 }))

  await sharp({ create: { width: 2400, height: 1064, channels: 3, background: '#d8d8d8' } })
    .composite(composites)
    .jpeg({ quality: 88 })
    .toFile(path.join(output, `${genre}.jpg`))
}

console.log(JSON.stringify({ genres: Object.keys(groups).length, output }, null, 2))
