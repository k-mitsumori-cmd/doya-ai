const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { load } = require('./load-typescript.cjs');

const renderer = load('seo/lib/markdown.ts');
const markdown = '# 日本語本文\n\n[リンク](https://example.invalid/)\n\n```js\na < b && c > d\n```';
const expectedBody = new JSDOM('<!doctype html><html><head></head><body>\n' + renderer.markdownToHtmlBasic(markdown) + '\n</body>\n</html>').window.document.body.innerHTML;
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log('PASS SEO HTML title: ' + name);
}
function fixture({ title = '', owner = true, found = true, content = markdown } = {}) {
  let reads = 0;
  let schemaCalls = 0;
  const api = load('src/app/api/seo/articles/[id]/export/html/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/seoArticleOwner': { getSeoArticleOwner: async () => owner ? { userId: 'synthetic-owner' } : null },
    '@seo/lib/bootstrap': { ensureSeoSchema: async () => { schemaCalls++; } },
    '@seo/lib/markdown': renderer,
    '@/lib/prisma': { prisma: { seoArticle: { findFirst: async ({ where }) => {
      reads++;
      assert.deepEqual(JSON.parse(JSON.stringify(where)), { id: 'synthetic-article', userId: 'synthetic-owner' });
      return found ? { title, finalMarkdown: content, outline: 'Unchanged outline behavior' } : null;
    } } } },
  });
  return {
    run: () => api.GET({}, { params: Promise.resolve({ id: 'synthetic-article' }) }),
    get reads() { return reads; },
    get schemaCalls() { return schemaCalls; },
  };
}

(async () => {
  const titles = [
    ['Japanese and emoji', '日本語の見出し 😀'],
    ['ampersand and brackets', 'A & B <比較>'],
    ['literal named entity', '文字として &amp; &lt; &quot;'],
    ['literal numeric entity', '文字として &#x41; &#65;'],
    ['closing title markup', '前</title><meta name="synthetic-marker" content="injected"><title>後'],
    ['mixed-case closing markup', '前</TiTlE><div id="synthetic-marker">後'],
    ['inert script-shaped text', '</title><script type="application/json">{"synthetic":true}</script>'],
    ['quotes', '引用 "二重" と \'一重\''],
    ['linefeed', '1行目\n2行目'],
    ['empty title', ''],
  ];
  for (const [name, title] of titles) await check(name, async () => {
    const response = await fixture({ title }).run();
    assert.equal(response.status, 200);
    const doc = new JSDOM(await response.text()).window.document;
    assert.equal(doc.querySelectorAll('title').length, 1);
    assert.equal(doc.querySelector('title').textContent, title);
    assert.equal(doc.querySelectorAll('script, meta[name="synthetic-marker"], #synthetic-marker').length, 0);
    assert.equal(doc.body.innerHTML, expectedBody);
  });
  await check('anonymous before schema and DB', async () => {
    const f = fixture({ owner: false });
    assert.equal((await f.run()).status, 401);
    assert.equal(f.reads, 0);
    assert.equal(f.schemaCalls, 0);
  });
  await check('foreign or missing scoped record', async () => {
    const r = await fixture({ found: false }).run();
    assert.equal(r.status, 404);
    assert.equal((await r.json()).error, 'not found');
  });
  await check('empty body does not change outline fallback', async () => {
    const r = await fixture({ content: '' }).run();
    const doc = new JSDOM(await r.text()).window.document;
    assert.equal(doc.body.textContent.trim(), '');
  });
  await check('attachment name and media type retained', async () => {
    const r = await fixture({ title: '日本語のタイトル' }).run();
    assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(r.headers.get('content-disposition'), 'attachment; filename="doya-article-synthetic-article.html"');
  });
  console.log(JSON.stringify({ passed, scope: 'Actual HTML handler/Markdown renderer, synthetic owner/database and DOM parsing without script execution. Other export formats and native production download are separate.' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
