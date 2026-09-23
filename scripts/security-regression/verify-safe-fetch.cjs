// Offline security regression: no DNS, HTTP, production or paid API requests.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const repo = resolve(__dirname, '../..');
const requireRepo = createRequire(repo + '/package.json');
const ts = requireRepo('typescript');
const source = fs.readFileSync(repo + '/src/lib/net/safe-fetch.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
let count = 0;
async function test(name, run) { await run(); count++; console.log('PASS ' + name); }
function harness({ lookup, fetcher } = {}) {
  const calls = [], agents = [], dnsCalls = [], failures = [];
  class Agent {
    constructor(options) { this.options = options; this.destroyed = false; agents.push(this); }
    async destroy() { this.destroyed = true; }
  }
  const exports = {};
  const context = { exports, URL, AbortController, setTimeout, clearTimeout, Buffer,
    require(name) {
      if (name === 'dns/promises') return { async lookup(h, opts) { dnsCalls.push(h); return lookup ? lookup(h, opts) : [{address: '93.184.216.34', family: 4}]; } };
      if (name === 'undici') return { Agent, async fetch(url, options) { calls.push({url, options}); return fetcher ? fetcher(url, options) : new Response('<html>ok</html>', {headers: {'content-type': 'text/html'}}); } };
      if (name === 'net') return require('node:net');
      throw new Error('Unexpected dependency: '+name);
    },
    // Any attempt at unpinned global fetch is a test failure.
    fetch() { throw new Error('UNPINNED FETCH'); },
  };
  vm.runInNewContext(compiled, context);
  return { ...exports, calls, agents, dnsCalls, failures, options: { onFailure: f => failures.push(f) } };
}
function cancellableResponse({ status = 200, headers = {}, chunks = [], hang = false } = {}) {
  const state = { cancelled: false };
  const stream = new ReadableStream({
    start(controller) { for (const chunk of chunks) controller.enqueue(Buffer.from(chunk)); if (!hang) controller.close(); },
    cancel() { state.cancelled = true; }
  });
  return { response: new Response(stream, { status, headers }), state };
}
(async () => {
  const h = harness();
  for (const ip of ['127.0.0.1','10.1.2.3','172.31.255.255','192.168.1.1','169.254.169.254','100.100.100.200','0.1.2.3','224.0.0.1','255.255.255.255','192.0.0.1','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','::1','0:0:0:0:0:0:0:1','::','::ffff:127.0.0.1','0:0:0:0:0:ffff:7f00:1','::ffff:7f00:1','::ffff:169.254.169.254','fc00::1','fd00::1','fe80::1','febf::1','fec0::1','ff02::1','::127.0.0.1','64:ff9b::7f00:1','2002:7f00:1::','2001::1','2001:db8::1','3fff::1','garbage','fe80::1%eth0'])
    await test('blocks '+ip, () => assert.equal(h.isPrivateIP(ip), true));
  for (const ip of ['93.184.216.34','8.8.8.8','1.1.1.1','2606:4700:4700::1111','2001:4860:4860::8888','::ffff:808:808'])
    await test('permits public '+ip, () => assert.equal(h.isPrivateIP(ip), false));
  for (const url of ['http://127.1','http://2130706433','http://0177.0.0.1','http://0x7f000001','http://[0:0:0:0:0:ffff:7f00:1]','http://localhost.','http://metadata.google.internal.','http://user:secret@example.test','file:///etc/passwd','javascript:alert(1)'])
    await test('rejects URL '+url.replace('user:secret','credentials'), async () => { const x=harness(); assert.equal(await x.safeFetchText(url,x.options), null); assert.equal(x.calls.length,0); assert.equal(x.failures[0].reason,'url_rejected'); });
  await test('mixed public/private DNS refuses all requests', async () => { const x=harness({lookup:async()=>[{address:'8.8.8.8'},{address:'::ffff:7f00:1'}]}); assert.equal(await x.safeFetchText('https://example.test',x.options),null);assert.equal(x.calls.length,0); });
  await test('invalid DNS answer fails closed', async()=> { const x=harness({lookup:async()=>[{address:'not-an-ip'}]}); assert.equal(await x.safeFetchText('https://example.test'),null); assert.equal(x.calls.length,0); });
  await test('pins all/single lookup variants and preserves TLS hostname', async()=> { const x=harness(); assert.equal(await x.safeFetchText('https://example.test/private?token=hidden',x.options),'<html>ok</html>'); assert.equal(x.calls[0].url,'https://example.test/private?token=hidden'); for (const all of [true,false]) x.agents[0].options.connect.lookup('example.test',{all},(err,address,family)=>{assert.equal(err,null); assert.equal(all?address[0].address:address,'93.184.216.34');assert.equal(all?address[0].family:family,4);}); assert.equal(x.agents[0].destroyed,true); });
  await test('public IPv6 literal supported without DNS',async()=> { const x=harness(); assert.equal(await x.safeFetchText('https://[2606:4700:4700::1111]/'),'<html>ok</html>');assert.equal(x.dnsCalls.length,0);x.agents[0].options.connect.lookup('x',{all:true},(_,a)=>assert.equal(a[0].family,6)); });
  await test('redirect to private IP rejected before second fetch',async()=> { const response=cancellableResponse({status:302,headers:{location:'http://127.0.0.1'},hang:true});const x=harness({fetcher:async()=>response.response});assert.equal(await x.safeFetchText('https://example.test',x.options),null);assert.equal(x.calls.length,1);assert.equal(response.state.cancelled,true);assert.equal(x.agents[0].destroyed,true); });
  await test('relative public redirect revalidates and cleans both hops',async()=> { let n=0;const x=harness({fetcher:async()=>++n===1?new Response(null,{status:302,headers:{location:'/next'}}):new Response('ok',{headers:{'content-type':'text/html'}})});assert.equal(await x.safeFetchText('https://example.test'), 'ok');assert.equal(x.dnsCalls.length,2);assert.equal(x.calls[1].url,'https://example.test/next');assert.ok(x.agents.every(a=>a.destroyed)); });
  await test('redirect limit bounded and each body cancelled',async()=> { const responses=[];const x=harness({fetcher:async()=>{const r=cancellableResponse({status:302,headers:{location:'/again'},hang:true});responses.push(r);return r.response;}});assert.equal(await x.safeFetchText('https://example.test',{...x.options,maxRedirects:1}),null);assert.equal(x.calls.length,2);assert.equal(x.failures[0].reason,'redirect');assert.ok(responses.every(r=>r.state.cancelled));assert.ok(x.agents.every(a=>a.destroyed)); });
  await test('header content length rejected before reading body',async()=>{const r=cancellableResponse({headers:{'content-length':'1000'},hang:true});const x=harness({fetcher:async()=>r.response});assert.equal(await x.safeFetchText('https://example.test',{...x.options,maxBytes:20}),null);assert.equal(x.failures[0].reason,'body');assert.ok(r.state.cancelled);assert.ok(x.agents[0].destroyed);});
  await test('chunked decompressed bytes enforce limit and cancel',async()=>{const r=cancellableResponse({chunks:['123456','789012'],hang:true});const x=harness({fetcher:async()=>r.response});assert.equal(await x.safeFetchText('https://example.test',{...x.options,maxBytes:10}),null);assert.equal(x.failures[0].reason,'body');assert.ok(r.state.cancelled);assert.ok(x.agents[0].destroyed);});
  await test('UTF8 byte cap and split character decode',async()=>{const bytes=Buffer.from('日本語');const x=harness({fetcher:async()=>new Response(new ReadableStream({start(c){c.enqueue(bytes.subarray(0,2));c.enqueue(bytes.subarray(2));c.close();}}))});assert.equal(await x.safeFetchText('https://example.test',{maxBytes:9}),'日本語');});
  await test('DNS timeout includes lookup and never connects later',async()=>{const x=harness({lookup:()=>new Promise(r=>setTimeout(()=>r([{address:'8.8.8.8'}]),50))});assert.equal(await x.safeFetchText('https://example.test',{...x.options,timeoutMs:10}),null);assert.equal(x.failures[0].reason,'timeout');await new Promise(r=>setTimeout(r,65));assert.equal(x.calls.length,0);});
  await test('response stall times out and destroys agent',async()=>{const r=cancellableResponse({hang:true});const x=harness({fetcher:async()=>r.response});assert.equal(await x.safeFetchText('https://example.test',{...x.options,timeoutMs:10}),null);assert.equal(x.failures[0].reason,'timeout');assert.ok(r.state.cancelled);assert.ok(x.agents[0].destroyed);});
  await test('redirects share one total timeout budget',async()=>{let n=0;const x=harness({fetcher:async(url,opts)=>{await new Promise(r=>setTimeout(r,8));if(opts.signal.aborted)throw opts.signal.reason; n++;return new Response(null,{status:302,headers:{location:'/again'}});}});assert.equal(await x.safeFetchText('https://example.test',{...x.options,maxRedirects:10,timeoutMs:20}),null);assert.equal(x.failures[0].reason,'timeout');assert.ok(n<4);assert.ok(x.agents.every(a=>a.destroyed));});
  for (const [status, headers, reason] of [[503,{},'http'],[200,{'content-type':'application/json'},'content_type']]) await test('cancel unread '+reason+' response',async()=>{const r=cancellableResponse({status,headers,hang:true});const x=harness({fetcher:async()=>r.response});assert.equal(await x.safeFetchText('https://example.test',x.options),null);assert.equal(x.failures[0].reason,reason);assert.ok(r.state.cancelled);assert.ok(x.agents[0].destroyed);});
  await test('explicit CSS accept retained',async()=>{const x=harness({fetcher:async()=>new Response('a{color:red}',{headers:{'content-type':'text/css'}})});assert.equal(await x.safeFetchText('https://example.test',{accept:'text/css,*/*'}),'a{color:red}');});
  await test('network failure returns null and cleans agent',async()=>{const x=harness({fetcher:async()=>{throw new Error('network secret');}});assert.equal(await x.safeFetchText('https://example.test?secret=hidden',x.options),null);assert.equal(JSON.stringify(x.failures),'[{"reason":"network"}]');assert.ok(x.agents[0].destroyed);});
  await test('diagnostic callback exceptions are swallowed',async()=>{const x=harness();assert.equal(await x.safeFetchText('http://127.1',{onFailure(){throw Error('diagnostic');}}),null);});
  await test('body stream errors clean agent',async()=>{const x=harness({fetcher:async()=>new Response(new ReadableStream({start(c){c.error(new Error('body secret'));}}))});assert.equal(await x.safeFetchText('https://example.test',x.options),null);assert.equal(x.failures[0].reason,'body');assert.ok(x.agents[0].destroyed);});
  await test('header wait abort preserves null contract',async()=>{const x=harness({fetcher:(url,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(opts.signal.reason),{once:true}))});assert.equal(await x.safeFetchText('https://example.test',{...x.options,timeoutMs:10}),null);assert.equal(x.failures[0].reason,'timeout');assert.ok(x.agents[0].destroyed);});
  await test('DNS failures classified without hostname',async()=>{const x=harness({lookup:async()=>{const e=new Error('private hostname');e.code='ENOTFOUND';throw e;}});assert.equal(await x.safeFetchText('https://example.test',x.options),null);assert.equal(JSON.stringify(x.failures),'[{"reason":"dns"}]');});
  await test('credential redirect blocked before next connection',async()=>{const x=harness({fetcher:async()=>new Response(null,{status:302,headers:{location:'https://user:secret@example.test'}})});assert.equal(await x.safeFetchText('https://example.test',x.options),null);assert.equal(x.calls.length,1);assert.equal(x.failures[0].reason,'url_rejected');});
  await test('binary resource preserves bytes and final URL',async()=>{let n=0;const x=harness({fetcher:async()=>++n===1?new Response(null,{status:302,headers:{location:'/final'}}):new Response(new Uint8Array([0,255,128]),{headers:{'content-type':'image/png'}})});const out=await x.safeFetchResource('https://example.test',{accept:'image/*'});assert.equal(out.body.toString('hex'),'00ff80');assert.equal(out.contentType,'image/png');assert.equal(out.url,'https://example.test/final');});
  await test('shared byte callback stops and cancels resource',async()=>{let bytes=0;const r=cancellableResponse({chunks:['12345','67890'],hang:true});const x=harness({fetcher:async()=>r.response});assert.equal(await x.safeFetchResource('https://example.test',{...x.options,onBytes(size){bytes+=size;return bytes<8;}}),null);assert.equal(x.failures[0].reason,'body');assert.ok(r.state.cancelled);});
  await test('parent abort ends stalled body and cleans agent',async()=>{const parent=new AbortController();const r=cancellableResponse({hang:true});const x=harness({fetcher:async()=>r.response});const pending=x.safeFetchText('https://example.test',{...x.options,signal:parent.signal});setTimeout(()=>parent.abort(),5);assert.equal(await pending,null);assert.equal(x.failures[0].reason,'timeout');assert.ok(x.agents[0].destroyed);});
  await test('already aborted parent never opens a connection',async()=>{const parent=new AbortController();parent.abort();const x=harness();assert.equal(await x.safeFetchText('https://example.test',{signal:parent.signal}),null);assert.equal(x.calls.length,0);});
  for (const method of ['HEAD','GET']) await test(method+' headers-only cancels oversized endless body',async()=>{const r=cancellableResponse({headers:{'content-length':'999999999','content-type':'application/pdf'},hang:true});const x=harness({fetcher:async()=>r.response});const out=await x.safeFetchResource('https://example.test',{method,headersOnly:true,accept:'*/*'});assert.equal(out.status,200);assert.equal(out.body.length,0);assert.equal(x.calls[0].options.method,method);assert.ok(r.state.cancelled);assert.ok(x.agents[0].destroyed);});
  await test('HEAD private redirect remains blocked',async()=>{const x=harness({fetcher:async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/'}})});assert.equal(await x.safeFetchResource('https://example.test',{method:'HEAD',headersOnly:true,accept:'*/*'}),null);assert.equal(x.calls.length,1);});
  console.log(JSON.stringify({passed:count,failed:0,networkRequests:0,scope:'mock DNS, dispatcher and HTTP streams; no production requests'}));
})().catch(error=>{console.error(error);process.exitCode=1;});
