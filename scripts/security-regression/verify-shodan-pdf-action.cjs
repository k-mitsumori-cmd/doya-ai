const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');const{load,check,results}=require('./load-typescript.cjs');
const file='src/app/shodan/[orgSlug]/p/[id]/slides/page.tsx',source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression;
function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='downloadPdf')expression=n.initializer.getText(ast);ts.forEachChild(n,walk)}walk(ast);assert.ok(expression);
const compiled=ts.transpileModule('exports.run='+expression,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(mode){const errors=[],busyStates=[];let saved=0,pages=1,images=0,fetches=0;const prep={slidesJson:Array(14).fill({}),slideImages:Array.from({length:mode==='missing'?8:14},(_,i)=>({imageUrl:'url'+i})),targetName:'Synthetic'};
 class PDF{constructor(){this.internal={pageSize:{getWidth:()=>842,getHeight:()=>595}}}addPage(){pages++}addImage(){images++}save(){saved++}}
 const exports={};vm.runInNewContext(compiled,{exports,require:n=>{assert.equal(n,'jspdf');return{jsPDF:PDF}},prep,busy:mode==='generating'?{0:true}:{},pdfBusy:mode==='busy',setPdfBusy:v=>busyStates.push(v),completeSlideImages:load('src/lib/shodan/complete-slide-images.ts').completeSlideImages,toast:{error:e=>errors.push(e)},urlToDataUrl:async()=>{fetches++;if(mode==='fetch-failure')throw Error('synthetic fetch failure');return'data'},imgSize:async()=>{if(mode==='decode-failure')throw Error('synthetic decode failure');return{w:100,h:50}}});
 return{run:exports.run,stats:()=>({saved,pages,images,fetches,errors,busyStates})};
}
(async()=>{
 for(const mode of ['complete','missing','generating','busy','fetch-failure','decode-failure'])await check('actual PDF handler '+mode,async()=>{const f=fixture(mode);await f.run();const s=f.stats();assert.equal(s.saved,mode==='complete'?1:0);if(mode==='complete'){assert.equal(s.pages,14);assert.equal(s.images,14);assert.equal(s.fetches,14)}if(['missing','fetch-failure','decode-failure'].includes(mode))assert.equal(s.errors.length,1);if(['missing','generating','busy'].includes(mode))assert.equal(s.fetches,0);if(['complete','fetch-failure','decode-failure'].includes(mode))assert.deepEqual(s.busyStates,[true,false]);});
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
