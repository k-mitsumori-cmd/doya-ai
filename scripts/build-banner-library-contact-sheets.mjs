import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import inventory from '../reference/generated-assets/2026-08-23-banner-template-refresh/reference-inventory.json' with { type: 'json' }

const OUTPUT_ROOT = '/tmp/doya-banner-library-150'
const TILE_WIDTH = 320
const TILE_HEIGHT = 250
const COLS = 5
const ROWS = 2

await mkdir(path.join(OUTPUT_ROOT, 'images'), { recursive: true })
await mkdir(path.join(OUTPUT_ROOT, 'contact-sheets'), { recursive: true })

const escapeXml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

for (const item of inventory) {
  const response = await fetch(item.imageUrl)
  if (!response.ok) {
    throw new Error(`${item.templateId}: HTTP ${response.status}`)
  }
  await writeFile(
    path.join(OUTPUT_ROOT, 'images', `${item.templateId}.img`),
    Buffer.from(await response.arrayBuffer()),
  )
}

for (const genreSlug of [...new Set(inventory.map((item) => item.genreSlug))]) {
  const items = inventory.filter((item) => item.genreSlug === genreSlug)
  const composites = []

  for (const [index, item] of items.entries()) {
    const image = await sharp(
      path.join(OUTPUT_ROOT, 'images', `${item.templateId}.img`),
    )
      .resize(TILE_WIDTH - 16, TILE_HEIGHT - 48, {
        fit: 'contain',
        background: '#ffffff',
      })
      .png()
      .toBuffer()

    const label = await sharp(
      Buffer.from(
        `<svg width="${TILE_WIDTH}" height="${TILE_HEIGHT}">
          <rect width="100%" height="100%" fill="#f3f3f3"/>
          <text x="8" y="22" font-size="16" font-family="Arial, sans-serif" font-weight="700" fill="#111">${escapeXml(item.templateId)}</text>
        </svg>`,
      ),
    )
      .png()
      .toBuffer()

    const tile = await sharp(label)
      .composite([{ input: image, left: 8, top: 38 }])
      .png()
      .toBuffer()

    composites.push({
      input: tile,
      left: (index % COLS) * TILE_WIDTH,
      top: Math.floor(index / COLS) * TILE_HEIGHT,
    })
  }

  await sharp({
    create: {
      width: TILE_WIDTH * COLS,
      height: TILE_HEIGHT * ROWS,
      channels: 3,
      background: '#dddddd',
    },
  })
    .composite(composites)
    .png()
    .toFile(path.join(OUTPUT_ROOT, 'contact-sheets', `${genreSlug}.png`))
}

console.log(
  JSON.stringify({
    downloaded: inventory.length,
    contactSheets: new Set(inventory.map((item) => item.genreSlug)).size,
    output: path.join(OUTPUT_ROOT, 'contact-sheets'),
  }),
)
