const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
const good=()=>({ok:true,status:200,text:JSON.stringify({candidates:[{content:{parts:[{text:'Synthetic response'}]}}]})});
const body=json=>({generationConfig:json?{responseMimeType:'application/json'}:{}});
function fixture(answers){const calls=[];const api=load('src/lib/banner/text-answer.ts',{'./provider-response':{requestBannerTextProvider:async(url,payload)=>{calls.push({url,payload});const value=answers.shift();if(value instanceof Error)throw value;return value}}});return{...api,calls}}
(async()=>{let passed=0;
 for(const status of [429,500,502,503,403]){const f=fixture([{ok:false,status,text:'Synthetic provider failure'},good()]);await assert.rejects(f.requestBannerTextAnswer(['model-a','model-b'],'synthetic',body));assert.equal(f.calls.length,1);passed++}
 const uncertain=fixture([new Error('Synthetic network uncertainty'),good()]);await assert.rejects(uncertain.requestBannerTextAnswer(['model-a','model-b'],'synthetic',body));assert.equal(uncertain.calls.length,1);passed++;
 for(const text of ['{',JSON.stringify({candidates:[]}),JSON.stringify({candidates:[{content:{parts:[{text:123}]}}]})]){const f=fixture([{ok:true,status:200,text},good()]);await assert.rejects(f.requestBannerTextAnswer(['model-a','model-b'],'synthetic',body));assert.equal(f.calls.length,1);passed++}
 const notFound=fixture([{ok:false,status:404,text:'model missing'},good()]);assert.equal(await notFound.requestBannerTextAnswer(['model-a','model-a','model-b'],'synthetic',body),'Synthetic response');assert.equal(notFound.calls.length,2);passed++;
 const noJSON=fixture([{ok:false,status:400,text:'responseMimeType is not supported'},good()]);assert.equal(await noJSON.requestBannerTextAnswer(['model-a','model-b'],'synthetic',body),'Synthetic response');assert.equal(noJSON.calls.length,2);assert.equal(noJSON.calls[1].payload.generationConfig.responseMimeType,undefined);passed++;
 const otherInvalid=fixture([{ok:false,status:400,text:'INVALID_ARGUMENT invalid input'},good()]);await assert.rejects(otherInvalid.requestBannerTextAnswer(['model-a','model-b'],'synthetic',body));assert.equal(otherInvalid.calls.length,1);passed++;
 const fallbackFail=fixture([{ok:false,status:400,text:'response_mime_type unsupported'}, {ok:false,status:503,text:'failure'},good()]);await assert.rejects(fallbackFail.requestBannerTextAnswer(['model-a','model-b'],'synthetic',body));assert.equal(fallbackFail.calls.length,2);passed++;
 const invalid=fixture([good()]);await assert.rejects(invalid.requestBannerTextAnswer(['../../bad'],'synthetic',body));assert.equal(invalid.calls.length,0);passed++;
 assert.equal(passed,14);console.log('PASS14 banner text answer cases: only definitive404/explicit MIME rejection can switch; network/5xx/429/invalid output never retry. Actual helper, synthetic provider. Route integration has separate API regressions.');
})().catch(e=>{console.error(e);process.exitCode=1});
