const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const r=path.resolve(__dirname,'../..'),candidate=path.join(r,'src/lib/kintai'),ts=require(path.join(r,'node_modules/typescript'));
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n in mocks)return mocks[n];throw Error(n)},Date,console},{filename:file});return exports}
const attendance=load(candidate+'/attendance.ts'),shift=load(r+'/src/lib/kintai/shift-records.ts'),{calculateClockDisplayMinutes:calc}=load(candidate+'/clock-display.ts',{'./attendance':attendance,'./shift-records':shift});
const start=Date.parse('2026-11-02T09:00:00+09:00');
const specs=[
 ['empty',[],60,0,0],
 ['single completed',[['clock_in',0],['clock_out',540]],600,540,0],
 ['single live',[['clock_in',0]],60,60,0],
 ['finished stops growing',[['clock_in',0],['clock_out',60]],1200,60,0],
 ['closed break',[['clock_in',0],['break_start',60],['break_end',90],['clock_out',180]],200,150,30],
 ['multiple shifts exclude two hour gap',[['clock_in',0],['clock_out',180],['clock_in',300],['break_start',360],['break_end',375],['clock_out',540]],600,405,15],
 ['second shift live',[['clock_in',0],['clock_out',180],['clock_in',300]],360,240,0],
 ['first break and second live',[['clock_in',0],['break_start',60],['break_end',90],['clock_out',180],['clock_in',300]],360,210,30],
 ['ongoing break freezes worked minutes',[['clock_in',0],['break_start',180]],240,180,60],
 ['completed and ongoing breaks',[['clock_in',0],['break_start',60],['break_end',90],['break_start',120]],150,90,60],
 ['clock out closes current break',[['clock_in',0],['break_start',60],['clock_out',90]],180,60,30],
 ['duplicate clock in adds no interval',[['clock_in',0],['clock_in',30],['clock_out',60]],180,60,0],
 ['orphan break ignored',[['break_end',-5],['clock_in',0],['clock_out',60]],180,60,0],
 ['orphan out ignored',[['clock_out',-5],['clock_in',0],['clock_out',60]],180,60,0],
 ['backward client time clamped',[['clock_in',60]],30,0,0],
 ['backward client on break',[['clock_in',0],['break_start',60]],30,60,0],
 ['round once across intervals',[['clock_in',0],['clock_out',31/60],['clock_in',5],['clock_out',5+31/60]],30,1,0],
 ['round once across breaks',[['clock_in',0],['break_start',1],['break_end',1+31/60],['break_start',3],['break_end',3+31/60],['clock_out',10]],30,9,1],
 ['midnight carried shift',[['clock_in',870]],930,60,0],
 ['closed midnight carried shift',[['clock_in',870],['clock_out',930]],1500,60,0],
 ['completed shift then invalid client time',[['clock_in',0],['clock_out',180],['clock_in',300]],NaN,180,0],
 ['same time out then in preserves API order',[['clock_in',0],['clock_out',60],['clock_in',60]],120,120,0],
 ['reproduced private six event durations',[['clock_in',0],['break_start',23/60],['break_end',63/60],['clock_out',105/60],['clock_in',30+46/60],['clock_out',31+30/60]],60,2,1],
];
const cases=[];
for(const[name,events,asOf,work,rest]of specs){try{const records=events.map(([type,minute],i)=>({id:'c'+String(1000-i).padStart(24,'0'),employeeId:'c'+String(100).padStart(24,'0'),type,timestamp:new Date(start+minute*60000).toISOString()}));const snapshot=JSON.stringify(records),actual=calc(records,new Date(start+asOf*60000));assert.equal(actual.workMinutes,work);assert.equal(actual.breakMinutes,rest);assert.equal(JSON.stringify(records),snapshot);cases.push({name,passed:true,workMinutes:work,breakMinutes:rest});console.log('PASS Kintai clock display: '+name)}catch(e){cases.push({name,passed:false,error:e.message});console.error('FAIL '+name+': '+e.message)}}
const sourceFiles=['src/lib/kintai/clock-display.ts','src/lib/kintai/attendance.ts','src/lib/kintai/shift-records.ts'];
const out={checkedAt:new Date().toISOString(),passed:cases.filter(x=>x.passed).length,failed:cases.filter(x=>!x.passed).length,cases,sourceHashes:Object.fromEntries(sourceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(r,f))).digest('hex')])),scope:'Actual shared clock-display and canonical attendance modules, explicit expected durations/input immutability. Offline, not mounted/native/provider/production proof.'};
if(process.env.DOYA_KINTAI_CLOCK_DISPLAY_RESULT)fs.writeFileSync(process.env.DOYA_KINTAI_CLOCK_DISPLAY_RESULT,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({passed:out.passed,failed:out.failed}));process.exitCode=out.failed?1:0;
