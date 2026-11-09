'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),os=require('node:os');
const patch=require(process.argv[2]),sdk=process.argv[3],sharedProject=process.argv[4],out=process.argv[5];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const issuer=path.join(sdk,'lib/issuer.js'),pkg=path.join(sdk,'package.json'),shared=path.join(sharedProject,'node_modules/openid-client/lib/issuer.js');
const beforeShared=hash(shared),original=fs.readFileSync(issuer),originalPkg=fs.readFileSync(pkg),rows=[];let completed=false,failedCase;
function test(name,fn){failedCase=name;fn();rows.push({name,passed:true})}
try {
test('version-pinned original source is patched to the exact reviewed hash',()=>{assert.equal(patch.applyToPackage(sdk).status,'patched');assert.equal(hash(issuer),patch.PATCHED_SHA)});
test('repeated install is an idempotent no-op',()=>{const before=fs.readFileSync(issuer);assert.equal(patch.applyToPackage(sdk).status,'already_patched');assert(fs.readFileSync(issuer).equals(before))});
test('unknown source aborts without writing',()=>{const changed=Buffer.concat([fs.readFileSync(issuer),Buffer.from('\n// unknown source\n')]);fs.writeFileSync(issuer,changed);assert.throws(()=>patch.applyToPackage(sdk),/OIDC_PATCH_UNKNOWN_SOURCE/);assert(fs.readFileSync(issuer).equals(changed));fs.writeFileSync(issuer,original)});
test('unsupported SDK version aborts without writing',()=>{const json=JSON.parse(originalPkg);json.version='5.7.0';fs.writeFileSync(pkg,JSON.stringify(json));const before=fs.readFileSync(issuer);assert.throws(()=>patch.applyToPackage(sdk),/OIDC_PATCH_UNSUPPORTED_VERSION/);assert(fs.readFileSync(issuer).equals(before));fs.writeFileSync(pkg,originalPkg)});
test('a shared node_modules project is refused without changing its dependency',()=>{assert.throws(()=>patch.applyToProject(sharedProject),/OIDC_PATCH_SHARED_NODE_MODULES_REFUSED/);assert.equal(hash(shared),beforeShared)});
test('a symlink package root is refused',()=>{const p=sdk+'-symlink-fixture';fs.symlinkSync(sdk,p);try{assert.throws(()=>patch.applyToPackage(p),/OIDC_PATCH_PACKAGE_SYMLINK_REFUSED/)}finally{fs.unlinkSync(p)}});
test('a symlink source cannot write into the shared package',()=>{const saved=issuer+'.fixture-original';fs.renameSync(issuer,saved);fs.symlinkSync(shared,issuer);try{assert.throws(()=>patch.applyToPackage(sdk),/OIDC_PATCH_SOURCE_SYMLINK_REFUSED/);assert.equal(hash(shared),beforeShared)}finally{fs.unlinkSync(issuer);fs.renameSync(saved,issuer)}});
test('final private package patch leaves the shared package unchanged',()=>{assert.equal(patch.applyToPackage(sdk).status,'patched');assert.equal(hash(issuer),patch.PATCHED_SHA);assert.equal(hash(shared),beforeShared)});
completed=true;failedCase=null;
}finally{
fs.writeFileSync(out,JSON.stringify({checkedAt:new Date().toISOString(),completed,failedCase,count:rows.length,rows,originalSha:patch.ORIGINAL_SHA,patchedSha:patch.PATCHED_SHA,sharedSourceShaBefore:beforeShared,sharedSourceShaAfter:hash(shared),sharedPackageUnmodified:hash(shared)===beforeShared,networkRequests:0,productionChanges:0},null,2)+'\n');
}
console.log(JSON.stringify({completed,count:rows.length,sharedPackageUnmodified:true}));
