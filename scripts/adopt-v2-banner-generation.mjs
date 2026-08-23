import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [templateId, sourcePng, qaStatus = 'completed_pending_genre_qa'] = process.argv.slice(2);
if (!templateId || !sourcePng) {
  throw new Error('Usage: node scripts/adopt-v2-banner-generation.mjs <templateId> <sourcePng> [status]');
}

const projectRoot = process.cwd();
const targetRoot = path.join(projectRoot, 'reference/generated-assets/2026-08-23-banner-template-refresh-v2');
const manifestPath = path.join(targetRoot, 'generation-requests.json');
const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
const request = manifest.requests.find((item) => item.templateId === templateId);
if (!request) throw new Error(`Unknown templateId: ${templateId}`);
if (!fs.existsSync(sourcePng)) throw new Error(`Generated source does not exist: ${sourcePng}`);

const rawDestination = path.join(targetRoot, request.output.rawPath);
const imageDestination = path.join(targetRoot, request.output.imagePath);
await fs.promises.mkdir(path.dirname(rawDestination), { recursive: true });
await fs.promises.mkdir(path.dirname(imageDestination), { recursive: true });
await fs.promises.copyFile(sourcePng, rawDestination);
await sharp(sourcePng)
  .resize(request.output.width, request.output.height, { fit: 'cover', position: 'centre' })
  .webp({ quality: 90 })
  .toFile(imageDestination);

request.status = qaStatus;
request.attempts = Number(request.attempts || 0) + 1;
request.selectedRawSource = sourcePng;
request.updatedAt = new Date().toISOString();
manifest.completed = manifest.requests.filter((item) => item.status.startsWith('completed')).length;
manifest.pending = manifest.requests.filter((item) => item.status === 'pending').length;
manifest.updatedAt = new Date().toISOString();
await fs.promises.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const metadata = await sharp(imageDestination).metadata();
console.log(JSON.stringify({
  templateId,
  status: request.status,
  attempts: request.attempts,
  image: imageDestination,
  width: metadata.width,
  height: metadata.height,
  format: metadata.format,
  completed: manifest.completed,
  pending: manifest.pending,
}, null, 2));
