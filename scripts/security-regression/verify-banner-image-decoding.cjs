const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
const option = key => { const index = args.indexOf(key); return index < 0 ? null : args[index + 1]; };
const repo = path.resolve(option('--repo-root') || path.join(__dirname, '../..'));
const candidate = path.resolve(option('--candidate-root') || repo);
const output = option('--output') || path.join(process.env.DOYA_BANNER_DECODE_EVIDENCE_DIR || fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'doya-banner-decode-')), 'result.json');
assert(!fs.existsSync(output));
fs.mkdirSync(path.dirname(output), { recursive: true });
const ts = require(repo + '/node_modules/typescript');
const { JSDOM } = require(repo + '/node_modules/jsdom');
const dom = new JSDOM('<!doctype html><body></body>');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII=';
const pngData = 'data:image/png;base64,' + png;
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
function extract(page) {
  const file = `src/app/(shell)/banner/dashboard/${page}/page.tsx`;
  const source = fs.readFileSync(path.join(candidate, file), 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const wanted = ['readFileAsDataUrl', 'optimizeImageDataUrl', 'readAndOptimizeImage'];
  const found = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && wanted.includes(node.name?.text)) {
      assert(!found.has(node.name.text)); found.set(node.name.text, node.getText(sf));
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && wanted.includes(node.name.text)) {
      assert(!found.has(node.name.text)); found.set(node.name.text, 'const ' + node.getText(sf) + ';');
    }
    ts.forEachChild(node, visit);
  }
  visit(sf); assert.equal(found.size, wanted.length);
  return { file, hash: crypto.createHash('sha256').update(source).digest('hex'), code: wanted.map(name => found.get(name)).join('\n') + '\nmodule.exports={readFileAsDataUrl,optimizeImageDataUrl,readAndOptimizeImage};' };
}
function environment(extracted, config = {}) {
  const trace = { reads: 0, images: 0, draws: 0, canvasWidth: null, canvasHeight: null, mime: null, quality: null, alpha: null };
  class Reader extends dom.window.FileReader {
    readAsDataURL(file) {
      trace.reads++;
      if (config.readerError) { queueMicrotask(() => this.onerror?.(new dom.window.Event('error'))); return; }
      super.readAsDataURL(file);
    }
  }
  class ControlledImage {
    constructor() { trace.images++; }
    set src(value) {
      queueMicrotask(() => {
        if (config.decodeError) { this.onerror?.(new dom.window.Event('error')); return; }
        this.naturalWidth = this.width = config.width ?? 1600;
        this.naturalHeight = this.height = config.height ?? 800;
        this.onload?.(new dom.window.Event('load'));
      });
    }
  }
  const canvas = { width: 0, height: 0,
    getContext(kind, options) {
      assert.equal(kind, '2d'); trace.alpha = options.alpha;
      if (config.noContext) return null;
      return { drawImage(image, x, y, width, height) {
        trace.draws++; trace.canvasWidth = width; trace.canvasHeight = height;
        if (config.drawError) throw new Error('synthetic draw failure');
      } };
    },
    toDataURL(mime, quality) {
      trace.mime = mime; trace.quality = quality;
      if (config.encodeError) throw new Error('synthetic encode failure');
      if (config.emptyEncoding) return 'data:,';
      if (config.wrongEncoding) return 'data:image/gif;base64,' + 'A'.repeat(300);
      if (config.tinyEncoding) return pngData;
      return 'data:' + mime + ';base64,' + 'A'.repeat(300);
    }
  };
  const context = { module: { exports: {} }, FileReader: Reader, Image: ControlledImage,
    document: config.noDocument ? undefined : { createElement(tag) { assert.equal(tag, 'canvas'); return canvas; } } };
  vm.runInNewContext(ts.transpileModule(extracted.code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
  return { api: context.module.exports, trace };
}
const file = (kind = 'image/png', size = null) => new dom.window.File([size === null ? Buffer.from(png, 'base64') : Buffer.alloc(size)], 'synthetic-fixture.' + (kind === 'text/plain' ? 'txt' : 'png'), { type: kind });
async function run(extracted, test) {
  const h = environment(extracted, test.config);
  let value = null, error = null;
  try { value = await (test.direct ? h.api.optimizeImageDataUrl('invalid-url', { maxSide: 512, mime: 'image/png' }) : h.api.readAndOptimizeImage(test.gif ? new dom.window.File([gif], 'tiny.gif', { type: 'image/gif' }) : file(test.mime, test.size), test.kind || 'logo')); }
  catch (caught) { error = caught; }
  const passed = test.reject ? Boolean(error) && (!test.noRead || h.trace.reads === 0) : !error && Boolean(test.check(value, h.trace));
  return { name: test.name, passed, expectedReject: Boolean(test.reject), rejected: Boolean(error), errorName: error?.name || null, readCount: h.trace.reads, imageCount: h.trace.images, outputLength: typeof value === 'string' ? value.length : null, outputIsImage: typeof value === 'string' && value.startsWith('data:image/'), dimensions: [h.trace.canvasWidth, h.trace.canvasHeight] };
}
(async () => {
  const checks = [], sourceBindings = {};
  for (const page of ['create', 'chat']) {
    const extracted = extract(page); sourceBindings[extracted.file] = extracted.hash;
    const tests = [
      { name: 'logo malformed decoder rejects instead of returning raw data', config: { decodeError: true }, reject: true },
      { name: 'person malformed decoder rejects instead of returning raw data', config: { decodeError: true }, kind: 'person', reject: true },
      { name: 'zero decoded dimensions reject', config: { width: 0, height: 0 }, reject: true },
      { name: 'non-image MIME rejected before file reading', mime: 'text/plain', reject: true, noRead: true },
      { name: 'over6MiB rejected before file reading', size: 6 * 1024 * 1024 + 1, reject: true, noRead: true },
      { name: 'FileReader failure rejects', config: { readerError: true }, reject: true },
      { name: 'missing canvas context rejects', config: { noContext: true }, reject: true },
      { name: 'canvas draw failure rejects', config: { drawError: true }, reject: true },
      { name: 'canvas encoding failure rejects', config: { encodeError: true }, reject: true },
      { name: 'empty canvas encoding rejects', config: { emptyEncoding: true }, reject: true },
      { name: 'unexpected encoded MIME rejects', config: { wrongEncoding: true }, reject: true },
      { name: 'non-image data URL rejects', direct: true, reject: true },
      { name: 'browser processing context is required', config: { noDocument: true }, reject: true },
      { name: 'logo PNG512 conversion retained', check: (v,t) => t.canvasWidth === 512 && t.canvasHeight === 256 && t.mime === 'image/png' && t.alpha === true && v.startsWith('data:image/png;') },
      { name: 'person JPEG1024 quality0.8 retained', kind: 'person', check: (v,t) => t.canvasWidth === 1024 && t.canvasHeight === 512 && t.mime === 'image/jpeg' && t.quality === 0.8 && t.alpha === false && v.startsWith('data:image/jpeg;') },
      { name: 'small images are not enlarged', config: { width: 32, height: 16 }, check: (v,t) => t.canvasWidth === 32 && t.canvasHeight === 16 },
      { name: 'tiny GIF logo returns valid requested PNG encoding', gif: true, config: { width: 1, height: 1, tinyEncoding: true }, check: (v,t) => v === pngData && t.canvasWidth === 1 && t.canvasHeight === 1 },
      { name: 'exact6MiB allowed to reach decoder', size: 6 * 1024 * 1024, check: (v,t) => t.reads === 1 && t.images === 1 && t.mime === 'image/png' },
    ];
    for (const test of tests) checks.push({ page, ...await run(extracted, test) });
  }
  dom.window.close();
  const report = { checkedAt: new Date().toISOString(), candidateRoot: candidate, sourceBindings, actualThreeConverterBodiesExtractedWithoutRewriting: true, realJsdomFileReaderAndFileObjects: true, syntheticImageDecoderAndCanvas: true, checks, passed: checks.filter(c => c.passed).length, expected: checks.length, allPassed: checks.every(c => c.passed), networkRequests: 0, productionWrites: 0, paidCalls: 0, scope: 'Actual create/chat conversion functions and real jsdom FileReader/File. Decoder/canvas completion and failures are controlled; not native codec or full page/API/provider acceptance. Native malformed-image baseline and post-publication native confirmation are separate.' };
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ passed: report.passed, expected: report.expected, failed: checks.filter(c => !c.passed).map(c => c.page + ':' + c.name) }));
  if (!report.allPassed) process.exitCode = 1;
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
