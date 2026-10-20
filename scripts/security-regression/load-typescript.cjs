const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');const ts=require(path.join(root,'node_modules/typescript'));let results=[];
function load(file,mocks={},globals={}){let exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(process.env.DOYA_TEST_BASELINE && fs.existsSync(path.join(process.env.DOYA_TEST_BASELINE,file)) ? path.join(process.env.DOYA_TEST_BASELINE,file) : path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:n=>{if(n in mocks)return mocks[n];if(n==='@/lib/private-api-response')return load('src/lib/private-api-response.ts',{'next/server':mocks['next/server']||{NextResponse:Response}});if(n in DEFAULT_MOCKS)return DEFAULT_MOCKS[n];throw Error('Unmocked '+n)},URL,Request,Response,Headers,Buffer,Date,Set,Map,Error,process:{env:{}},console:{log(){},warn(){},error(){}},...globals},{filename:file});return exports}
// ベータで非表示のサービスの入口の判定（src/lib/beta-services.ts）。各サービスのテストでは「許可された人」として通す。
// 判定そのものは verify-beta-hidden-services.cjs が本物で確かめる（2026-10-19）
const DEFAULT_MOCKS={'@/lib/beta-services':{betaServiceGuard:async()=>null,betaServiceAllowed:async()=>true,canUseBetaService:()=>true,betaAllowEmails:()=>[]}};
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)};
module.exports={load,check,results};
