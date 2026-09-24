const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/app/seo/articles/[id]/edit/page.tsx', 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let render;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'renderPreview') render = node.initializer;
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(render && ts.isArrowFunction(render));
const compiled = ts.transpileModule(`(${render.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const renderPreview = vm.runInNewContext(compiled);

const html = renderPreview('## Heading\n<img src=x onerror="alert(1)">\n[bad](javascript:alert(1))\n[good](https://example.com?q="test")');
assert.match(html, /<h2[^>]*>Heading<\/h2>/);
assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
assert.doesNotMatch(html, /<img|<svg|href="javascript:/i);
assert.match(html, /href="#"/);
assert.match(html, /href="https:\/\/example\.com\?q=&quot;test&quot;"/);
console.log('PASS SEO editor preview: raw HTML is escaped while Markdown formatting and safe links remain');
