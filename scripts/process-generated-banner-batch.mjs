import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const [genreSlug, ...inputPaths] = process.argv.slice(2)

if (!genreSlug || inputPaths.length !== 10) {
  throw new Error(
    'usage: node scripts/process-generated-banner-batch.mjs <genre-slug> <10 input paths>',
  )
}

const outputDir = path.resolve(
  'reference/generated-assets/2026-08-23-banner-template-refresh/images',
)
await mkdir(outputDir, { recursive: true })

for (const [index, inputPath] of inputPaths.entries()) {
  const outputPath = path.join(
    outputDir,
    `${genreSlug}-${String(index + 1).padStart(2, '0')}.webp`,
  )
  await sharp(inputPath)
    .resize(1200, 628, { fit: 'cover', position: 'centre' })
    .webp({ quality: 85, smartSubsample: true })
    .toFile(outputPath)
}

console.log(
  JSON.stringify({
    genreSlug,
    processed: inputPaths.length,
    outputDir,
  }),
)
