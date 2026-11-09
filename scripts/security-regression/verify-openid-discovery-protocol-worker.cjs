'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{EventEmitter}=require('node:events'),{Readable}=require('node:stream'),Module=require('node:module');
const root=process.argv[2],sdkRoot=process.argv[3],out=process.argv[4],label=process.argv[5];
const metadata={issuer:'https://accounts.google.com',authorization_endpoint:'https://accounts.google.com/o/oauth2/v2/auth',token_endpoint:'https://oauth2.googleapis.com/token',userinfo_endpoint:'https://openidconnect.googleapis.com/v1/userinfo',jwks_uri:'https://www.googleapis.com/oauth2/v3/certs',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_post','client_secret_basic'],code_challenge_methods_supported:['plain','S256'],authorization_response_iss_parameter_supported:true};
const clientId='synthetic-client',clientSecret='synthetic-client-secret',redirect='https://app.example.invalid/api/auth/callback/google',verifier='v'.repeat(64),state='synthetic-state',nonce='synthetic-nonce';
let matrixPhase=true,mode='valid',warnings=[],records=[],rows=[],completed=false,failedCase=null,publicJwk,privateKey,otherKey;
const jose=require(root+'/node_modules/jose');
process.on('warning',w=>warnings.push({code:w.code,name:w.name,issuerFrame:/\/lib\/issuer\.js:/.test(w.stack||'')}));
async function responseFor(url,options,body){
  const u=new URL(url),form=new URLSearchParams(body);
  if(!matrixPhase)assert(['https://accounts.google.com/.well-known/openid-configuration',metadata.token_endpoint,metadata.jwks_uri].includes(u.href),'Unexpected OIDC HTTP target');
  let value,status=200;
  if(u.href===metadata.token_endpoint){
    assert.equal(form.get('grant_type'),'authorization_code');assert.equal(form.get('redirect_uri'),redirect);assert.equal(form.get('code'),'synthetic-code');
    const authorization=String(options.headers.Authorization||options.headers.authorization);assert(authorization.startsWith('Basic '));assert.equal(Buffer.from(authorization.slice(6),'base64').toString(),clientId+':'+clientSecret);
    if(mode==='token-error'||form.get('code_verifier')!==verifier){value={error:'invalid_grant'};status=400}
    else{
      const now=Math.floor(Date.now()/1000),claims={sub:'synthetic-person',email:'synthetic@example.invalid',email_verified:true,name:'Synthetic Account'};
      if(mode==='nonce-valid'||mode==='nonce-invalid')claims.nonce=mode==='nonce-valid'?nonce:'wrong-nonce';
      const token=await new jose.SignJWT(claims).setProtectedHeader({alg:'RS256',kid:'synthetic-key'})
       .setIssuer(mode==='issuer-invalid'?'https://untrusted.example.invalid':metadata.issuer)
       .setAudience(mode==='audience-invalid'?'other-client':clientId).setIssuedAt(now)
       .setExpirationTime(mode==='expired'?now-3600:now+3600).sign(mode==='signature-invalid'?otherKey:privateKey);
      value={access_token:'synthetic-access-token',token_type:'Bearer',expires_in:3600,id_token:token};
    }
  }else if(u.href===metadata.jwks_uri)value={keys:[publicJwk]};
  else value=metadata;
  const stream=Readable.from([Buffer.from(JSON.stringify(value))]);stream.statusCode=status;stream.statusMessage=status===200?'OK':'Bad Request';stream.headers={'content-type':'application/json'};
  records.push({url:u.href,method:options.method||'GET',status,formKeys:[...form.keys()].sort(),pkcePresent:form.has('code_verifier')});
  return stream;
}
function fakeRequest(url,options={}){
  const request=new EventEmitter(),chunks=[],headers={...options.headers};request.removeHeader=n=>{delete headers[n]};request.setHeader=(n,v)=>{headers[n]=v};request.write=b=>chunks.push(Buffer.from(b));request.destroy=()=>{};
  request.end=()=>{setImmediate(async()=>{try{const body=Buffer.concat(chunks).toString();request.emit('response',await responseFor(url,{...options,headers},body))}catch(e){request.emit('error',e)}})};
  return request;
}
for(const name of ['node:http','node:https']){const mod=require(name);mod.request=fakeRequest;mod.get=()=>{throw Error('Unexpected transport GET bypass')}}
async function test(name,fn){failedCase=name;await fn();rows.push({name,passed:true})}
(async()=>{try{
  ({privateKey}=await jose.generateKeyPair('RS256'));({privateKey:otherKey}=await jose.generateKeyPair('RS256'));publicJwk={...await jose.exportJWK(await crypto.createPublicKey(privateKey)),kid:'synthetic-key',alg:'RS256',use:'sig'};
  const sdk=require(sdkRoot);
  const matrix=[
    'https://accounts.google.com/.well-known/openid-configuration','https://accounts.google.com','https://accounts.google.com/',
    'https://issuer.example.invalid/tenant','https://issuer.example.invalid/tenant/',
    'https://issuer.example.invalid/tenant?x=1#fragment','https://issuer.example.invalid/.well-known/openid-configuration?x=1',
    'HTTPS://ISSUER.EXAMPLE.INVALID/tenant','https://issuer.example.invalid/a%20b','https://issuer.example.invalid/日本語',
    'https://例え.invalid/tenant','https://issuer.example.invalid:443/base',
  ];const uriOutputs=[];
  await test('twelve discovery URI requests use the actual dependency',async()=>{for(const input of matrix){const before=records.length;await sdk.Issuer.discover(input);assert.equal(records.length,before+1);uriOutputs.push({input,request:records.at(-1).url})}});
  await test('the configured Google well-known request remains exact',async()=>{assert.equal(uriOutputs[0].request,'https://accounts.google.com/.well-known/openid-configuration')});
  await test('relative and unsupported URI schemes cannot send HTTP',async()=>{for(const input of ['', '/relative','file:///tmp/example','mailto:fixture@example.invalid','https://[bad']){const before=records.length;await assert.rejects(()=>sdk.Issuer.discover(input));assert.equal(records.length,before)}});
  matrixPhase=false;
  const originalLoad=Module._load;
  Module._load=function(request,parent,isMain){if(request==='openid-client')return sdk;return originalLoad.call(this,request,parent,isMain)};
  let createClient;try{createClient=require(root+'/node_modules/next-auth/core/lib/oauth/client.js').openidClient}finally{Module._load=originalLoad}
  const Google=require(root+'/node_modules/next-auth/providers/google.js').default;
  const base=Google({clientId,clientSecret}),provider={...base,...base.options,callbackUrl:redirect};
  let client;
  await test('actual NextAuth client initialization preserves Google metadata',async()=>{client=await createClient({provider});assert.equal(client.issuer.issuer,metadata.issuer);assert.equal(client.client_id,clientId)});
  const challenge=sdk.generators.codeChallenge(verifier);
  await test('authorization URL retains state PKCE scope and redirect',async()=>{const u=new URL(client.authorizationUrl({scope:'openid email profile',state,code_challenge:challenge,code_challenge_method:'S256'}));assert.equal(u.origin+u.pathname,metadata.authorization_endpoint);assert.equal(u.searchParams.get('state'),state);assert.equal(u.searchParams.get('code_challenge'),challenge);assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('scope'),'openid email profile');assert.equal(u.searchParams.get('redirect_uri'),redirect)});
  const invoke=(extra={})=>client.callback(redirect,{code:'synthetic-code',state,iss:metadata.issuer,...extra.params},{state,code_verifier:verifier,...extra.checks});
  await test('actual token and JWKS processing accepts a correctly signed code flow',async()=>{mode='valid';const tokens=await invoke();assert.equal(tokens.claims().sub,'synthetic-person');assert.equal(tokens.claims().iss,metadata.issuer);assert.equal(tokens.claims().aud,clientId)});
  await test('incorrect state is rejected before token exchange',async()=>{const n=records.filter(r=>r.url===metadata.token_endpoint).length;await assert.rejects(()=>invoke({params:{state:'wrong-state'}}),/state mismatch/);assert.equal(records.filter(r=>r.url===metadata.token_endpoint).length,n)});
  await test('missing state is rejected before token exchange',async()=>{const n=records.filter(r=>r.url===metadata.token_endpoint).length;await assert.rejects(()=>invoke({params:{state:undefined}}));assert.equal(records.filter(r=>r.url===metadata.token_endpoint).length,n)});
  await test('incorrect authorization response issuer is rejected before token exchange',async()=>{const n=records.filter(r=>r.url===metadata.token_endpoint).length;await assert.rejects(()=>invoke({params:{iss:'https://untrusted.example.invalid'}}),/iss mismatch/);assert.equal(records.filter(r=>r.url===metadata.token_endpoint).length,n)});
  await test('missing authorization response issuer is rejected when advertised',async()=>{const n=records.filter(r=>r.url===metadata.token_endpoint).length;await assert.rejects(()=>invoke({params:{iss:undefined}}),/iss missing/);assert.equal(records.filter(r=>r.url===metadata.token_endpoint).length,n)});
  await test('incorrect PKCE verifier cannot redeem the code',async()=>{mode='valid';await assert.rejects(()=>invoke({checks:{code_verifier:'wrong-verifier'}}))});
  for(const value of ['issuer-invalid','audience-invalid','expired','signature-invalid','token-error']){
    await test(value+' remains rejected by upstream protocol checks',async()=>{mode=value;await assert.rejects(()=>invoke())});
  }
  await test('requested nonce is preserved and verified',async()=>{mode='nonce-valid';assert.equal((await invoke({checks:{nonce}})).claims().nonce,nonce);mode='nonce-invalid';await assert.rejects(()=>invoke({checks:{nonce}}),/nonce mismatch/)});
  await new Promise(setImmediate);
  const relevant=warnings.filter(w=>w.code==='DEP0169'&&w.issuerFrame);
  await test('discovery warning outcome matches the chosen source',async()=>{if(label==='patched')assert.equal(relevant.length,0);else assert(relevant.length>0)});
  completed=true;failedCase=null;
  const report={checkedAt:new Date().toISOString(),label,completed,failedCase,count:rows.length,rows,uriOutputs,warnings,requests:records,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(sdkRoot,'lib/issuer.js'))).digest('hex'),actualNextAuthClient:true,actualOidcCryptoAndClaims:true,syntheticDiscoveryAndTokensAndJwks:true,httpTransportEntirelyIntercepted:true,realExternalNetworkRequests:0,realOAuthLogins:0,realNotifications:0,productionChanges:0,scope:'Actual dependency and NextAuth client with synthetic HTTP boundary and locally signed fixture tokens. App database/session, real OAuth/provider and production are not accepted.'};
  fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({completed,count:rows.length,warningCount:relevant.length,label}));
}catch(e){fs.writeFileSync(out,JSON.stringify({checkedAt:new Date().toISOString(),label,completed:false,failedCase,count:rows.length,rows,warnings,realExternalNetworkRequests:0,realNotifications:0,errorName:e.name,errorMessage:e.message},null,2)+'\n');throw e}})().catch(e=>{console.error(e.message);process.exitCode=1});
