const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const srcRoot = path.join(__dirname, '../../src');
const seoRoot = path.join(__dirname, '../../seo');
const exceptionNames = /^(e|err|error|releaseError|notifyErr|lastError|errorText|responseText|providerError)$/;

function exposesException(node) {
  if (ts.isIdentifier(node)) return exceptionNames.test(node.text);
  if (ts.isPropertyAccessExpression(node)) {
    if (node.name.text === 'message' || node.name.text === 'stack') return true;
    if (node.name.text === 'code' || node.name.text === 'name' || node.name.text === 'failure') return false;
    return exposesException(node.expression);
  }
  if (ts.isConditionalExpression(node)) return exposesException(node.whenTrue) || exposesException(node.whenFalse);
  if (ts.isObjectLiteralExpression(node)) return node.properties.some(property =>
    ts.isPropertyAssignment(property) && exposesException(property.initializer));
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) return false;
  let unsafe = false;
  ts.forEachChild(node, child => { if (exposesException(child)) unsafe = true; });
  return unsafe;
}

function* libraries(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* libraries(file);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) yield file;
  }
}

const violations = [];
for (const file of [...libraries(srcRoot), ...libraries(seoRoot)]) {
  const rel = path.relative(path.join(__dirname, '../..'), file);
  // CLI password-validation messages are intended operator output, not runtime exception logging.
  if (rel.startsWith(`src${path.sep}scripts${path.sep}`)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'console'
        && (node.expression.name.text === 'error' || node.expression.name.text === 'warn')
        && node.arguments.some(exposesException)) {
      const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      violations.push(`${rel}:${line}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

assert.deepEqual(violations, [], `Raw exception data in server logs: ${violations.join(', ')}`);
console.log('PASS server and client error/warning logs do not include raw exception objects, messages, or stacks');
