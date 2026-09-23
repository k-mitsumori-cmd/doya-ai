const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const ast=ts.createSourceFile('f.tsx',fs.readFileSync(path.join(__dirname,'../../src/components/hr/EvaluationForm.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),codes={};function walk(n){if(ts.isVariableDeclaration(n)&&['handleSave','handleAiComment','handleManualSave'].includes(n.name.getText(ast)))codes[n.name.getText(ast)]=n.initializer.getText(ast);ts.forEachChild(n,walk);}walk(ast);
(async()=>{const results=[];
for(const mode of ['duplicate-ai','save-during-ai','duplicate-save','ai-during-save','save-failure','ai-failure']){
 let saves=0,ais=0,release,fail=mode.endsWith('failure');const pending=new Promise(r=>release=r);const savingRef={current:false},aiLoadingRef={current:false};
 const env={savingRef,aiLoadingRef,saving:false,aiLoading:false,isReadOnly:false,evaluationId:'e',employeeId:'employee',ratingField:'selfRating',goals:[],selfComment:'edited',managerComment:'',overallScore:4,setSaving:()=>{},setAiLoading:()=>{},setAiResult:()=>{},toast:{error:()=>{}},onSave:async()=>{saves++;if(['duplicate-save','ai-during-save'].includes(mode))await pending;if(mode==='save-failure'&&fail)throw Error('save');},fetch:async()=>{ais++;if(['duplicate-ai','save-during-ai'].includes(mode))await pending;if(mode==='ai-failure'&&fail)throw Error('ai');return Response.json({aiComment:'ok'});}};
 for(const name of ['handleSave','handleAiComment','handleManualSave'])env[name]=vm.runInNewContext(ts.transpileModule('('+codes[name]+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,env);
 const manual=['duplicate-save','ai-during-save'].includes(mode);const p=manual?env.handleManualSave():env.handleAiComment();
 if(mode==='duplicate-ai')await env.handleAiComment();if(mode==='save-during-ai')await env.handleManualSave();if(mode==='duplicate-save')await env.handleManualSave();if(mode==='ai-during-save')await env.handleAiComment();
 release();await p;assert.equal(saves,1);assert.equal(ais,manual||mode==='save-failure'?0:1);assert.equal(savingRef.current,false);assert.equal(aiLoadingRef.current,false);
 fail=false;await env.handleAiComment();assert.equal(saves,2);assert.equal(ais,manual||mode==='save-failure'?1:2);results.push({mode,outcome:'PASS'});
}
console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
