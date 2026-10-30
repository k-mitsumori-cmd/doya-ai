// Exercises the actual export function using accepted projects and synthetic browser adapters.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const root=process.env.DOYA_CSV_TEST_REPO||path.resolve(__dirname,'../..'),req=createRequire(root+'/package.json'),ts=req('typescript'),{load}=req(root+'/scripts/security-regression/load-typescript.cjs');
const rel='src/components/tenjikai/BoothStudio.tsx',file=process.env.DOYA_TEST_BASELINE&&fs.existsSync(path.join(process.env.DOYA_TEST_BASELINE,rel))?path.join(process.env.DOYA_TEST_BASELINE,rel):path.join(root,rel);
const source=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(rel,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const snippets=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&['download','extOf','graphicCsvCell','exportPack'].includes(n.name?.text)).map(n=>n.getText(ast));
const engine=load('src/lib/tenjikai/engine.ts'),kit=load('src/lib/tenjikai/design-kit.ts'),fit=load('src/lib/tenjikai/image-fit.ts'),image=load('src/lib/tenjikai/imagegen.ts',{'./design-kit':kit,'./image-fit':fit}),graphics=load('src/lib/tenjikai/graphics.ts',{'./design-kit':kit,'./imagegen':image,'./image-fit':fit}),store=load('src/lib/tenjikai/local-store.ts',{'./engine':engine,'./design-kit':kit});
const captured=[],blobs=new Map(),removed=[],revoked=[],timers=[];
const context={exports:{},Blob,URL:{createObjectURL:b=>{const u='blob:fixture-'+blobs.size;blobs.set(u,b);return u},revokeObjectURL:u=>revoked.push(u)},document:{body:{appendChild(){}},createElement:()=>{const a={click(){captured.push({name:a.download,href:a.href})},remove(){removed.push(a)}};return a}},setTimeout:(fn,delay)=>{timers.push(delay);fn();return 1}};
vm.runInNewContext(ts.transpileModule(snippets.join('\n')+'\nexports.exportPack=exportPack',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const cases=[],artifacts=[];
const quote=v=>'"'+v.replaceAll('"','""')+'"';
(async()=>{
 const base=engine.mockGeneratedPlan(engine.SAMPLE_INPUT),plan=engine.generateBoothPlans(engine.SAMPLE_INPUT)[0];
 for(const [headline,safe]of [['通常の日本語',false],['日本語, "引用"\n改行',false],['line1\r\nline2',false],['=1+1',true],['+1+1',true],['-1+1',true],['@SUM(1,1)',true],[' \t=1+1',true],['\ufeff=1+1',true],['\u0001+1+1',true],["'=already safe",false],['前置き =1+1',false]]){
  const analysis={...base.analysis,headline,brand:headline,valueProps:base.analysis.valueProps.map(x=>({...x,title:headline}))};
  const project={v:1,savedAt:Date.now(),input:engine.SAMPLE_INPUT,generated:{...base,analysis},variant:'A',selectedNovelty:[],panelImages:{}};
  assert.equal(store.loadProjectResult('synthetic',{getItem:()=>JSON.stringify(project)}).status,'ready');
  const panels=graphics.generateGraphicPlan(plan,analysis);captured.length=0;
  await context.exports.exportPack(plan,panels,{});assert.equal(captured.length,1);
  const event=captured[0],bytes=Buffer.from(await blobs.get(event.href).arrayBuffer()),csv=bytes.toString('utf8');assert.deepEqual([...bytes.subarray(0,3)],[239,187,191]);
  for(const panel of panels){const unsafe=/^[\s\u0000-\u001f\uFEFF]*[=+\-@]/.test(panel.headline),expected=(unsafe?"'":'')+panel.headline;assert(csv.includes(quote(expected)), 'headline is a text cell: '+JSON.stringify(headline));}
  assert.equal(event.name,'ブース案A_グラフィック割付.csv');assert.equal(revoked.at(-1),event.href);artifacts.push({input:headline,formulaPrefix:safe,expectedHeadlines:panels.map(p=>(/^[\s\u0000-\u001f\uFEFF]*[=+\-@]/.test(p.headline)?"'":'')+p.headline),csv});cases.push('CSV text handling '+JSON.stringify(headline));
 }
 const panels=graphics.generateGraphicPlan(plan,base.analysis);const images={[panels[0].id]:'data:image/jpeg;base64,c3ludGhldGlj',[panels[1].id]:'data:image/svg+xml;base64,c3ludGhldGlj'};captured.length=0;
 await context.exports.exportPack(plan,panels,images);assert.equal(captured.length,3);assert.equal(captured[1].href,images[panels[0].id]);assert.equal(captured[2].href,images[panels[1].id]);assert.match(captured[1].name,/^01_.*\.jpg$/);assert.match(captured[2].name,/^02_.*\.svg$/);assert.equal(timers.filter(x=>x===250).length,2);cases.push('JPEG/SVG filenames and image URLs retain their order; missing images skipped');
 const varied=[{...panels[0],name:'=panel',material:' \t@material',headline:'+headline'}];captured.length=0;await context.exports.exportPack(plan,varied,{});const csv=await blobs.get(captured[0].href).text();for(const cell of ["'=panel","' \t@material","'+headline"])assert(csv.includes(quote(cell)));cases.push('Every untrusted text column is guarded');
 if(process.env.DOYA_CSV_TEST_ARTIFACT)fs.writeFileSync(process.env.DOYA_CSV_TEST_ARTIFACT,JSON.stringify({scope:'Actual export function AST, actual accepted project/geometry/graphics. Synthetic DOM/Blob/download adapters; not native Excel/browser download/actor cancellation proof.',cases:artifacts},null,2));
 for(const name of cases)console.log('PASS Tenjikai CSV: '+name);console.log(JSON.stringify({passed:cases.length,scope:'Synthetic accepted project and actual export functions. No provider, network, real storage or spreadsheet execution.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
