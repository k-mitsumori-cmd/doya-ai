const assert = require('node:assert/strict');
const { load, check, results } = require('./load-typescript.cjs');
const zod = require('zod');
const { SeoCreateArticleInputSchema, SeoOutlineSchema } = load('seo/lib/types.ts', { zod });
const interview = load('src/lib/interview/ai-output.ts', { zod });
const article = { title: '検査用の記事', keywords: ['検査'], targetChars: 5000 };
const section = { h2: '見出し', intentTag: '解説' };

(async () => {
  await check('oversized actual article keywords reject before accumulating element errors', () => {
    // Bounded reproduction: 1,000 invalid values, never an unbounded input or live request.
    const parsed = SeoCreateArticleInputSchema.safeParse({ ...article, keywords: Array(1000).fill(false) });
    assert.equal(parsed.success, false);
    assert.equal(parsed.error.issues.length, 1);
    assert.equal(parsed.error.issues[0].code, 'too_big');
    assert.equal(parsed.error.issues[0].path.join('.'), 'keywords');
  });
  await check('article boundary of fifty keywords and documented defaults remain valid', () => {
    const parsed = SeoCreateArticleInputSchema.parse({ ...article, keywords: Array(50).fill('検査') });
    assert.equal(parsed.keywords.length, 50); assert.equal(parsed.tone, '丁寧');
    assert.equal(parsed.mode, 'standard'); assert.equal(parsed.referenceUrls.length, 0);
  });
  await check('article wrong types and invalid reference URLs still reject', () => {
    for (const input of [{ ...article, targetChars: '5000' }, { ...article, keywords: [] },
      { ...article, referenceUrls: ['invalid URL'] }]) assert.equal(SeoCreateArticleInputSchema.safeParse(input).success, false);
  });
  await check('outline normalization preserves h3/h4 and numeric planning clamps', () => {
    const parsed = SeoOutlineSchema.parse({ sections: [
      { ...section, plannedChars: '2400', h3: null, h4: null },
      { ...section, plannedChars: 50000, h4: { 詳細: ['補足'] } },
      { ...section, plannedChars: 1, h4: [] },
    ] });
    assert.equal(parsed.sections[0].plannedChars, 2400); assert.equal(parsed.sections[0].h3.length, 0);
    assert.equal(Object.keys(parsed.sections[0].h4).length, 0);
    assert.equal(parsed.sections[1].plannedChars, 3500); assert.equal(parsed.sections[1].h4.詳細[0], '補足');
    assert.equal(parsed.sections[2].plannedChars, 800); assert.equal(Object.keys(parsed.sections[2].h4).length, 0);
  });
  await check('outline defaults and malformed record values retain their contracts', () => {
    const parsed = SeoOutlineSchema.parse({ sections: [section, section, section] });
    assert.equal(parsed.sections[0].plannedChars, 2000); assert.equal(parsed.faq.length, 0);
    assert.equal(SeoOutlineSchema.safeParse({ sections: [section, section] }).success, false);
    assert.equal(SeoOutlineSchema.safeParse({ sections: [{ ...section, h4: { 詳細: 'not an array' } }, section, section] }).success, false);
  });
  await check('proofreading keeps zero scores, boolean record keys and empty defaults', () => {
    const parsed = interview.parseProofreadOutput(JSON.stringify({ score: 0, summary: '検査', checks: { 誤字: false, 表記: true } }));
    assert.equal(parsed.score, 0); assert.equal(parsed.checks.誤字, false); assert.equal(parsed.checks.表記, true);
    assert.equal(parsed.suggestions.length, 0);
    assert.equal(Object.keys(interview.parseProofreadOutput('{"score":10,"summary":"検査"}').checks).length, 0);
  });
  await check('proofreading rejects non-boolean and non-record checks', () => {
    for (const checks of [{ 誤字: 'true' }, { 誤字: {} }, []]) {
      assert.equal(interview.parseProofreadOutput(JSON.stringify({ score: 10, summary: '検査', checks })), null);
    }
  });
  await check('interview fact labels and title limits remain enforced', () => {
    const parsed = interview.parseFactCheckOutput(JSON.stringify({ reliability: 90, summary: '検査', claims: [
      { text: '検査', category: 'number', status: 'verified', detail: '根拠なし', severity: 'low' },
    ] }));
    assert.equal(parsed.claims[0].status, 'unverifiable');
    const title = { title: '検査', type: 'keyword', reason: '検査' };
    assert.equal(interview.parseTitleOutput(JSON.stringify(Array(10).fill(title))).length, 10);
    assert.equal(interview.parseTitleOutput(JSON.stringify(Array(11).fill(title))), null);
  });
  console.log(JSON.stringify({ passed: results.length, results, scope: 'Actual app schemas, bounded synthetic inputs, no network/providers/DB.' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
