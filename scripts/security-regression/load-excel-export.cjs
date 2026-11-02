// ExcelJS uses instanceof Array in row.values. Keep route arrays in the same
// realm as the real serializer, as in production; VM arrays become empty rows.
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
module.exports = function loadExcelExport(file, mocks) {
  const baseline = process.env.DOYA_TEST_BASELINE && path.join(process.env.DOYA_TEST_BASELINE, file)
  const source = fs.readFileSync(baseline && fs.existsSync(baseline) ? baseline : path.join(root, file), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText
  const execute = vm.runInThisContext(`(function(exports, require, process, console) {\n${compiled}\n})`, { filename: file })
  const exports = {}
  execute(exports, name => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    throw Error('Unmocked ' + name)
  }, { env: {} }, { log() {}, warn() {}, error() {} })
  return exports
}
