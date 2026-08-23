import fs from 'node:fs';
import path from 'node:path';

const [genreSlug, status = 'completed_qa'] = process.argv.slice(2);
if (!genreSlug) throw new Error('Usage: node scripts/mark-v2-banner-genre-qa.mjs <genreSlug> [status]');

const manifestPath = path.resolve('reference/generated-assets/2026-08-23-banner-template-refresh-v2/generation-requests.json');
const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
const requests = manifest.requests.filter((item) => item.genreSlug === genreSlug);
if (!requests.length) throw new Error(`Unknown genreSlug: ${genreSlug}`);
if (requests.some((item) => !item.status.startsWith('completed'))) {
  throw new Error(`Genre is not complete: ${genreSlug}`);
}

const now = new Date().toISOString();
for (const request of requests) {
  request.status = status;
  request.genreQaAt = now;
}
manifest.completed = manifest.requests.filter((item) => item.status.startsWith('completed')).length;
manifest.pending = manifest.requests.filter((item) => item.status === 'pending').length;
manifest.updatedAt = now;
await fs.promises.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ genreSlug, count: requests.length, status }, null, 2));
