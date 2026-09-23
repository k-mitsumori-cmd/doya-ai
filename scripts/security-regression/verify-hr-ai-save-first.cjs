const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../../src/components/hr/EvaluationForm.tsx'),'utf8'),ast=ts.createSourceFile('f.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),codes={};function walk(n){if(ts.isVariableDeclaration(n)&&['handleSave','handleAiComment'].includes(n.name.getText(ast)))codes[n.name.getText(ast)]=n.initializer.getText(ast);ts.forEachChild(n,walk);}walk(ast);
(async()=>{const results=[];
for(const mode of ['saved','save-failed','save-pending','ai-failed','saving','generating','finalized']){
 const calls=[],errors=[];let stored='old',answer=null,release;const pending=new Promise(r=>release=r);
 const env={savingRef:{current:false},aiLoadingRef:{current:false},saving:mode==='saving',aiLoading:mode==='generating',isReadOnly:mode==='finalized',evaluationId:'e',employeeId:'employee',ratingField:'selfRating',goals:[],selfComment:'edited',managerComment:'',overallScore:4,setSaving:()=>{},setAiLoading:()=>{},setAiResult:v=>answer=v,toast:{error:e=>errors.push(e)},onSave:async p=>{calls.push('save');if(mode==='save-pending')await pending;if(mode==='save-failed')throw Error('save blocked');stored=p.selfComment;},fetch:async()=>{calls.push('ai');assert.equal(stored,'edited');return Response.json(mode==='ai-failed'?{error:'changed while generating'}:{aiComment:'result from '+stored},{status:mode==='ai-failed'?409:200});}};
 for(const name of ['handleSave','handleAiComment'])env[name]=vm.runInNewContext(ts.transpileModule('('+codes[name]+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,env);
 const p=env.handleAiComment();if(mode==='save-pending'){assert.deepEqual(calls,['save']);release();}await p;
 if(['saving','generating','finalized'].includes(mode)){assert.equal(calls.length,0);}else if(mode==='save-failed'){assert.deepEqual(calls,['save']);assert.equal(stored,'old');assert.equal(errors.length,1);assert.match(answer,/AI生成は実行していません/);}else{assert.deepEqual(calls,['save','ai']);assert.equal(answer,mode==='ai-failed'?'エラー: changed while generating':'result from edited');}
 results.push({mode,calls,outcome:'PASS'});
}
console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
