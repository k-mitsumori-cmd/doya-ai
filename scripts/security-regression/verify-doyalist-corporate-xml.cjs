const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
async function main() {
const entities = await import('@nodable/entities');
const parser = load('src/lib/doyalist/collect/corporate-number-xml.ts', { 'fast-xml-parser': require('fast-xml-parser'), '@nodable/entities': entities });
let requests = [], deadlines = [], respond;
const provider = load('src/lib/doyalist/collect/provider-json.ts', {}, {
  AbortSignal: { timeout(ms) { deadlines.push(ms); return AbortSignal.timeout(ms); } },
  fetch: async (raw, init) => { const url = new URL(raw); assert.equal(url.hostname, 'api.houjin-bangou.nta.go.jp'); requests.push(url); return respond(init); },
});
const mocks = { './provider-json': provider, './corporate-number-xml': parser, './prefecture-codes': load('src/lib/doyalist/collect/prefecture-codes.ts') };
const search = load('src/lib/doyalist/collect/corporate-number.ts', mocks, { process: { env: { CORPORATE_NUMBER_API_KEY: 'synthetic-fixture-only' } } }).searchCorporateNumber;
const missing = load('src/lib/doyalist/collect/corporate-number.ts', mocks, { process: { env: {} } }).searchCorporateNumber;
const record = (number = '0123456789012', name = '見本 &amp; 検査会社') => `<corporation><corporateNumber>${number}</corporateNumber><name>${name}</name><prefectureName>北海道</prefectureName><cityName>見本市</cityName><streetNumber>一丁目&lt;仮&gt;</streetNumber><postCode>0010000</postCode><kind>301</kind><updateDate>2026-10-29</updateDate></corporation>`;
const document = (records, count = records.length) => `<?xml version="1.0" encoding="UTF-8"?><corporations><lastUpdateDate>2026-10-29</lastUpdateDate><count>${count}</count><divideNumber>1</divideNumber><divideSize>1</divideSize>${records.join('')}</corporations>`;
const reply = xml => new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
const checks = [];
async function check(name, fn) { await fn(); checks.push(name); }
async function noRequest(params) { const before = requests.length; await assert.rejects(() => search(params)); assert.equal(requests.length, before); }
  await check('Actual corporate helper reads official XML hierarchy and camelCase fields', async () => {
    respond = () => reply(document([record()]));
    const rows = await search({ keyword: '見本', prefecture: '東京都', count: 7 });
    assert.equal(rows.length, 1); assert.equal(rows[0].corporateNumber, '0123456789012'); assert.equal(rows[0].postCode, '0010000');
    assert.equal(rows[0].name, '見本 & 検査会社'); assert.equal(rows[0].address, '北海道見本市一丁目<仮>'); assert.equal(rows[0].kind, '301');
    const url = requests.at(-1); assert.equal(url.pathname, '/4/name'); assert.equal(url.searchParams.get('type'), '12'); assert.equal(url.searchParams.get('address'), '13'); assert.equal(url.searchParams.get('change'), '0');
    for (const key of ['count', 'from', 'history']) assert.equal(url.searchParams.has(key), false);
  });
  await check('Single/multiple corporation nodes and page totals stay bounded by caller count', async () => {
    respond = () => reply(document(Array.from({ length: 10 }, (_, i) => record(String(i).padStart(13, '0')))));
    assert.equal((await search({ keyword: '見本', count: 7, divide: 2 })).length, 7); assert.equal(requests.at(-1).searchParams.get('divide'), '2');
    respond = () => reply(document(Array.from({ length: 55 }, (_, i) => record(String(i).padStart(13, '0'))), 1500));
    assert.equal((await search({ keyword: '見本' })).length, 50);
  });
  await check('Valid zero hits are distinguished from missing or inconsistent data', () => {
    assert.equal(parser.parseCorporateNumberXml(document([])).length, 0);
    for (const xml of ['<corporations/>', '<corporations><count>1</count></corporations>', document([record()], 0), '<corporations><count>0</count><corporation/></corporations>']) assert.throws(() => parser.parseCorporateNumberXml(xml));
  });
  await check('CDATA, Unicode, numeric entities and leading/trailing name whitespace survive', () => {
    assert.equal(parser.parseCorporateNumberXml('\ufeff' + document([record()]))[0].corporateNumber, '0123456789012');
    assert.equal(parser.parseCorporateNumberXml(document([record('0123456789012', '<![CDATA[ 見本 &literal; <>会社 ]]>')]))[0].name, ' 見本 &literal; <>会社 ');
    assert.equal(parser.parseCorporateNumberXml(document([record('0123456789012', '<![CDATA[見本 <!DOCTYPE literal>]]>')]))[0].name, '見本 <!DOCTYPE literal>');
    assert.equal(parser.parseCorporateNumberXml(document([record('0123456789012', '&#x20BB7;野会社')]))[0].name, '𠮷野会社');
  });
  await check('Missing optional fields stay empty without losing numeric strings', () => {
    const row = parser.parseCorporateNumberXml(document(['<corporation><corporateNumber>0123456789012</corporateNumber><name>見本</name><postCode/></corporation>']))[0];
    assert.equal(row.postCode, ''); assert.equal(row.address, ''); assert.equal(row.corporateNumber, '0123456789012');
  });
  await check('Malformed XML, HTML and prior fake JSON contract cannot become zero hits', () => {
    for (const xml of ['<corporations><count>0</count>', '<html><body>Unavailable</body></html>', '{"hojin-infos":{"hojin-info":[]}}', '<corporations><count>0</count></corporations><corporations><count>0</count></corporations>', '<corporations><count>0</count></corporations><html/>']) assert.throws(() => parser.parseCorporateNumberXml(xml));
  });
  await check('Invalid counts and required record fields are rejected', () => {
    for (const count of ['-1', 'NaN', '1.5', '9007199254740992']) assert.throws(() => parser.parseCorporateNumberXml(document([record()], count)));
    for (const row of [record('123'), record('0123456789012', ''), record('0123456789012', '<nested>value</nested>')]) assert.throws(() => parser.parseCorporateNumberXml(document([row])));
  });
  await check('DOCTYPE and entity declarations cannot trigger expansion or external reads', () => {
    for (const declaration of ['<!DOCTYPE corporations SYSTEM "https://example.invalid/no-network">', '<!DOCTYPE corporations [<!ENTITY secret SYSTEM "file:///synthetic-not-a-real-file">]>']) assert.throws(() => parser.parseCorporateNumberXml(declaration + document([])));
    assert.throws(() => parser.parseCorporateNumberXml('x'.repeat(4 * 1024 * 1024 + 1)));
  });
  await check('Undefined entities and null character references fail without changing escaped literal names', () => {
    for (const name of ['&undefined;', '&#0;']) assert.throws(() => parser.parseCorporateNumberXml(document([record('0123456789012', name)])));
    assert.equal(parser.parseCorporateNumberXml(document([record('0123456789012', '&amp;undefined;')]))[0].name, '&undefined;');
  });
  await check('Prefecture names/codes and nationwide requests use the documented address contract', async () => {
    respond = () => reply(document([]));
    for (const [prefecture, expected] of [['北海道', '01'], ['1', '01'], ['13', '13'], ['99', '99'], ['全国', null], [undefined, null]]) {
      await search({ keyword: '見本', prefecture }); assert.equal(requests.at(-1).searchParams.get('address'), expected);
    }
    for (const prefecture of ['存在しない県', '関東']) await noRequest({ keyword: '見本', prefecture });
  });
  await check('Actual regional collector never drops Kanto into an unfiltered national corporate search', async () => {
    const collect = load('src/lib/doyalist/collect/index.ts', {
      './corporate-number': { searchCorporateNumber: search },
      './gbizinfo': { searchGbizInfo: async () => [], getGbizCompanyDetailsBatch: async () => new Map() },
      './prefecture-codes': mocks['./prefecture-codes'],
    });
    respond = () => { const code = requests.at(-1).searchParams.get('address'); const prefecture = Object.entries(mocks['./prefecture-codes'].PREFECTURE_TO_CODE).find(([, value]) => value === code)?.[0] || '全国に拡大した不正な検査値'; return reply(document([record(String(code || '0').padStart(13, '0')).replace('<prefectureName>北海道</prefectureName>', `<prefectureName>${prefecture}</prefectureName>`)])); };
    const before = requests.length;
    const result = await collect.collectCompaniesDetailed({ criteria: { keywords: ['見本'], areas: ['関東'] }, maxResults: 100, sources: ['corporate_number'], enrich: false });
    assert.deepEqual(requests.slice(before).map(url => url.searchParams.get('address')).sort(), ['08', '09', '10', '11', '12', '13', '14']);
    assert.equal(result.companies.length, 7); assert.equal(result.apiOk, true); assert.equal(result.budgetExhausted, false);
    assert.ok(result.companies.every(company => ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'].includes(company.prefecture)));
  });
  await check('Expanded regional requests stop when the shared collection budget expires', async () => {
    let now = 0, calls = 0;
    class Clock extends Date { static now() { return now; } }
    const collect = load('src/lib/doyalist/collect/index.ts', {
      './corporate-number': { searchCorporateNumber: async () => { calls++; now += 6; return []; } },
      './gbizinfo': { searchGbizInfo: async () => { throw Error('No other provider requested'); }, getGbizCompanyDetailsBatch: async () => new Map() },
      './prefecture-codes': mocks['./prefecture-codes'],
    }, { Date: Clock });
    const result = await collect.collectCompaniesDetailed({ criteria: { keywords: ['見本', '次の見本'], areas: ['関東'] }, maxResults: 100, sources: ['corporate_number'], enrich: false, budgetMs: 10 });
    assert.equal(calls, 2); assert.equal(result.budgetExhausted, true);
  });
  await check('Invalid helper inputs stop before transport and never broaden a query', async () => {
    for (const count of [0, -1, 51, 1.5, NaN, Infinity, '7']) await noRequest({ keyword: '見本', count });
    for (const divide of [0, 1.5, 100000, NaN]) await noRequest({ keyword: '見本', divide });
    for (const keyword of [undefined, '', '   ']) await noRequest({ keyword });
    for (const timeoutMs of [-1, NaN, Infinity]) await noRequest({ keyword: '見本', timeoutMs });
  });
  await check('Missing key does not issue any real or synthetic request', async () => {
    const before = requests.length; await assert.rejects(() => missing({ keyword: '見本' }), /CORPORATE_NUMBER_API_KEY/); assert.equal(requests.length, before);
  });
  await check('Timeout budget is finite/integer and provider host stays fixed', async () => {
    respond = () => reply(document([]));
    for (const [timeoutMs, expected] of [[0, 1], [1.5, 2], [20000, 12000]]) { await search({ keyword: 'https://example.invalid/not-a-target', timeoutMs }); assert.equal(deadlines.at(-1), expected); }
  });
  await check('Declared and streamed oversize responses are cancelled', async () => {
    let cancelled = 0;
    respond = () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])); }, cancel() { cancelled++; } }), { headers: { 'Content-Length': String(4 * 1024 * 1024 + 1) } });
    await assert.rejects(() => search({ keyword: '見本' }), /too large/); assert.equal(cancelled, 1);
    let chunks = 0; cancelled = 0;
    respond = () => new Response(new ReadableStream({ pull(c) { if (chunks++ > 8) throw Error('Unbounded test stream read'); c.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { cancelled++; } }));
    await assert.rejects(() => search({ keyword: '見本' }), /too large/); assert.equal(cancelled, 1);
  });
  await check('HTTP failures and empty responses cannot be reported as successful empty lists', async () => {
    respond = () => new Response('unavailable', { status: 503 }); await assert.rejects(() => search({ keyword: '見本' }), /503/);
    respond = () => new Response(null); await assert.rejects(() => search({ keyword: '見本' }), /empty/);
  });
  await check('Shared JSON reader retains gBiz JSON success, failure and malformed-body behavior', async () => {
    respond = () => Response.json({ 'hojin-infos': [{ name: '合成企業' }] }); const data = await provider.fetchCollectionJson('https://api.houjin-bangou.nta.go.jp/synthetic-only', {}, { timeoutMs: 1000, maxBytes: 1000 }); assert.equal(data.data['hojin-infos'][0].name, '合成企業');
    respond = () => new Response('broken'); await assert.rejects(() => provider.fetchCollectionJson('https://api.houjin-bangou.nta.go.jp/synthetic-only', {}, { timeoutMs: 1000, maxBytes: 1000 }));
    respond = () => new Response('unavailable', { status: 503 }); const failed = await provider.fetchCollectionJson('https://api.houjin-bangou.nta.go.jp/synthetic-only', {}, { timeoutMs: 1000, maxBytes: 1000 }); assert.equal(failed.ok, false); assert.equal(failed.data, null);
  });
  await check('Real loopback HTTP header and body stalls respect the complete response deadline', async () => {
    const http = require('node:http');
    const server = http.createServer((request, response) => {
      if (request.url === '/body') { response.writeHead(200, { 'Content-Type': 'application/xml' }); response.write('<corporations>'); }
      const timer = setTimeout(() => response.end('<count>0</count></corporations>'), 2000);
      response.on('close', () => clearTimeout(timer));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const actual = load('src/lib/doyalist/collect/provider-json.ts', {}, { AbortSignal, fetch: (url, init) => { assert.equal(new URL(url).hostname, '127.0.0.1'); return fetch(url, init); } });
      for (const route of ['/headers', '/body']) await assert.rejects(() => actual.fetchCollectionText(`http://127.0.0.1:${server.address().port}${route}`, {}, { timeoutMs: 1000, maxBytes: 1000 }), /abort|timeout/i);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
  console.log(JSON.stringify({ passed: checks.length, checks, scope: 'Actual corporate XML parser and request builder with synthetic NTA responses/key; bounded text/JSON reader also tested against owned loopback HTTP header/body stalls. Official v4-shaped fixtures. No external NTA/gBiz/provider/API-key/DB/production request.' }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
