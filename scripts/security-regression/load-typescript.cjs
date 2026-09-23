const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');const ts=require(path.join(root,'node_modules/typescript'));let results=[];
function load(file,mocks={},globals={}){let exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(process.env.DOYA_TEST_BASELINE && fs.existsSync(path.join(process.env.DOYA_TEST_BASELINE,file)) ? path.join(process.env.DOYA_TEST_BASELINE,file) : path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:n=>{if(n in mocks)return mocks[n];throw Error('Unmocked '+n)},URL,Request,Response,Headers,Buffer,Date,Set,Map,Error,process:{env:{}},console:{log(){},warn(){},error(){}},...globals},{filename:file});return exports}
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)};
module.exports={load,check,results};
