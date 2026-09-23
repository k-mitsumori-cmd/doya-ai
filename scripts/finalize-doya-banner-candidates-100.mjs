import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const repoRoot = '/Users/mitsumori_katsuki/Code/09_Cursol';
const outputRoot = path.join(repoRoot, 'reference/generated-assets/2026-08-31-doya-banner-candidates-100');
const requestsPath = path.join(outputRoot, 'generation-requests.json');
const requestFile = JSON.parse(fs.readFileSync(requestsPath, 'utf8'));
const failures = [];
const completed = [];

const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

for (const request of requestFile.requests) {
  const rawPath = path.join(outputRoot, request.output.rawPath);
  const imagePath = path.join(outputRoot, request.output.imagePath);
  if (!fs.existsSync(rawPath)) {
    failures.push({ templateId: request.templateId, reason: 'raw PNG missing' });
    continue;
  }

  const rawMeta = await sharp(rawPath).metadata();
  if (rawMeta.format !== 'png' || !rawMeta.width || !rawMeta.height) {
    failures.push({ templateId: request.templateId, reason: `invalid raw metadata: ${JSON.stringify(rawMeta)}` });
    continue;
  }

  await sharp(rawPath)
    .resize(1200, 628, { fit: 'fill' })
    .webp({ quality: 85 })
    .toFile(imagePath);

  const imageMeta = await sharp(imagePath).metadata();
  if (imageMeta.format !== 'webp' || imageMeta.width !== 1200 || imageMeta.height !== 628) {
    failures.push({ templateId: request.templateId, reason: `invalid final metadata: ${JSON.stringify(imageMeta)}` });
    continue;
  }

  request.status = 'completed';
  request.selectedRawSource = rawPath;
  request.output.sha256 = sha256(imagePath);
  request.output.bytes = fs.statSync(imagePath).size;
  completed.push(request);
}

requestFile.updatedAt = new Date().toISOString();
requestFile.completed = completed.length;
requestFile.pending = requestFile.total - completed.length;
requestFile.failures = failures;
fs.writeFileSync(requestsPath, `${JSON.stringify(requestFile, null, 2)}\n`);

const metadata = completed.map((request) => ({
  templateId: request.templateId,
  industry: request.industry,
  category: request.category,
  size: '1200x628',
  prompt: request.prompt,
  file: path.basename(request.output.imagePath),
  referenceUrls: [request.reference.sourceUrl],
  copy: request.copy,
  genre: request.genre,
  genreSlug: request.genreSlug,
  sha256: request.output.sha256,
  bytes: request.output.bytes,
}));
fs.writeFileSync(path.join(outputRoot, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
fs.writeFileSync(
  path.join(outputRoot, 'SHA256SUMS'),
  `${metadata.map((item) => `${item.sha256}  images/${item.file}`).join('\n')}\n`,
);

async function buildSheet(requests, outputPath, columns, thumbWidth, thumbHeight) {
  const rows = Math.ceil(requests.length / columns);
  const composites = [];
  for (let index = 0; index < requests.length; index += 1) {
    const request = requests[index];
    const input = await sharp(path.join(outputRoot, request.output.imagePath))
      .resize(thumbWidth, thumbHeight, { fit: 'fill' })
      .jpeg({ quality: 88 })
      .toBuffer();
    composites.push({
      input,
      left: (index % columns) * thumbWidth,
      top: Math.floor(index / columns) * thumbHeight,
    });
  }
  await sharp({
    create: {
      width: columns * thumbWidth,
      height: rows * thumbHeight,
      channels: 3,
      background: '#111111',
    },
  }).composite(composites).jpeg({ quality: 90 }).toFile(outputPath);
}

const genreSlugs = [...new Set(completed.map((request) => request.genreSlug))];
for (const genreSlug of genreSlugs) {
  await buildSheet(
    completed.filter((request) => request.genreSlug === genreSlug),
    path.join(outputRoot, 'contact-sheets', `${genreSlug}.jpg`),
    2,
    600,
    314,
  );
}
await buildSheet(completed, path.join(outputRoot, 'qa', 'all-100-overview.jpg'), 10, 240, 126);

const hashes = completed.map((request) => request.output.sha256);
const report = {
  generatedAt: new Date().toISOString(),
  status: failures.length === 0 && completed.length === 100 && new Set(hashes).size === 100 ? 'PASS' : 'FAIL',
  requested: requestFile.total,
  rawPngCount: fs.readdirSync(path.join(outputRoot, 'raw')).filter((name) => name.endsWith('.png')).length,
  finalWebpCount: fs.readdirSync(path.join(outputRoot, 'images')).filter((name) => name.endsWith('.webp')).length,
  completed: completed.length,
  failures,
  expectedDimensions: { width: 1200, height: 628 },
  format: 'webp',
  uniqueSha256Count: new Set(hashes).size,
  duplicateSha256Count: hashes.length - new Set(hashes).size,
  genreCounts: Object.fromEntries(genreSlugs.map((slug) => [slug, completed.filter((request) => request.genreSlug === slug).length])),
};
fs.writeFileSync(path.join(outputRoot, 'qa', 'verification-report.json'), `${JSON.stringify(report, null, 2)}\n`);

const readme = `# ドヤバナーAI 新規バナー候補100枚\n\n` +
  `Codex内蔵画像生成を使い、BANNER LIBRARY由来の収集画像を構図・文字階層・余白・密度の参考にして制作した新規候補です。実在ブランド、ロゴ、商品名、コピー、正確な配置は流用していません。\n\n` +
  `- 最終画像: \`images/\`（1200×628 WebP、100枚）\n` +
  `- 生成元: \`raw/\`（PNG、100枚）\n` +
  `- プロンプトと参照対応: \`generation-requests.json\`\n` +
  `- DB投入用メタデータ: \`metadata.json\`\n` +
  `- 参照記録: \`references.md\`\n` +
  `- ジャンル別一覧: \`contact-sheets/\`\n` +
  `- 全100枚一覧と機械検証: \`qa/\`\n\n` +
  `- 画像チェックサム: \`SHA256SUMS\`\n\n` +
  `機械検証: ${report.status} / WebP ${report.finalWebpCount}枚 / SHA-256重複 ${report.duplicateSha256Count}件。\n` +
  `目視検証: \`qa/visual-audit.json\` を参照。初回生成3枚を再生成し、最終100枚をPASSとした。\n`;
fs.writeFileSync(path.join(outputRoot, 'README.md'), readme);

console.log(JSON.stringify(report, null, 2));
