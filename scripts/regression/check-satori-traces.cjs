const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routes = ['annual-report/image', 'shanai/interviews/[id]/thumbnail', 'shanai/interviews/[id]/export'];
const required = ['assets/fonts/NotoSansJP-Regular.ttf', 'assets/fonts/NotoSansJP-Bold.ttf', 'node_modules/harfbuzzjs/hb.wasm', 'node_modules/harfbuzzjs/hb-subset.wasm', 'node_modules/satori/package.json'];
const root = process.cwd();
for (const route of routes) {
  const trace = path.join(root, '.next/server/app/api', route, 'route.js.nft.json');
  const files = new Set(JSON.parse(fs.readFileSync(trace, 'utf8')).files.map(file => path.resolve(path.dirname(trace), file)));
  const assets = route === 'annual-report/image' ? [...required, 'public/annual-report/frame.webp', 'public/annual-report/frame-tall.webp'] : required;
  for (const asset of assets) {
    const absolute = path.join(root, asset);
    assert.ok(files.has(absolute), `${route} deployment trace is missing ${asset}`);
    assert.ok(fs.statSync(absolute).size > 0, `${asset} must be an existing nonempty file`);
  }
  console.log(`PASS ${route}: Japanese fonts, HarfBuzz WASM and Satori package are traced`);
}
