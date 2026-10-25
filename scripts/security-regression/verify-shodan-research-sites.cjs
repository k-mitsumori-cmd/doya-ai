// 会社を調べる（shodan.research）の「サイトを読む」所を、本物に近い形で確かめる回帰テスト。
// 手元の HTTP サーバー（127.0.0.1）が、失敗するサイトのふりをして返す。safe-fetch と research は本物を動かす。
// DNS だけは偽物（公開 IP を返す）で、undici の fetch は手元のサーバーへ向け直す（元のホスト名はヘッダーで渡す）。
// 失敗のチェックリスト: docs/architecture/agent-orchestration/FAILURE-CHECKLIST.md S2〜S13・S21
// 外部への通信・AI・課金はなし。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http'),net=require('node:net');
const root=path.resolve(__dirname,'../..');const ts=require(path.join(root,'node_modules/typescript'));
const results=[];const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)};
function loadTs(file,mocks={}){const exports={};const module={exports};const out=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const req=n=>{if(n in mocks)return mocks[n];if(n==='net')return net;throw Error('Unmocked '+n)};
  vm.runInNewContext(out,{exports,module,require:req,URL,Request,Response,Headers,Buffer,Date,Set,Map,Error,Promise,Object,Array,Number,String,Math,JSON,Symbol,RegExp,AbortController,setTimeout,clearTimeout,TextEncoder,TextDecoder,ReadableStream,process:{env:{}},console:{log(){},warn(){},error(){}}},{filename:file});return module.exports}

const sjis=Buffer.from([0x8A,0x94,0x8E,0xAE,0x89,0xEF,0x8E,0xD0]); // 株式会社
assert.equal(new TextDecoder('shift_jis').decode(sjis),'株式会社');
const BODY='<p>'+'会社の紹介です。'.repeat(40)+'</p>';
const page=(title,extra='')=>`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${BODY}${extra}</body></html>`;
const jsOnly=`<!doctype html><html><head><meta charset="utf-8"><title>サンプル商事</title><meta name="description" content="サンプル商事は業務システムを作る会社です"><meta property="og:site_name" content="サンプル商事"><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"サンプル商事株式会社","telephone":"03-1234-5678","numberOfEmployees":{"value":120},"address":{"addressLocality":"東京都千代田区"}}</script></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;

// ホスト名ごとのふるまい（www. は外して引く）
const behaviors={
  ok:(req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(page('テスト商事'))},
  apexdns:(req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(page('テスト商事'))},
  slow:()=>{},
  forbidden:(req,res)=>{res.writeHead(403,{'content-type':'text/html'});res.end('no')},
  limited:(req,res)=>{res.writeHead(429,{'content-type':'text/html'});res.end('no')},
  sub404:(req,res)=>{if(req.url==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(page('テスト商事'))}else{res.writeHead(404,{'content-type':'text/html'});res.end('x')}},
  gone404:(req,res)=>{res.writeHead(404,{'content-type':'text/html'});res.end('x')},
  err500:(req,res)=>{res.writeHead(500,{'content-type':'text/html'});res.end('x')},
  loop:(req,res)=>{res.writeHead(302,{location:'https://loop.example.test/'});res.end()},
  pdf:(req,res)=>{res.writeHead(200,{'content-type':'application/pdf'});res.end(Buffer.from('%PDF-1.4'))},
  big:(req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(Buffer.alloc(3*1024*1024,0x61))},
  bigchunk:(req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});const c=Buffer.alloc(256*1024,0x61);let n=0;const t=setInterval(()=>{if(res.destroyed||n++>=16){clearInterval(t);res.end();return}res.write(c)},1)},
  sjishead:(req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=Shift_JIS'});res.end(Buffer.concat([Buffer.from('<html><head><title>'),sjis,Buffer.from('</title></head><body><p>'),sjis,Buffer.from('</p></body></html>')]))},
  sjismeta:(req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end(Buffer.concat([Buffer.from('<html><head><meta charset="shift_jis"><title>'),sjis,Buffer.from('</title></head><body><p>'),sjis,Buffer.from('</p></body></html>')]))},
  jsonly:(req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(jsOnly)},
  'prtimes.jp':(req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end('<html><body><a href="/main/html/rd/p/000000001.000000001.html">10\u0000時30分 新サービスを発表</a><span>2026年10月1日</span></body></html>')},
};
const server=http.createServer((req,res)=>{const h=String(req.headers['x-test-host']||'').replace(/^www\./,'');const key=h==='prtimes.jp'?h:h.split('.')[0];(behaviors[key]||((q,r)=>{r.writeHead(404);r.end()}))(req,res)});

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const port=server.address().port;
  const closed=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p))})});
  const log=[];
  const lookup=async(host)=>{log.push('dns:'+host);
    if(host.startsWith('nodns.')||host.startsWith('www.nodns.'))throw Object.assign(new Error('getaddrinfo ENOTFOUND '+host),{code:'ENOTFOUND'});
    if(host==='apexdns.example.test')throw Object.assign(new Error('getaddrinfo ENOTFOUND '+host),{code:'ENOTFOUND'});
    if(host.startsWith('private.'))return [{address:'10.0.0.5',family:4}];
    return [{address:'93.184.216.34',family:4}]};
  const fakeFetch=(url,init)=>{const u=new URL(url);log.push('fetch:'+u.hostname+u.pathname);
    const p=u.hostname.replace(/^www\./,'').startsWith('refused.')?closed:port;
    const {dispatcher,...rest}=init;
    return globalThis.fetch('http://127.0.0.1:'+p+u.pathname+u.search,{...rest,headers:{...rest.headers,'x-test-host':u.hostname}})};
  const safeFetch=loadTs('src/lib/net/safe-fetch.ts',{'dns/promises':{lookup},undici:{Agent:class{constructor(){}destroy(){return Promise.resolve()}},fetch:fakeFetch}});
  const scraped=[];
  const research=loadTs('src/lib/shodan/research.ts',{
    '@/lib/net/safe-fetch':safeFetch,
    '@/lib/doyalist/collect/web-scraper':{scrapeCompanyWebsite:async(url,html)=>{scraped.push({url,html});return null}},
    '@/lib/doyalist/collect/gbizinfo':{searchGbizInfo:async()=>({status:200,companies:[],totalCount:0})},
  });
  const run=async(host,p='/',opts={})=>{log.length=0;scraped.length=0;return research.researchCompany('https://'+host+p,{timeoutsMs:[300,600],...opts})};
  const failed=async(host,p)=>{const r=await run(host,p);assert.equal(r.diagnostics.homepage.ok,false);assert.equal(r.sourceStatus.homepage,'failed');return r};
  const msg=r=>research.researchFailureMessage(r.diagnostics);
  try{
    await check('正常: 読めるサイトは attempts 1・ok・本文は短くない',async()=>{const r=await run('ok.example.test');assert.equal(r.diagnostics.homepage.ok,true);assert.equal(r.diagnostics.attempts,1);assert.equal(r.diagnostics.jsRendered,false);assert.equal(r.sourceStatus.homepage,'ok')});
    await check('S2 ドメインが引けない: 理由 dns・www を付けて2回試す・文に「ドメインが引けません」',async()=>{const r=await failed('nodns.example.test');assert.equal(r.diagnostics.homepage.reason,'dns');assert.equal(r.diagnostics.attempts,2);assert.ok(log.includes('dns:www.nodns.example.test'));assert.ok(msg(r).includes('ドメインが引けません'))});
    await check('S2 apex は引けず www. なら読める: attempts 2・ok',async()=>{const r=await run('apexdns.example.test');assert.equal(r.diagnostics.homepage.ok,true);assert.equal(r.diagnostics.attempts,2);assert.equal(r.sourceStatus.homepage,'ok')});
    await check('S3 応答が返らない: 理由 timeout・attempts 2・文に「応答しませんでした」',async()=>{const r=await failed('slow.example.test');assert.equal(r.diagnostics.homepage.reason,'timeout');assert.equal(r.diagnostics.attempts,2);assert.ok(msg(r).includes('応答しませんでした'))});
    await check('S4 接続が拒まれる: 理由 network・www の付け外しで2回試す・文に「つながりませんでした」',async()=>{const r=await failed('refused.example.test');assert.equal(r.diagnostics.homepage.reason,'network');assert.equal(r.diagnostics.attempts,2);assert.ok(log.includes('fetch:www.refused.example.test/'));assert.ok(msg(r).includes('つながりませんでした'))});
    await check('S5 403 は断られた文・読み直さない',async()=>{const r=await failed('forbidden.example.test');assert.deepEqual([r.diagnostics.homepage.reason,r.diagnostics.homepage.status,r.diagnostics.attempts],['http',403,1]);assert.ok(msg(r).includes('断られました'))});
    await check('S5 429 も断られた文',async()=>{const r=await failed('limited.example.test');assert.equal(r.diagnostics.homepage.status,429);assert.ok(msg(r).includes('断られました'))});
    await check('S6 下のページが 404 でも / が 200 なら attempts 2 で ok',async()=>{const r=await run('sub404.example.test','/about');assert.equal(r.diagnostics.homepage.ok,true);assert.equal(r.diagnostics.attempts,2);assert.ok(log.includes('fetch:sub404.example.test/'))});
    await check('S6 / も 404 なら「ありませんでした」',async()=>{const r=await failed('gone404.example.test');assert.equal(r.diagnostics.homepage.status,404);assert.ok(msg(r).includes('ありませんでした'))});
    await check('S6 500 は相手の不具合の文',async()=>{const r=await failed('err500.example.test');assert.deepEqual([r.diagnostics.homepage.reason,r.diagnostics.homepage.status],['http',500]);assert.ok(msg(r).includes('エラーを返しました'))});
    await check('S7 転送の繰り返し: 理由 redirect・文に「転送が多すぎ」',async()=>{const r=await failed('loop.example.test');assert.equal(r.diagnostics.homepage.reason,'redirect');assert.ok(msg(r).includes('転送が多すぎ'))});
    await check('S8 PDF: 理由 content_type・文に「Web ページではありませんでした」',async()=>{const r=await failed('pdf.example.test');assert.equal(r.diagnostics.homepage.reason,'content_type');assert.ok(msg(r).includes('Web ページではありませんでした'))});
    await check('S9 2MiB を超える本文: 理由 body・文に「大きすぎて」',async()=>{const r=await failed('big.example.test');assert.equal(r.diagnostics.homepage.reason,'body');assert.ok(msg(r).includes('大きすぎて'))});
    await check('S9 長さ不明（分割送信）で 2MiB を超えても body',async()=>{const r=await failed('bigchunk.example.test');assert.equal(r.diagnostics.homepage.reason,'body')});
    await check('S10 解決先が社内の IP: 理由 url_rejected・文に「調べられません」',async()=>{const r=await failed('private.example.test');assert.equal(r.diagnostics.homepage.reason,'url_rejected');assert.ok(msg(r).includes('調べられません'))});
    await check('S11 Shift_JIS（Content-Type の charset）を正しく読む',async()=>{const r=await run('sjishead.example.test');assert.equal(r.diagnostics.homepage.ok,true);const h=scraped[0].html;assert.ok(h.includes('株式会社'));assert.ok(!h.includes('�'))});
    await check('S11 Shift_JIS（meta charset だけ）を正しく読む',async()=>{const r=await run('sjismeta.example.test');assert.equal(r.diagnostics.homepage.ok,true);const h=scraped[0].html;assert.ok(h.includes('株式会社'));assert.ok(!h.includes('�'))});
    await check('S12 JavaScript だけのサイト: 題・説明・JSON-LD を AI に渡す文へ足す',async()=>{const r=await run('jsonly.example.test');assert.equal(r.diagnostics.jsRendered,true);assert.equal(r.diagnostics.usedPageSummary,true);const h=scraped[0].html;assert.ok(h.includes('サンプル商事株式会社'));assert.ok(h.includes('03-1234-5678'));assert.ok(h.includes('東京都千代田区'));assert.ok(h.includes('120'));assert.equal(r.sourceStatus.homepage,'ok');assert.equal(r.diagnostics.aiExtracted,false);assert.equal(r.diagnostics.companyNameFrom,'title')});
    await check('S13 PR TIMES の題の NUL を取り除く（保存できる形で返る）',async()=>{const r=await run('ok.example.test');assert.ok(r.pressReleases.length>=1);assert.ok(r.pressReleases[0].title.includes('時30分'));assert.ok(!r.pressReleases[0].title.includes('\u0000'));assert.ok(!JSON.stringify(r).includes('\\u0000'));assert.equal(r.sourceStatus.prtimes,'ok')});
    await check('S21 サイトが読めなくても会社名を入れていれば、その名前で調べる',async()=>{const r=await run('nodns.example.test','/',{companyName:'入力商事'});assert.equal(r.diagnostics.homepage.ok,false);assert.equal(r.diagnostics.companyNameFrom,'input');assert.equal(r.companyName,'入力商事');assert.equal(r.sourceStatus.homepage,'failed');assert.equal(scraped[0].html,undefined)});
  }catch(e){console.error('FAIL',e);server.closeAllConnections();server.close();process.exit(1)}
  server.closeAllConnections();server.close();
  console.log('shodan research sites: '+results.length+' checks passed');
})();
