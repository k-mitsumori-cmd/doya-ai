// Dependency integration checks. All files and workbook data are synthetic.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = process.env.DOYA_TEST_REPO || path.resolve(__dirname, '../..');
const req = createRequire(path.join(root, 'package.json'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

async function main() {
  const versions = [];
  const pattern = Array(5).fill('**/../a/b').join('/');
  let modern = 0;
  let legacy = 0;
  for (const [relative, spec] of Object.entries(lock.packages)) {
    if (!/(^|\/)node_modules\/minimatch$/.test(relative)) continue;
    const directory = path.join(root, relative);
    const installed = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    assert.equal(installed.version, spec.version, 'installed dependency must match the lock');
    const api = req(directory);
    if (Number(installed.version.split('.')[0]) >= 9) {
      const matcher = new api.Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 4 });
      assert.equal(matcher.set.length, 4, 'glob preprocessing must respect its expansion limit');
      modern++;
    } else {
      assert.equal(typeof api, 'function', 'legacy consumers retain the callable export');
      assert.equal(api('日本語.txt', '*.txt'), true);
      assert.equal(api('nested/a.txt', '*.txt'), false);
      legacy++;
    }
    versions.push(installed.version);
  }
  assert(modern > 0 && legacy > 0, 'exercise both dependency API families');
  console.log('PASS Minimatch dependency: bounded modern preprocessing');
  console.log('PASS Minimatch dependency: callable legacy API retained');

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'doya-minimatch-regression-'));
  try {
    fs.mkdirSync(path.join(temporary, 'nested'));
    fs.writeFileSync(path.join(temporary, 'a.txt'), 'synthetic A\n');
    fs.writeFileSync(path.join(temporary, 'nested', '日本語.txt'), '合成本文\n');
    fs.writeFileSync(path.join(temporary, 'nested', 'notes.csv'), 'synthetic,csv\n');
    fs.writeFileSync(path.join(temporary, '.hidden.txt'), 'excluded\n');
    const utilityPaths = Object.keys(lock.packages).filter(relative => /(^|\/)node_modules\/archiver-utils$/.test(relative));
    assert(utilityPaths.length > 0);
    for (const relative of utilityPaths) {
      const utils = req(path.join(root, relative));
      const expanded = utils.file.expand({ cwd: temporary }, ['**/*.txt', '!**/.hidden*']);
      assert.deepEqual(expanded.map(x => x.replaceAll('\\', '/')).sort(), ['a.txt', 'nested/日本語.txt'], relative);
    }
    console.log('PASS Minimatch dependency: actual archiver-utils glob expansion');

    const JSZip = req('jszip');
    const archivePaths = Object.keys(lock.packages).filter(relative => /(^|\/)node_modules\/archiver$/.test(relative));
    assert(archivePaths.length > 0);
    for (const relative of archivePaths) {
      const archiver = req(path.join(root, relative));
      const archive = archiver('zip', { zlib: { level: 6 } });
      const chunks = [];
      const done = new Promise((resolve, reject) => {
        archive.on('data', chunk => chunks.push(chunk));
        archive.once('end', resolve);
        archive.once('error', reject);
        archive.once('warning', reject);
      });
      archive.glob('**/*.txt', { cwd: temporary, dot: false });
      await archive.finalize();
      await done;
      const zip = await JSZip.loadAsync(Buffer.concat(chunks));
      assert.deepEqual(Object.keys(zip.files).filter(name => !zip.files[name].dir).sort(), ['a.txt', 'nested/日本語.txt'], relative);
      assert.equal(await zip.file('nested/日本語.txt').async('string'), '合成本文\n');
      assert.equal(await zip.file('a.txt').async('string'), 'synthetic A\n');
    }
    console.log('PASS Minimatch dependency: actual archiver glob ZIP content');

    const ExcelJS = req('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('合成検証');
    const values = ['日本語', '引用"と改行\n二行目', '=1+1', 7];
    sheet.addRow(values);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    assert.deepEqual(loaded.worksheets[0].getRow(1).values.slice(1), values);
    assert.equal(loaded.worksheets[0].getCell('C1').type, ExcelJS.ValueType.String);
    console.log('PASS Minimatch dependency: actual ExcelJS XLSX typed cells');
    console.log(JSON.stringify({ passed: 5, versions, utilityInstances: utilityPaths.length, archiverInstances: archivePaths.length, scope: 'Clean dependency integration with bounded pattern and synthetic files. No providers, real database, production download or native Excel.' }));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
