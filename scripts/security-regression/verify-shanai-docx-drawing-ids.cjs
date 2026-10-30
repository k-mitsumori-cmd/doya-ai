const assert = require('node:assert/strict');
const JSZip = require('jszip');
const docx = require('docx');
const sharp = require('sharp');
const { JSDOM } = require('jsdom');
const { load } = require('./load-typescript.cjs');

const source = 'src/lib/shanai/docx.ts';
const mocks = { docx, sharp, jszip: JSZip };
const { buildArticleDocx } = load(source, mocks);
const input = { title: '日本語 <>&" 😀', lead: '導入', blocks: [{ type: 'heading', heading: '第1章' }, { type: 'paragraph', body: '本文1\n本文2' }, { type: 'heading', heading: '第2章' }], intervieweeName: '合成検証', profileLine: '部署 / 合成検証', companyName: '合成会社', thumbnail: null, photos: [] };
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log('PASS Shanai DOCX drawing IDs: ' + name);
}
async function inspect(buffer, expected) {
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
  const xml = await zip.file('word/document.xml').async('string');
  const document = new JSDOM(xml, { contentType: 'application/xml' }).window.document;
  const props = Array.from(document.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'docPr'));
  const ids = props.map(node => node.getAttribute('id'));
  assert.equal(ids.length, expected);
  assert.equal(new Set(ids).size, expected);
  for (const id of ids) assert.match(id, /^[1-9][0-9]*$/);
  return { zip, xml, ids, document };
}

(async () => {
  const photo = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#d04040' } }).png().toBuffer();
  const photos = count => Array.from({ length: count }, (_, i) => ({ data: photo, caption: '写真' + i }));
  for (const [name, thumbnail, count] of [['text only', null, 0], ['thumbnail only', photo, 0], ['single body image', null, 1], ['two body images', null, 2], ['thumbnail and six photos', photo, 6], ['same image reused', photo, 2]]) {
    await check(name, async () => {
      const result = await inspect(await buildArticleDocx({ ...input, thumbnail, photos: photos(count) }), count + (thumbnail ? 1 : 0));
      const texts = Array.from(result.document.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't')).map(n => n.textContent);
      assert.ok(texts.includes(input.title));
      assert.ok(texts.includes('本文1') && texts.includes('本文2'));
      for (let i = 0; i < count; i++) assert.ok(texts.includes('写真' + i));
      const media = Object.values(result.zip.files).filter(f => f.name.startsWith('word/media/') && !f.dir);
      assert.equal(media.length, count + (thumbnail ? 1 : 0) ? 1 : 0);
      for (const f of media) assert.equal((await sharp(await f.async('nodebuffer')).metadata()).format, 'jpeg');
    });
  }
  await check('concurrent documents retain their own IDs', async () => {
    const buffers = await Promise.all([buildArticleDocx({ ...input, thumbnail: photo, photos: photos(2) }), buildArticleDocx({ ...input, photos: photos(6) })]);
    await inspect(buffers[0], 3);
    await inspect(buffers[1], 6);
  });
  await check('only duplicate IDs change; text and media remain identical', async () => {
    let original;
    const intercepted = load(source, { ...mocks, docx: { ...docx, Packer: { toBuffer: async d => { original = await docx.Packer.toBuffer(d); return original; } } } });
    const output = await intercepted.buildArticleDocx({ ...input, thumbnail: photo, photos: photos(2) });
    const before = await JSZip.loadAsync(original), after = await JSZip.loadAsync(output);
    assert.deepEqual(Object.keys(after.files).sort(), Object.keys(before.files).sort());
    for (const name of Object.keys(before.files)) {
      const a = await before.file(name)?.async('nodebuffer'), b = await after.file(name)?.async('nodebuffer');
      if (name === 'word/document.xml') {
        const strip = s => s.replace(/(<wp:docPr\b[^>]*\bid=")[0-9]+(")/g, '$1ID$2');
        assert.equal(strip(a.toString()), strip(b.toString()));
        assert.notEqual(a.toString(), b.toString());
      } else assert.deepEqual(b, a);
    }
  });
  async function packedFixture(xml, count) {
    const z = new JSZip();
    if (xml !== null) z.file('word/document.xml', xml);
    const buffer = await z.generateAsync({ type: 'nodebuffer' });
    const fixture = load(source, { ...mocks, docx: { ...docx, Packer: { toBuffer: async () => buffer } } });
    return { buffer, run: () => fixture.buildArticleDocx({ ...input, photos: photos(count) }) };
  }
  await check('already unique archive is returned unchanged', async () => {
    const f = await packedFixture('<wp:docPr id="2"/><wp:docPr id="1"/><wp:docPr id="7"/>', 3);
    assert.deepEqual(await f.run(), f.buffer);
  });
  await check('replacement does not collide with a later original ID', async () => {
    const f = await packedFixture('<wp:docPr id="1"/><wp:docPr id="1"/><wp:docPr id="2"/>', 3);
    const z = await JSZip.loadAsync(await f.run());
    assert.equal(await z.file('word/document.xml').async('string'), '<wp:docPr id="1"/><wp:docPr id="3"/><wp:docPr id="2"/>');
  });
  await check('missing document part fails explicitly', async () => {
    const f = await packedFixture(null, 0);
    await assert.rejects(f.run(), /Word本文/);
  });
  await check('unexpected library drawing structure fails explicitly', async () => {
    const f = await packedFixture('<document/>', 2);
    await assert.rejects(f.run(), /画像構造/);
  });
  console.log(JSON.stringify({ passed, scope: 'Real docx/sharp/JSZip with synthetic images; unique drawing IDs, text/media preservation and archive guards. Native photo rendering and production export are separate.' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
