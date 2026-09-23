const assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript'),vm=require('vm'),path=require('path'),{load}=require('./load-typescript.cjs');
const {deletePersonaRecord,clearPersonaRecords,selectPersonaRecord,savePersonaImage}=load('src/lib/persona/history-records.ts',{});
const H='doya_persona_history',L='doya_persona_last',a={id:'a',data:{persona:{name:'A'}},timestamp:1,url:'a'},b={id:'b',data:{persona:{name:'B'}},timestamp:2,url:'b'};
function setup(){const values=new Map([[H,JSON.stringify([b,a])],[L,JSON.stringify(a)]]),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};return{values,storage}}
{
 const {values,storage}=setup();deletePersonaRecord(storage,a);assert.equal(values.has(L),false);assert.equal(JSON.parse(values.get(H))[0].id,'b');assert.equal(savePersonaImage(storage,'a',a.data,{portrait:'late'}),false);assert.throws(()=>selectPersonaRecord(storage,a));console.log('PASS delete clears restored copy, retains newer history, rejects stale selection and image');
}
{
 const {values,storage}=setup();deletePersonaRecord(storage,b);assert.equal(JSON.parse(values.get(L)).id,'a');selectPersonaRecord(storage,a);clearPersonaRecords(storage);assert.equal(values.size,0);console.log('PASS unrelated last retained; clear-all removes both');
}
{
 const {values,storage}=setup();const legacy={data:a.data,timestamp:10,url:'x'},other={...legacy,timestamp:11};values.set(H,JSON.stringify([legacy,other]));values.set(L,JSON.stringify(legacy));deletePersonaRecord(storage,legacy);assert.equal(values.has(L),false);assert.equal(JSON.parse(values.get(H))[0].timestamp,11);console.log('PASS ID-less exact record deletion');
}
{
 const {values,storage}=setup();values.set(H,JSON.stringify([{...a,portrait:'latest'}]));selectPersonaRecord(storage,a);assert.equal(JSON.parse(values.get(L)).portrait,'latest');console.log('PASS selection reads fresh image data instead of stale UI snapshot');
}
for(const where of ['last','history']){
 const {values,storage}=setup();const remove=storage.removeItem;storage.removeItem=k=>{if(k===(where==='last'?L:H))throw Error('denied');remove(k)};assert.throws(()=>clearPersonaRecords(storage));assert.equal(values.has(H),true);assert.equal(values.has(L),where==='last');console.log('PASS clear-all',where,'failure propagates');
}
const source=fs.readFileSync(path.resolve(__dirname,'../../src/app/persona/Tool.tsx'),'utf8'),ast=ts.createSourceFile('Tool.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let effect;
function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('const historyChanged'))effect=n.arguments[0].getText(ast);ts.forEachChild(n,visit)}visit(ast);
const code=ts.transpileModule('('+effect+');',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
for(const scenario of ['history-delete','last-delete','all-clear','other-account','other-record','malformed']){
 let listener,clears=0;const localStorage={},env={initialRecord:undefined,window:{localStorage,addEventListener:(name,fn)=>listener=fn,removeEventListener:(name,fn)=>{assert.equal(fn,listener);listener=null}},accountStorage:{isKey:(k,n)=>k==='A:'+n},currentServerRecord:{current:false},setAccessWarning(){},currentRecordId:{current:'a'},currentPersona:{current:a.data},textRequest:{current:Symbol()},autoGenerateFor:{current:a.data},setGeneratedData:v=>{assert.equal(v,null);clears++},setPortraitImage(){},setSceneImages(){},setUrl(){},setModificationInput(){},setLoading(){},setModifying(){},setError(){}};
 const cleanup=vm.runInNewContext(code,env)();const event={storageArea:localStorage,key:'A:'+H,oldValue:null,newValue:JSON.stringify([b])};if(scenario==='last-delete'){event.key='A:'+L;event.oldValue=JSON.stringify(a);event.newValue=null}if(scenario==='all-clear'){event.key=null;event.newValue=null}if(scenario==='other-account')event.key='B:'+H;if(scenario==='other-record')event.newValue=JSON.stringify([a]);if(scenario==='malformed')event.newValue='{';listener(event);assert.equal(clears,['history-delete','last-delete','all-clear'].includes(scenario)?1:0);if(clears)assert.equal(env.textRequest.current,null);cleanup();assert.equal(listener,null);console.log('PASS storage event',scenario);
}
