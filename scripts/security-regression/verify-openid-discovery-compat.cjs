'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),patchFile=path.join(root,'scripts/dependency-patches/openid-discovery-url.cjs'),patch=require(patchFile);
const output=process.env.DOYA_AUTH_COMPAT_EVIDENCE_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'doya-auth-compat-evidence-'));
fs.mkdirSync(output,{recursive:true,mode:0o700});
const privateRoot=fs.mkdtempSync(path.join(os.tmpdir(),'doya-auth-discovery-'));fs.chmodSync(privateRoot,0o700);
const env=Object.fromEntries(['PATH','HOME','USER','LANG','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let completed=false,failedStage='installed source',results={};
function child(name,file,args){const r=spawnSync(process.execPath,['--trace-deprecation',file,...args],{cwd:root,env,encoding:'utf8',maxBuffer:8000000,timeout:60000});fs.writeFileSync(path.join(output,name+'.stdout.log'),r.stdout||'');fs.writeFileSync(path.join(output,name+'.stderr.log'),r.stderr||'');assert.equal(r.status,0,name+' child did not pass');return r}
try {
 const entry=require.resolve('openid-client',{paths:[root]}),installed=path.dirname(path.dirname(entry)),installedIssuer=path.join(installed,'lib/issuer.js'),before=sha(installedIssuer);
 const allowOriginal=process.argv.includes('--allow-unpatched-fixture-install');
 assert.equal(before,allowOriginal?patch.ORIGINAL_SHA:patch.PATCHED_SHA,'install hook must apply the pinned patch in normal CI/build use');
 const control=path.join(privateRoot,'control-openid'),changed=path.join(privateRoot,'patched-openid');
 fs.cpSync(installed,control,{recursive:true});
 const controlIssuer=path.join(control,'lib/issuer.js');
 if(before===patch.PATCHED_SHA){const s=fs.readFileSync(controlIssuer,'utf8');fs.writeFileSync(controlIssuer,s.replace(patch.PATCHED_FUNCTION,patch.ORIGINAL_FUNCTION))}
 assert.equal(sha(controlIssuer),patch.ORIGINAL_SHA);
 fs.cpSync(control,changed,{recursive:true});
 fs.symlinkSync(path.join(root,'node_modules'),path.join(privateRoot,'node_modules'));
 const linked=path.join(privateRoot,'linked-project');fs.mkdirSync(linked);fs.symlinkSync(path.join(root,'node_modules'),path.join(linked,'node_modules'));
 failedStage='patch guards';
 child('patch-guards',path.join(root,'scripts/security-regression/verify-openid-discovery-patch-guards.cjs'),[patchFile,changed,linked,path.join(output,'patch-guard-results.json')]);
 results.guards=JSON.parse(fs.readFileSync(path.join(output,'patch-guard-results.json'),'utf8'));assert(results.guards.completed&&results.guards.count===8);
 failedStage='owned install CLI';
 const owned=path.join(privateRoot,'owned-project');fs.mkdirSync(path.join(owned,'node_modules'),{recursive:true});fs.cpSync(control,path.join(owned,'node_modules/openid-client'),{recursive:true});
 fs.mkdirSync(path.join(owned,'scripts/dependency-patches'),{recursive:true});const ownedPatch=path.join(owned,'scripts/dependency-patches/openid-discovery-url.cjs');fs.copyFileSync(patchFile,ownedPatch);
 const first=JSON.parse(child('install-first',ownedPatch,[]).stdout),second=JSON.parse(child('install-repeat',ownedPatch,[]).stdout);
 assert.equal(first.status,'patched');assert.equal(second.status,'already_patched');assert.equal(sha(path.join(owned,'node_modules/openid-client/lib/issuer.js')),patch.PATCHED_SHA);results.ownedInstallCli={first:first.status,repeat:second.status,sourceSha256:patch.PATCHED_SHA};
 failedStage='actual OIDC protocol';
 const worker=path.join(root,'scripts/security-regression/verify-openid-discovery-protocol-worker.cjs');
 child('original-protocol',worker,[root,control,path.join(output,'original-protocol-results.json'),'original']);
 child('patched-protocol',worker,[root,changed,path.join(output,'patched-protocol-results.json'),'patched']);
 const original=JSON.parse(fs.readFileSync(path.join(output,'original-protocol-results.json'),'utf8')),patched=JSON.parse(fs.readFileSync(path.join(output,'patched-protocol-results.json'),'utf8'));
 assert(original.completed&&patched.completed);assert.equal(original.count,18);assert.equal(patched.count,18);assert.deepEqual(original.uriOutputs,patched.uriOutputs);assert.deepEqual(original.rows,patched.rows);assert.deepEqual(original.requests,patched.requests);
 assert.equal(original.sourceSha256,patch.ORIGINAL_SHA);assert.equal(patched.sourceSha256,patch.PATCHED_SHA);assert.equal(original.warnings.filter(w=>w.code==='DEP0169'&&w.issuerFrame).length,1);assert.equal(patched.warnings.filter(w=>w.code==='DEP0169').length,0);
 assert.equal(sha(installedIssuer),before,'installed/shared dependency must not be changed by regression fixtures');
 results.protocol={casesPerVariant:18,variants:2,uriVectors:12,httpBoundaryRequestsEqual:true,securityOutcomesEqual:true,originalWarningCount:1,patchedWarningCount:0};
 results.install={sourceSha256:before,installWasPatched:before===patch.PATCHED_SHA,explicitUnpatchedFixtureMode:allowOriginal,installedSourceUnchanged:true};
 completed=true;failedStage=null;
} finally {
 const sourceFiles=['scripts/dependency-patches/openid-discovery-url.cjs','scripts/security-regression/verify-openid-discovery-compat.cjs','scripts/security-regression/verify-openid-discovery-patch-guards.cjs','scripts/security-regression/verify-openid-discovery-protocol-worker.cjs','src/lib/auth.ts','package.json','package-lock.json'];
 const sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,sha(path.join(root,f))]));
 const report={checkedAt:new Date().toISOString(),completed,failedStage,...results,sourceHashes,privateFixtureRoot:privateRoot,credentialsInherited:false,realExternalNetworkRequests:0,realOAuthLogins:0,realNotifications:0,productionChanges:0,scope:'Version/source-pinned install patch, unchanged control and patched actual SDK/NextAuth client, synthetic transport/JWT/JWKS. Application session DB and real provider/login are not accepted.'};
 fs.writeFileSync(path.join(output,'openid-discovery-compat-results.json'),JSON.stringify(report,null,2)+'\n');
}
assert(completed);console.log(JSON.stringify({completed,patchGuardCases:8,ownedInstallCliPasses:2,protocolCasesPerVariant:18,uriVectors:12,warningBefore:1,warningAfter:0,installedPatchRequiredByDefault:true}));
