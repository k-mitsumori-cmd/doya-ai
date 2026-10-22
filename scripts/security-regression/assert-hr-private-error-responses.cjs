// Check exception-response dataflow, including explicitly imported public validation errors.
const assert = require('node:assert/strict');
const ts = require('typescript');
const publicClasses = {
  HrEvaluationInputError: '@/lib/hr/evaluation-input',
  HrEvaluationWorkflowError: '@/lib/hr/evaluation-input',
  HrEvaluationAiAccessError: '@/lib/hr/evaluation-ai-access',
  HrEvaluationPeriodInputError: '@/lib/hr/evaluation-period-input',
  HrEvaluationPeriodOperationAccessError: '@/lib/hr/evaluation-period-operation',
  HrEvaluationOverviewError: '@/lib/hr/evaluation-period-overview',
  HrDetailTransferError: '@/lib/hr/evaluation-detail-transfer-server',
  LifecycleError: '@/lib/account-lifecycle/state',
  OwnerTransferError: '@/lib/hr/owner-transfer/types',
};
function trustedGuard(node, variable, imported, ast) {
  if (ts.isParenthesizedExpression(node)) return trustedGuard(node.expression, variable, imported, ast);
  if (!ts.isBinaryExpression(node)) return false;
  if (node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
    return trustedGuard(node.left, variable, imported, ast) && trustedGuard(node.right, variable, imported, ast);
  }
  return node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
    node.left.getText(ast) === variable && imported.has(node.right.getText(ast));
}
function assertPrivateErrorResponses(source, filename = 'route.ts') {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const imported = new Map();
  for (const node of ast.statements) if (ts.isImportDeclaration(node) && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
    for (const item of node.importClause.namedBindings.elements) {
      const name = (item.propertyName || item.name).text;
      if (publicClasses[name] === node.moduleSpecifier.text) imported.set(item.name.text, name);
    }
  }
  const discover = node => {
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer && ts.isAwaitExpression(node.initializer)) {
      const call = node.initializer.expression;
      if (ts.isCallExpression(call) && call.expression.kind === ts.SyntaxKind.ImportKeyword && call.arguments.length === 1 && ts.isStringLiteral(call.arguments[0])) {
        for (const item of node.name.elements) {
          const name = (item.propertyName || item.name).getText(ast);
          if (publicClasses[name] === call.arguments[0].text) imported.set(item.name.getText(ast), name);
        }
      }
    }
    ts.forEachChild(node, discover);
  };
  discover(ast);
  const walk = node => {
    if (ts.isPropertyAssignment(node) && node.name.getText(ast).replace(/['"]/g, '') === 'error') {
      const value = node.initializer;
      if (ts.isPropertyAccessExpression(value) && ts.isIdentifier(value.expression) && ['e', 'err', 'error'].includes(value.expression.text) && ['message', 'stack'].includes(value.name.text)) {
        assert.equal(value.name.text, 'message', filename + ' returns exception stack');
        const variable = value.expression.getText(ast);
        let guard = null;
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (ts.isIfStatement(parent) && node.pos >= parent.thenStatement.pos && node.end <= parent.thenStatement.end &&
              trustedGuard(parent.expression, variable, imported, ast)) { guard = parent; break; }
        }
        assert(guard, filename + ' exposes an untrusted exception message');
        const call = node.parent.parent;
        assert(ts.isCallExpression(call) && call.expression.getText(ast) === 'privateApiJson', filename + ' public error must use private response');
        const options = call.arguments[1];
        assert(options && ts.isObjectLiteralExpression(options), filename + ' missing explicit safe error status');
        const status = options.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(ast) === 'status')?.initializer;
        assert(status && (ts.isNumericLiteral(status) && [400, 401, 403, 404, 409].includes(Number(status.text)) || ts.isPropertyAccessExpression(status) && status.getText(ast) === variable + '.status'), filename + ' public exception must never become a500 response');
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(ast);
}
module.exports = { assertPrivateErrorResponses };
