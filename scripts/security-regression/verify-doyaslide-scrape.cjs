// Offline URL extraction contract tests using the shared pinned transport.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const repo=path.resolve(__dirname,'../..'),ts=require('typescript'),cheerio=require('cheerio');
const compiled=ts.transpileModule(fs.readFileSync(path.join(repo,'src/lib/doyaslide/scrape.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function harness(resource){const exports={},calls=[];vm.runInNewContext(compiled,{exports,require(name){if(name==='cheerio')return cheerio;if(name==='@/lib/net/safe-fetch')return{safeFetchResource:async(url,opts)=>{calls.push({url,opts});return resource;}};throw Error('unexpected dependency '+name);},fetch(){throw Error('UNPINNED NETWORK');}});return{...exports,calls};}
(async()=>{
 await test('shared resource final URL and content retained',async()=>{const x=harness({body:Buffer.from('<title>Title</title><meta name="description" content="Description"><body>Hello<script>secret</script></body>'),contentType:'text/html',url:'https://example.test/final'});const out=await x.scrapeUrlText('https://example.test/start');assert.equal(out.title,'Title');assert.equal(out.description,'Description');assert.equal(out.text,'Hello');assert.equal(out.url,'https://example.test/final');assert.equal(x.calls[0].opts.maxRedirects,5);});
 await test('shared transport denial throws fixed message',async()=>{const x=harness(null);await assert.rejects(()=>x.scrapeUrlText('http://127.0.0.1'),/URLを安全に取得/);});
 await test('binary content rejected',async()=>{const x=harness({body:Buffer.alloc(0),contentType:'image/png',url:'https://example.test'});await assert.rejects(()=>x.scrapeUrlText('https://example.test'),/HTMLページ/);});
 await test('text output remains bounded',async()=>{const x=harness({body:Buffer.from('<body>'+'A'.repeat(20000)+'</body>'),contentType:'text/html',url:'https://example.test'});assert.equal((await x.scrapeUrlText('https://example.test')).text.length,12000);});
 console.log(JSON.stringify({passed,failed:0,networkRequests:0}));
})().catch(e=>{console.error(e);process.exitCode=1});
