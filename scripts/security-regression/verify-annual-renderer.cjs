const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const native = require('@resvg/resvg-js');
const { load } = require('./load-typescript.cjs');
const root = path.resolve(__dirname, '../..');
const report = load('src/lib/annual-report/report.ts');
const sample = load('src/lib/annual-report/sample.ts');
const synthetic = report.buildAnnualReport(sample.sampleAnnualRawData(2026), { year: 2026, reveal: report.REVEAL_KEYS });

function renderer(mode) {
  const observed = { nativeLoads: 0, nativeConstructors: 0, sharpCalls: 0 };
  const raster = (...args) => { observed.sharpCalls++; return sharp(...args); };
  const nativeModule = {
    Resvg: class {
      constructor(...args) {
        observed.nativeConstructors++;
        if (mode === 'render-failure') throw new Error('Synthetic native render failure');
        this.renderer = new native.Resvg(...args);
      }
      render() { return this.renderer.render(); }
    },
  };
  const mocks = {
    'node:fs': fs, 'node:path': path, satori: require('satori'), sharp: raster,
    './report': report,
  };
  Object.defineProperty(mocks, '@resvg/resvg-js', { get() {
    observed.nativeLoads++;
    if (mode === 'missing') throw Object.assign(new Error('Synthetic missing native package'), { code: 'MODULE_NOT_FOUND' });
    return nativeModule;
  } });
  const actual = load('src/lib/annual-report/render.server.ts', mocks, { process: { cwd: () => root } });
  return { ...actual, observed };
}

(async () => {
  const cases = [];
  const directory = path.join(root, 'docs/audits/2026-10-06-all-services-recheck/annual-renderer');
  fs.mkdirSync(directory, { recursive: true });
  for (const mode of ['native', 'missing', 'render-failure']) {
    for (const size of ['wide', 'tall']) for (const plain of [false, true]) {
      const actual = renderer(mode);
      const png = await actual.renderAnnualImage(synthetic, size, root, { plain });
      const metadata = await sharp(png).metadata();
      const expected = report.IMAGE_SIZES[size];
      assert.equal(metadata.format, 'png');
      assert.equal(metadata.width, expected.width); assert.equal(metadata.height, expected.height);
      await sharp(png).raw().toBuffer();
      const stats = await sharp(png).stats();
      assert(stats.channels.some(channel => channel.stdev > 5), 'Renderer must not return a blank image');
      assert(actual.observed.nativeLoads > 0, 'Primary native import must be attempted');
      assert.equal(actual.observed.nativeConstructors, mode === 'missing' ? 0 : 1);
      assert.equal(actual.observed.sharpCalls, (plain ? 0 : 1) + (mode === 'native' ? 0 : 1));
      const name = `${mode}-${size}-${plain ? 'plain' : 'framed'}`;
      fs.writeFileSync(path.join(directory, name + '.png'), png);
      cases.push({ name, width: metadata.width, height: metadata.height, decoded: true, ...actual.observed });
      console.log('PASS Annual renderer: ' + name);
    }
  }
  const result = { passed: cases.length, cases, scope: 'Actual Satori, bundled font/frame files, native Resvg and sharp. Synthetic annual report and native import/constructor failure injection. All PNGs decoded; no paid provider, account, database or network.' };
  fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: cases.length, scope: result.scope }));
})().catch(error => { console.error(error); process.exitCode = 1; });
