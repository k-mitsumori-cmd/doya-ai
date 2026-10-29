const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict')
const ts = require('typescript'), { JSDOM } = require('jsdom'), { check: securityCheck } = require('./load-typescript.cjs')
const check = (name, run) => securityCheck('Interview content export: ' + name, run)
const root = path.resolve(__dirname, '../..'), relative = 'src/app/(shell)/interview/projects/[id]/edit/page.tsx'
const baseline = process.env.DOYA_TEST_BASELINE && path.join(process.env.DOYA_TEST_BASELINE, relative)
const source = fs.readFileSync(baseline && fs.existsSync(baseline) ? baseline : path.join(root, relative), 'utf8')
const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const helpers = ast.statements.filter(n => ts.isFunctionDeclaration(n) && ['escapeHtml','xmlCdata','markdownToPlainText','inlineToHtml','stripCodeFences','markdownToHtml'].includes(n.name?.text)).map(n => n.getText(ast))
const handlers = {}
function visit(n) { if (ts.isVariableDeclaration(n) && ['handleExportMd','handleExportTxt','handleExportHtml','handleExportPdf','exportTranslation','RICH_EDITOR_STYLES'].includes(n.name.getText(ast))) handlers[n.name.getText(ast)] = n.initializer.getText(ast); ts.forEachChild(n, visit) }
visit(ast)
const browser = new JSDOM('')
async function run(name, fixture = {}) {
  let blob, filename, html, closed = false, revoked = 0
  const toasts = []
  const code = helpers.join('\n') + '\nconst RICH_EDITOR_STYLES=' + handlers.RICH_EDITOR_STYLES + ';const handler=' + handlers[name] + ';handler();'
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    title: '', content: '', translationResult: null, ...fixture, Blob,
    URL: { createObjectURL: b => { blob = b; return 'blob:owned-test' }, revokeObjectURL: () => revoked++ },
    document: { createElement: () => { const a = { click() { filename = a.download } }; return a } },
    window: { open: () => fixture.blockPopup ? null : ({ document: { write: text => { html = text }, close: () => { closed = true } } }) },
    showToast: (...args) => toasts.push(args),
  }, { timeout: 1000 })
  return { text: blob ? await blob.text() : html, filename, mime: blob?.type, closed, revoked, toasts }
}
;(async () => {
  for (const title of ['日本語 & <tag> "quote" 🚀', 'Literal &copy; &#x1F680; &amp; &#169;', '', '</title><script>bad()</script>']) {
    for (const handler of ['handleExportHtml','handleExportPdf']) await check(`${handler} keeps literal title: ${title || 'empty'}`, async () => {
      const r = await run(handler, { title, content: 'Synthetic **body** & <tag> 🧪' })
      const dom = new browser.window.DOMParser().parseFromString(r.text, 'text/html')
      assert.equal(dom.title, title || 'article')
      assert.equal(dom.querySelector('h1').textContent, title)
      assert.equal(dom.querySelector('p').textContent, 'Synthetic body & <tag> 🧪')
      assert.equal(dom.querySelectorAll('script').length, handler === 'handleExportPdf' ? 1 : 0)
      if (handler === 'handleExportHtml') { assert.equal(r.filename, `${title || 'article'}.html`); assert.equal(r.revoked, 1) }
      else assert(r.closed)
    })
  }
  const plainCases = [
    ['headings and inline formatting', '# 見出し\n\n**太字**と*強調*、[リンク](https://example.invalid)\n> 引用\n- 項目\n1. 番号', '見出し\n\n太字と強調、リンク\n引用\n項目\n番号'],
    ['fenced code body and blank lines', 'Before\n\n```js\nconst x = "**keep**---";\n\n\nnext();\n```\n\nAfter', 'Before\n\nconst x = "**keep**---";\n\n\nnext();\n\nAfter'],
    ['long fence containing short fence', '````js\n```\ncode\n````', '```\ncode'],
    ['unclosed fence retains body', '```js\nconst x = 1;', 'const x = 1;'],
    ['tilde fence', '~~~text\n**literal**\n~~~', '**literal**'],
    ['inline code punctuation', 'Use `**raw**---` and **bold**.', 'Use **raw**--- and bold.'],
    ['multiple backticks', 'Use ``a ` b``.', 'Use a ` b.'],
    ['unmatched backticks stay literal', 'literal `` unmatched', 'literal `` unmatched'],
    ['image alternative and link text', '![図の説明](https://example.invalid/image.png)\n[参照](https://example.invalid)', '図の説明\n参照'],
    ['literal hyphens versus thematic breaks', '価格100---200\nA---B\n---\n***\n_ _ _', '価格100---200\nA---B\n\n\n'],
    ['indented code', "    const x = '**raw**';\n\tkeep---", "    const x = '**raw**';\n\tkeep---"],
    ['Unicode and meaningful blank lines', '日本語🚀\n\n\nNext', '日本語🚀\n\n\nNext'],
    ['empty body', '', ''],
  ]
  for (const [name, content, expected] of plainCases) await check('TXT export: ' + name, async () => {
    const r = await run('handleExportTxt', { title: 'Synthetic', content })
    assert.equal(r.text, expected); assert.equal(r.filename, 'Synthetic.txt'); assert.equal(r.mime, 'text/plain;charset=utf-8'); assert.equal(r.revoked, 1)
  })
  await check('Markdown export keeps complete original content and fallback filename', async () => {
    const content = '# 日本語🚀\n\n```js\nconst x = "---";\n```\n\nA---B\n&copy;'
    const r = await run('handleExportMd', { content }); assert.equal(r.text, content); assert.equal(r.filename, 'article.md'); assert.equal(r.revoked, 1)
  })
  await check('Translated Markdown includes exact title and body', async () => {
    const translationResult = { title: 'English &copy; 🚀', content: '# Body\n\nA---B', language: 'en' }
    const r = await run('exportTranslation', { translationResult }); assert.equal(r.text, '# English &copy; 🚀\n\n# Body\n\nA---B'); assert.equal(r.filename, 'English &copy; 🚀_en.md')
    const absent = await run('exportTranslation'); assert.equal(absent.text, undefined)
  })
  await check('Blocked print popup reports an error without writing a document', async () => {
    const r = await run('handleExportPdf', { blockPopup: true }); assert.equal(r.text, undefined); assert.equal(r.closed, false); assert.equal(r.toasts.length, 1); assert.equal(r.toasts[0][1], 'error')
  })
  browser.window.close()
})().catch(error => { browser.window.close(); console.error(error); process.exitCode = 1 })
