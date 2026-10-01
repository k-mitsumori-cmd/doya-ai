const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const apiRoot = path.join(__dirname, '../../src/app/api');
const services = new Set(['banner', 'persona', 'interview', 'hr', 'kintai', 'doyaslide', 'doyalist', 'promane', 'sfa', 'shodan', 'aio']);
const exceptionNames = /^(e|err|error|releaseError|notifyErr|lastError|errorText|responseText|providerError)$/;

function exposesException(node) {
  if (ts.isIdentifier(node)) return exceptionNames.test(node.text);
  if (ts.isPropertyAccessExpression(node)) {
    if (node.name.text === 'message' || node.name.text === 'stack') return true;
    if (node.name.text === 'code' || node.name.text === 'name') return false;
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

function* routes(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* routes(file);
    else if (entry.name === 'route.ts') yield file;
  }
}

const violations = [];
for (const file of routes(apiRoot)) {
  const rel = path.relative(apiRoot, file);
  if (!services.has(rel.split(path.sep)[0])) continue;
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
console.log('PASS service API logs do not include raw exception objects, messages, or stacks');
