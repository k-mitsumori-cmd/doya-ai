'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=require('node:path').resolve(__dirname,'../..');
const ts=require(root+'/node_modules/typescript');
const path=process.env.DOYA_AUTH_DIAGNOSTIC_SOURCE||root+'/src/lib/auth-logger.ts';
const src=fs.readFileSync(path,'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const moduleObject={exports:{}};new Function('exports','module',js)(moduleObject.exports,moduleObject);
const logger=moduleObject.exports.authLogger;
const original={error:console.error,warn:console.warn};let logs=[];
console.error=(...v)=>logs.push({level:'error',args:v});console.warn=(...v)=>logs.push({level:'warn',args:v});
const results=[];const secret='SYNTHETIC_PRIVATE_CANARY_do_not_emit';
function check(name,fn){logs=[];fn();assert(!JSON.stringify(logs).includes(secret));results.push({name,passed:true});}
function diagnostic(input,expected){logger.error('CLIENT_FETCH_ERROR',input);assert.deepEqual(logs,[{level:'error',args:['[next-auth][error][CLIENT_FETCH_ERROR]',expected]}]);}
try{
 const unknown={endpoint:'other',errorFamilyHint:'unknown',client:false};
 for(const [name,value] of [['null',null],['undefined',undefined],['string',secret],['array',[]],['empty',{}]])check('malformed metadata '+name,()=>diagnostic(value,unknown));
 for(const endpoint of ['session','providers','csrf'])check('allowlisted endpoint '+endpoint,()=>diagnostic({url:'/api/auth/'+endpoint+'?token='+secret,client:'true',error:'[object Object]',message:secret},{endpoint,errorFamilyHint:'unknown',client:true}));
 check('absolute URL host query userinfo fragments are omitted',()=>diagnostic({url:'https://'+secret+'@private.invalid/api/auth/session?key='+secret+'#'+secret},{endpoint:'session',errorFamilyHint:'unknown',client:false}));
 check('unknown endpoint omitted',()=>diagnostic({url:'/api/auth/callback/'+secret},unknown));
 check('malformed URL omitted',()=>diagnostic({url:'https://['+secret},unknown));
 check('oversized URL omitted',()=>diagnostic({url:'/api/auth/session?'+secret.repeat(200)},unknown));
 for(const message of ['Failed to fetch','Load failed','NetworkError when attempting to fetch resource.'])check('network message '+message,()=>diagnostic({message,error:{stack:secret}},{...unknown,errorFamilyHint:'network'}));
 for(const message of ['Unexpected token '+secret,'Unexpected end of JSON input','JSON.parse: '+secret])check('JSON hint no message content '+message.split(' ')[0],()=>diagnostic({message},{...unknown,errorFamilyHint:'invalid_json'}));
 check('direct SyntaxError hint omits raw content',()=>diagnostic({error:new SyntaxError(secret)},{...unknown,errorFamilyHint:'invalid_json'}));
 check('direct AbortError hint',()=>diagnostic({error:{name:'AbortError',message:secret}},{...unknown,errorFamilyHint:'aborted'}));
 check('serialized abort message hint',()=>diagnostic({message:'The operation was aborted.'},{...unknown,errorFamilyHint:'aborted'}));
 check('HTTP response error payload remains unknown without guessing',()=>diagnostic({error:{error:secret},message:secret,status:503,token:secret},unknown));
 check('nonboolean client is not accepted',()=>diagnostic({client:secret},unknown));
 check('unexpected auth failure remains error code only',()=>{logger.error('JWT_SESSION_ERROR',{error:new Error(secret)});assert.deepEqual(logs,[{level:'error',args:['[next-auth][error][JWT_SESSION_ERROR]']}]);});
 check('declined Google authorization retains identity-matched warnings',()=>{const error={message:'access_denied'};logger.error('OAUTH_CALLBACK_HANDLER_ERROR',{providerId:'google',error});logger.error('OAUTH_CALLBACK_ERROR',error);assert.equal(logs.length,2);assert(logs.every(x=>x.level==='warn'));logger.error('OAUTH_CALLBACK_ERROR',error);assert.equal(logs[2].level,'error');});
 check('unrelated same-text OAuth error is not downgraded',()=>{logger.error('OAUTH_CALLBACK_ERROR',{message:'access_denied'});assert.equal(logs[0].level,'error');});
 check('Google error description keeps unexpected error visible',()=>{logger.error('OAUTH_CALLBACK_HANDLER_ERROR',{providerId:'google',error:{message:'access_denied'},error_description:secret});assert.equal(logs[0].level,'error');});
}finally{console.error=original.error;console.warn=original.warn;}
const report={checkedAt:new Date().toISOString(),candidateSha256:crypto.createHash('sha256').update(src).digest('hex'),groups:results,allPassed:true,productionApplied:false,rootCauseFixed:false,outputScope:'fixed endpoint label, fixed error-family hint, boolean client only; no raw URL/query/message/stack/provider payload',syntheticOnly:true};
if(process.env.DOYA_AUTH_DIAGNOSTIC_RESULT)fs.writeFileSync(process.env.DOYA_AUTH_DIAGNOSTIC_RESULT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({groups:results.length,allPassed:true,productionApplied:false,rootCauseFixed:false}));
