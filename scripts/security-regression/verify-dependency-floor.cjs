// Reject reintroducing the vulnerable versions identified in the 2026-09 audit.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const floors = { next: '15.5.25', 'next-auth': '4.24.15', undici: '7.29.1', sharp: '0.35.4', jspdf: '4.2.1', '@sparticuz/chromium': '152.0.0', 'puppeteer-core': '25.10.0' };
for (const [name, minimum] of Object.entries(floors)) {
  let dir = path.dirname(require.resolve(name));
  let version;
  while (dir !== path.dirname(dir)) {
    const file = path.join(dir, 'package.json');
    if (fs.existsSync(file)) {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (pkg.name === name) { version = pkg.version; break; }
    }
    dir = path.dirname(dir);
  }
  assert(version && /^\d+\.\d+\.\d+$/.test(version), `Expected a stable ${name} release`);
  const actual = version.split('.').map(Number), required = minimum.split('.').map(Number);
  const diff = actual.map((n, i) => n - required[i]).find(n => n !== 0) ?? 0;
  assert(diff >= 0, `${name} ${version} is below the security floor ${minimum}`);
  console.log(`PASS ${name} ${version} security floor`);
}
