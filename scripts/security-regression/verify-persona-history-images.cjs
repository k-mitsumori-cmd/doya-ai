const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
const {savePersonaRecord,savePersonaImage}=load('src/lib/persona/history-records.ts',{});
const H='doya_persona_history',L='doya_persona_last';
function setup(){const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};return{values,storage,last:()=>JSON.parse(values.get(L)||'null'),history:()=>JSON.parse(values.get(H)||'[]')}}
const record=(id,name=id)=>({id,data:{persona:{name}},timestamp:123,url:'https://example.invalid'});
{
 const s=setup(),r=record('a');savePersonaRecord(s.storage,r);savePersonaImage(s.storage,r.id,r.data,{portrait:'portrait'});savePersonaImage(s.storage,r.id,r.data,{sceneImages:{one:'one'}});savePersonaImage(s.storage,r.id,r.data,{sceneImages:{two:'two'}});assert.equal(s.history()[0].portrait,'portrait');assert.equal(s.history()[0].sceneImages.one,'one');assert.equal(s.history()[0].sceneImages.two,'two');assert.deepEqual(s.last(),s.history()[0]);console.log('PASS portrait and multiple scenes survive history reload');
 savePersonaRecord(s.storage,record('b'));savePersonaImage(s.storage,r.id,r.data,{sceneImages:{three:'three'}});assert.equal(s.last().id,'b');assert.equal(s.last().sceneImages,undefined);assert.equal(s.history()[1].sceneImages.three,'three');console.log('PASS updating history does not overwrite another last record');
 s.values.set(H,JSON.stringify(s.history().filter(v=>v.id!=='a')));assert.equal(savePersonaImage(s.storage,r.id,r.data,{portrait:'late'}),false);assert.equal(s.history().length,1);console.log('PASS deleted history is not recreated by late image');
}
{
 const s=setup(),a=record('a','same'),b=record('b','same');savePersonaRecord(s.storage,a);savePersonaRecord(s.storage,b);savePersonaImage(s.storage,'a',a.data,{portrait:'A'});assert.equal(s.history()[0].portrait,undefined);assert.equal(s.history()[1].portrait,'A');assert.equal(s.last().portrait,undefined);assert.equal(savePersonaImage(s.storage,'a',{persona:{name:'changed'}},{portrait:'wrong'}),false);assert.equal(savePersonaImage(s.storage,null,a.data,{portrait:'legacy'}),false);console.log('PASS identical text is isolated by record ID and stale revision rejected');
}
{
 const s=setup();for(let i=0;i<25;i++)savePersonaRecord(s.storage,record(String(i)));assert.equal(s.history().length,20);assert.equal(s.history()[0].id,'24');assert.equal(s.history()[19].id,'5');savePersonaRecord(s.storage,record('24','edited'));assert.equal(s.history().length,20);assert.equal(s.history().filter(r=>r.id==='24').length,1);console.log('PASS 20-record retention and exact-ID replacement');
}
for(const mode of ['corrupt','full-history','full-last']){
 const s=setup(),r=record('a');savePersonaRecord(s.storage,r);const set=s.storage.setItem;if(mode==='corrupt')s.values.set(H,'{}');else s.storage.setItem=(k,v)=>{if(k===(mode==='full-history'?H:L))throw Error('full');set(k,v)};assert.throws(()=>savePersonaImage(s.storage,'a',r.data,{portrait:'new'}));assert.equal(s.last().portrait,undefined);if(mode==='full-last')assert.equal(s.history()[0].portrait,'new');console.log('PASS',mode,'reported; previous last preserved');
}
