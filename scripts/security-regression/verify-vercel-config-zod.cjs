const path=require('node:path'),fs=require('node:fs'),os=require('node:os'),assert=require('node:assert/strict');
const lib=require('@vercel/cli-config');const results=[];
function test(name,fn){fn();results.push(name)}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'doya-cli-synthetic-'));
try{
test('valid global configuration and unknown fields preserved',()=>{const value={currentTeam:'team_synthetic',credStorage:'file',telemetry:{enabled:false,futureOption:1},futureOption:'kept'};assert.deepEqual(lib.parseGlobalConfig(value),value)});
test('all supported storage modes parse',()=>{for(const credStorage of ['auto','file','keyring'])assert.equal(lib.parseGlobalConfig({credStorage}).credStorage,credStorage)});
test('invalid storage mode rejected',()=>assert.throws(()=>lib.parseGlobalConfig({credStorage:'invalid'})));
test('invalid nested boolean rejected',()=>assert.throws(()=>lib.parseGlobalConfig({telemetry:{enabled:'false'}})));
test('synthetic authentication fields preserve types',()=>{const value={token:'SYNTHETIC_NOT_A_REAL_TOKEN',expiresAt:123,userId:'synthetic',cachedUser:{id:'synthetic',username:'fixture'},futureOption:1};assert.deepEqual(lib.parseAuthConfig(value),value)});
test('invalid authentication types rejected',()=>{for(const value of [{token:123},{expiresAt:'123'},{cachedUser:{id:'fixture'}}])assert.throws(()=>lib.parseAuthConfig(value))});
test('explicit temporary config path roundtrips',()=>{const file=path.join(dir,'fixture.json'),value={currentTeam:'team_fixture',updates:{auto:false},futureOption:2};lib.writeGlobalConfigFile(file,value);assert.deepEqual(lib.readGlobalConfigFile(file),value)});
test('malformed JSON config rejected',()=>{const file=path.join(dir,'malformed.json');fs.writeFileSync(file,'{');assert.throws(()=>lib.readGlobalConfigFile(file))});
test('schema violation from file rejected',()=>{const file=path.join(dir,'wrong.json');fs.writeFileSync(file,JSON.stringify({currentTeam:12}));assert.throws(()=>lib.readGlobalConfigFile(file))});
console.log(JSON.stringify({passed:results.length,results,scope:'Synthetic in-memory and explicit temporary files only. No real auth files, credentials, account, network or provider calls.'},null,2));
}finally{fs.rmSync(dir,{recursive:true,force:true})}
