const assert = require('node:assert/strict');
const {load} = require('./load-typescript.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const timers = new Map(); let sequence = 0, created = 0;
  const {findInterviewUploadAttempt:find} = load('src/lib/interview/upload-attempt.ts', {}, {
    AbortController, setTimeout: (fn, ms) => { assert.equal(ms,35000); timers.set(++sequence,fn); return sequence; },
    clearTimeout: id => timers.delete(id),
  });
  const attempts = new Map(), signal = new AbortController();
  const get = file => find(file,attempts,() => ({key: ++created}),signal.signal);
  return {get, find, attempts, signal, timers, created: () => created};
}
function file(bytes, options={}) { return new File([bytes],options.name || 'same.pdf',{type:'application/pdf',lastModified:1}); }
function tracedFile(bytes, behavior) {
  const calls=[];
  return {name:'same.pdf',size:bytes.length,type:'application/pdf',lastModified:1,calls,
    slice(start,end) { calls.push([start,end]); assert.ok(end-start<=1024*1024); return {arrayBuffer:async()=>behavior ? behavior(start,end) : bytes.slice(start,end).buffer}; },
  };
}
(async()=>{
  let passed=0;
  const retry=fixture(),original=file('AAAA'),record=retry.get(original);
  assert.equal(retry.get(original),record); assert.equal(await retry.get(file('AAAA')),record); assert.equal(retry.created(),1); assert.equal(retry.timers.size,0); passed++;
  const different=await retry.get(file('BBBB')); assert.notEqual(different,record); assert.equal(retry.created(),2); assert.equal(retry.attempts.size,2); passed++;
  const simultaneous=fixture(); simultaneous.get(file('AAAA'));
  const [a,b,c]=await Promise.all([simultaneous.get(file('BBBB')),simultaneous.get(file('BBBB')),simultaneous.get(file('AAAA'))]);
  assert.equal(a,b);assert.notEqual(a,c);assert.equal(simultaneous.created(),2);assert.equal(simultaneous.timers.size,0);passed++;
  const large=fixture(),bytes=new Uint8Array(2*1024*1024+13),left=tracedFile(bytes),right=tracedFile(bytes);
  const largeRecord=large.get(left);assert.equal(await large.get(right),largeRecord);assert.equal(left.calls.length,3);assert.equal(right.calls.length,3);assert.equal(large.timers.size,0);passed++;
  const otherBytes=bytes.slice();otherBytes[otherBytes.length-1]=1;
  assert.notEqual(await large.get(tracedFile(otherBytes)),largeRecord);assert.equal(large.created(),2);passed++;
  const empty=fixture();assert.equal(await empty.get(file('')),await empty.get(file('')));assert.equal(empty.timers.size,0);passed++;
  const cancelled=fixture();cancelled.get(file('AAAA'));let slow=true;
  const pendingFile=tracedFile(new Uint8Array([65,65,65,65]),()=>slow?new Promise(()=>{}):Promise.resolve(new Uint8Array([65,65,65,65]).buffer));
  const pending=cancelled.get(pendingFile),failure=assert.rejects(pending,/cancelled/);await tick();assert.ok(cancelled.timers.size);cancelled.signal.abort();await failure;await tick();assert.equal(cancelled.timers.size,0);assert.equal(cancelled.created(),1);passed++;
  const timed=fixture();timed.get(file('AAAA'));const timeoutFile=tracedFile(new Uint8Array([65,65,65,65]),()=>new Promise(()=>{}));
  const deadline=timed.get(timeoutFile),deadlineCheck=assert.rejects(deadline,/timed out/);await tick();for(const expire of [...timed.timers.values()])expire();await deadlineCheck;await tick();assert.equal(timed.timers.size,0);assert.equal(timed.created(),1);passed++;
  const failed=fixture();failed.get(file('AAAA'));let broken=true;
  const brokenFile=tracedFile(new Uint8Array([65,65,65,65]),()=>broken?Promise.reject(Error('synthetic read error')):Promise.resolve(new Uint8Array([65,65,65,65]).buffer));
  await assert.rejects(failed.get(brokenFile),/synthetic/);await tick();assert.equal(failed.timers.size,0);broken=false;assert.equal((await failed.get(brokenFile)).key,1);assert.equal(failed.created(),1);passed++;
  const stale=fixture();stale.signal.abort();assert.throws(()=>stale.get(file('AAAA')),/cancelled/);assert.equal(stale.created(),0);passed++;
  const scopes=fixture(),input=file('AAAA'),first=scopes.get(input),second=scopes.find(input,new Map(),()=>({key:'other-context'}),new AbortController().signal);assert.notEqual(first,second);passed++;
  console.log(JSON.stringify({passed,scope:'Actual content-aware upload attempt registry, native Files, bounded synthetic slice reads and clock/abort. Same-object/reselected equality, differing last chunk, simultaneous comparison, separate contexts, read failure/retry, timeout and abort. No server/provider/storage requests.'}));
})().catch(e=>{console.error(e);process.exitCode=1});
