const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const { check } = require('./load-typescript.cjs')

const root = path.resolve(__dirname, '../..')
const relative = 'src/app/(shell)/interview/projects/[id]/edit/page.tsx'
const baseline = process.env.DOYA_TEST_BASELINE && path.join(process.env.DOYA_TEST_BASELINE, relative)
const source = fs.readFileSync(baseline && fs.existsSync(baseline) ? baseline : path.join(root, relative), 'utf8')
const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const helpers = ['escapeHtml', 'xmlCdata', 'inlineToHtml', 'stripCodeFences', 'markdownToHtml']
const declarations = ast.statements.filter(n => ts.isFunctionDeclaration(n) && helpers.includes(n.name?.text))
let handler
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleExportWpXml') handler = node.initializer.getText(ast)
  ts.forEachChild(node, visit)
}
visit(ast)
assert(handler, 'execute the actual export handler without mounting the page or running AI effects')
const javascript = ts.transpileModule(declarations.map(n => n.getText(ast)).join('\n') + '\nconst handler = ' + handler + ';handler();', {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText
const browser = new JSDOM('')
const standardBody = 'Synthetic **body** & <tag> 🧪'
const standardHtml = '<p>Synthetic <strong>body</strong> &amp; &lt;tag&gt; 🧪</p>'
const cases = [
  { name: 'normal Japanese, entities and emoji', title: '日本語 &copy; <title> "quote" 🚀', expected: '日本語 &copy; <title> "quote" 🚀' },
  { name: 'CDATA terminator', title: 'Before ]]> after', expected: 'Before ]]> after' },
  { name: 'repeated CDATA terminators', title: ']]> one ]]> two ]]>', expected: ']]> one ]]> two ]]>' },
  { name: 'XML markup in title remains title text', title: ']]></title><wp:status>publish</wp:status><title><![CDATA[', expected: ']]></title><wp:status>publish</wp:status><title><![CDATA[' },
  { name: 'XML forbidden title characters', title: 'Before\u0000\u0001\u0008\u000b\u000c\u000e\u001f\ufffe\uffffAfter', expected: 'BeforeAfter' },
  { name: 'XML forbidden content characters', title: 'Body controls', expected: 'Body controls', content: 'Before\u0001\ufffeAfter', html: '<p>BeforeAfter</p>' },
  { name: 'unpaired surrogates', title: 'Before\ud800After\udfff', expected: 'BeforeAfter' },
  { name: 'valid XML whitespace', title: 'Before\tMiddle\nAfter', expected: 'Before\tMiddle\nAfter' },
  { name: 'empty title fallback', title: '', expected: 'article' },
]

;(async () => {
  for (const fixture of cases) await check('WordPress export: ' + fixture.name, async () => {
    let blob, filename, revoked = 0
    vm.runInNewContext(javascript, {
      title: fixture.title, content: fixture.content ?? standardBody, Date, Blob,
      URL: { createObjectURL: value => { blob = value; return 'blob:owned-synthetic-export' }, revokeObjectURL: url => { assert.equal(url, 'blob:owned-synthetic-export'); revoked++ } },
      document: { createElement: tag => { assert.equal(tag, 'a'); const anchor = { click() { filename = anchor.download } }; return anchor } },
    }, { timeout: 1000 })
    assert.equal(blob.type, 'application/xml;charset=utf-8')
    assert.equal(filename, `${fixture.title || 'article'}_wordpress.xml`)
    assert.equal(revoked, 1)
    const xml = new browser.window.DOMParser().parseFromString(await blob.text(), 'application/xml')
    assert.equal(xml.getElementsByTagName('parsererror').length, 0, fixture.name + ' must be valid XML')
    const items = xml.getElementsByTagName('item')
    assert.equal(items.length, 1)
    const item = items[0]
    assert.equal(item.getElementsByTagName('title').length, 1)
    assert.equal(item.getElementsByTagName('title')[0].textContent, fixture.expected)
    assert.equal(item.getElementsByTagNameNS('http://purl.org/rss/1.0/modules/content/', 'encoded')[0].textContent, fixture.html ?? standardHtml)
    assert.equal(item.getElementsByTagNameNS('http://wordpress.org/export/1.2/', 'status').length, 1)
    assert.equal(item.getElementsByTagNameNS('http://wordpress.org/export/1.2/', 'status')[0].textContent, 'draft')
    assert.equal(item.getElementsByTagNameNS('http://wordpress.org/export/1.2/', 'post_type')[0].textContent, 'post')
  })
  browser.window.close()
})().catch(error => { browser.window.close(); console.error(error); process.exitCode = 1 })
