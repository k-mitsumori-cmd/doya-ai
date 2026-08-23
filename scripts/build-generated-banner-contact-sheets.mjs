import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const input = path.resolve(process.argv[2] || 'reference/generated-assets/2026-08-23-banner-template-refresh/images')
const output = path.resolve(process.argv[3] || 'reference/generated-assets/2026-08-23-banner-template-refresh/contact-sheets')
await mkdir(output, { recursive: true })
const files = (await readdir(input)).filter((file) => file.endsWith('.webp')).sort()
const genres = Object.groupBy(files, (file) => file.replace(/-\d{2}\.webp$/, ''))

for (const [genre, items] of Object.entries(genres)) {
  const tiles = await Promise.all(items.map((file) => sharp(path.join(input, file)).resize(480, 251).png().toBuffer()))
  await sharp({ create: { width: 2400, height: 502, channels: 3, background: '#ddd' } })
    .composite(tiles.map((tile, index) => ({ input: tile, left: (index % 5) * 480, top: Math.floor(index / 5) * 251 })))
    .jpeg({ quality: 82 })
    .toFile(path.join(output, `${genre}.jpg`))
}

console.log(JSON.stringify({ genres: Object.keys(genres).length, sheets: output }))
