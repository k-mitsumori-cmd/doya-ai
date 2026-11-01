const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const file='src/components/doyaslide/NewDoyaSlideWizard.tsx',text=fs.readFileSync(file,'utf8');
const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let initializer;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='refreshUsage')initializer=node.initializer;ts.forEachChild(node,visit)}visit(ast);assert.ok(initializer);
const js=ts.transpileModule('('+initializer.arguments[0].getText(ast)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
(async()=>{const results=[];for(const [name,body]of [
 ['negative unsupported quota',{tier:'FREE',limits:{maxProjects:-2},usage:{projects:0}}],
 ['fractional quota',{tier:'FREE',limits:{maxProjects:1.5},usage:{projects:0}}],
 ['negative usage',{tier:'FREE',limits:{maxProjects:1},usage:{projects:-1}}],
 ['unknown plan',{tier:'UNKNOWN',limits:{maxProjects:1},usage:{projects:0}}],
 ['contradictory plan',{plan:'PRO',tier:'FREE',limits:{maxProjects:1},usage:{projects:0}}],
 ['error in success',{tier:'FREE',error:'SYNTHETIC_PRIVATE',limits:{maxProjects:1},usage:{projects:0}}],
 ]){const state={login:null,message:'PREVIOUS_LIMIT',upgrade:'PREVIOUS_URL'};const fn=vm.runInNewContext(js,{fetch:async()=>Response.json(body),setLoginRequired:v=>state.login=v,setProjectLimitMessage:v=>state.message=v,setProjectUpgradeUrl:v=>state.upgrade=v,Error});let rejected=false;try{await fn()}catch{rejected=true}assert.equal(rejected,false);assert.equal(state.message,null);results.push({name,observed:'Accepted malformed metadata and cleared previous limit warning',state})}
 console.log(JSON.stringify({status:'confirmed-unfixed',results,scope:'Extracted actual refreshUsage callback with synthetic HTTP/setters; proves weak metadata validation, not real customer quota bypass. Server mutation quota remains independently enforced.'},null,2));})().catch(e=>{console.error(e);process.exitCode=1});
