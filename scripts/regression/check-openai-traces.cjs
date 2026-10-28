const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const common = ['package.json', 'index.js', 'client.js'];
const routes = {
  'logo/generate': ['resources/chat/completions/completions.js'],
  'aio/scans': ['resources/chat/completions/completions.js'],
  'banner/generate': ['resources/images.js', 'internal/uploads.js'],
};
for (const [route, modules] of Object.entries(routes)) {
  const trace = path.join(root, '.next/server/app/api', route, 'route.js.nft.json');
  const files = new Set(JSON.parse(fs.readFileSync(trace, 'utf8')).files.map(file => path.resolve(path.dirname(trace), file)));
  for (const file of [...common, ...modules]) {
    const absolute = path.join(root, 'node_modules/openai', file);
    assert.ok(files.has(absolute), `${route} deployment trace is missing OpenAI ${file}`);
    assert.ok(fs.statSync(absolute).size > 0, `OpenAI ${file} must be a nonempty deployment file`);
  }
  console.log(`PASS ${route}: native OpenAI SDK and endpoint modules are traced`);
}
