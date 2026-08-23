import { readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const base = path.resolve(process.argv[2] || 'reference/generated-assets/2026-08-23-banner-template-refresh-v2')
const manifest = JSON.parse(await readFile(path.join(base, 'generation-requests.json'), 'utf8'))
const requests = manifest.requests
const failures = []
const sha256 = new Set()

const assert = (condition, message) => { if (!condition) failures.push(message) }
const list = async (dir, suffix) => (await readdir(path.join(base, dir))).filter((file) => file.endsWith(suffix)).sort()

const imageFiles = await list('images', '.webp')
const rawFiles = await list('raw', '.png')
const referenceFiles = await list('references', '.jpg')
const contactSheets = await list('contact-sheets', '.jpg')
const comparisonSheets = await list('qa/reference-vs-generated', '.jpg')

assert(requests.length === 150, `manifest requests: ${requests.length}`)
assert(manifest.completed === 150, `manifest completed: ${manifest.completed}`)
assert(manifest.pending === 0, `manifest pending: ${manifest.pending}`)
assert(imageFiles.length === 150, `webp count: ${imageFiles.length}`)
assert(rawFiles.length === 150, `raw PNG count: ${rawFiles.length}`)
assert(referenceFiles.length === 150, `reference JPG count: ${referenceFiles.length}`)
assert(contactSheets.length === 15, `contact sheet count: ${contactSheets.length}`)
assert(comparisonSheets.length === 15, `comparison sheet count: ${comparisonSheets.length}`)

const ids = requests.map((request) => request.templateId)
const referenceIds = requests.map((request) => request.reference.id)
const referenceUrls = requests.map((request) => request.reference.url)
assert(new Set(ids).size === 150, 'template IDs are not unique')
assert(new Set(referenceIds).size === 150, 'reference IDs are not unique')
assert(new Set(referenceUrls).size === 150, 'reference URLs are not unique')
assert(requests.every((request) => request.status === 'completed_qa'), 'not every request is completed_qa')

const genres = Object.groupBy(requests, (request) => request.genreSlug)
assert(Object.keys(genres).length === 15, `genre count: ${Object.keys(genres).length}`)
for (const [genre, items] of Object.entries(genres)) assert(items.length === 10, `${genre} count: ${items.length}`)

for (const request of requests) {
  const imagePath = path.join(base, request.output.imagePath)
  const rawPath = path.join(base, request.output.rawPath)
  const referencePath = path.join(base, request.reference.imagePath)
  try {
    const imageBuffer = await readFile(imagePath)
    const imageMeta = await sharp(imageBuffer).metadata()
    assert(imageMeta.width === 1200 && imageMeta.height === 628 && imageMeta.format === 'webp', `${request.templateId} invalid WebP metadata`)
    sha256.add(crypto.createHash('sha256').update(imageBuffer).digest('hex'))
  } catch { failures.push(`${request.templateId} missing or invalid WebP`) }
  try {
    const rawMeta = await sharp(rawPath).metadata()
    assert(rawMeta.width > 0 && rawMeta.height > 0 && rawMeta.format === 'png', `${request.templateId} invalid raw PNG`)
  } catch { failures.push(`${request.templateId} missing or invalid raw PNG`) }
  try { await sharp(referencePath).metadata() } catch { failures.push(`${request.templateId} missing or invalid reference`) }
}
assert(sha256.size === 150, `unique WebP SHA256: ${sha256.size}`)

const expectedImages = new Set(requests.map((request) => path.basename(request.output.imagePath)))
const expectedRaw = new Set(requests.map((request) => path.basename(request.output.rawPath)))
const expectedReferences = new Set(requests.map((request) => path.basename(request.reference.imagePath)))
assert(imageFiles.every((file) => expectedImages.has(file)) && expectedImages.size === imageFiles.length, 'image manifest/directory mismatch')
assert(rawFiles.every((file) => expectedRaw.has(file)) && expectedRaw.size === rawFiles.length, 'raw manifest/directory mismatch')
assert(referenceFiles.every((file) => expectedReferences.has(file)) && expectedReferences.size === referenceFiles.length, 'reference manifest/directory mismatch')

const report = {
  status: failures.length ? 'failed' : 'passed',
  checkedAt: new Date().toISOString(),
  counts: {
    manifest: requests.length,
    completedQa: requests.filter((request) => request.status === 'completed_qa').length,
    webp: imageFiles.length,
    uniqueWebpSha256: sha256.size,
    rawPng: rawFiles.length,
    references: referenceFiles.length,
    genres: Object.keys(genres).length,
    contactSheets: contactSheets.length,
    comparisonSheets: comparisonSheets.length,
  },
  expectedDimensions: '1200x628 WebP',
  failures,
}

await writeFile(path.join(base, 'qa', 'verification-report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (failures.length) process.exitCode = 1
