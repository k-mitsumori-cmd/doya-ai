const assert = require('node:assert/strict');
require('tsx/cjs');

const {
  parseProofreadOutput,
  parseFactCheckOutput,
  parseTitleOutput,
  parseSnsOutput,
  parseTranslationOutput,
} = require('../../src/lib/interview/ai-output.ts');

assert.equal(parseProofreadOutput('not JSON'), null);
assert.equal(parseProofreadOutput('{"score":0,"summary":"解析失敗"}').score, 0);
assert.equal(parseProofreadOutput('{"score":"85","summary":"良好"}'), null);
assert.equal(parseProofreadOutput('{"score":85,"summary":"良好","suggestions":{}}'), null);
assert.equal(parseFactCheckOutput('{"reliability":70,"summary":"要確認","claims":"none"}'), null);
assert.equal(parseFactCheckOutput('```json\n{"reliability":70,"summary":"要確認"}\n```').reliability, 70);
assert.equal(parseFactCheckOutput('{"reliability":90,"summary":"要確認","claims":[{"text":"数値","category":"number","status":"verified","detail":"外部資料なし","severity":"low"}]}').claims[0].status, 'unverifiable');
assert.equal(parseTitleOutput('[]'), null);
assert.equal(parseTitleOutput('[{"title":"提案","type":"keyword","reason":"検索向け"}]').length, 1);
assert.equal(parseSnsOutput('{"posts":[{"platform":"twitter","content":"投稿文","hashtags":[],"tip":""}]}').posts.length, 1);
assert.equal(parseSnsOutput('{"posts":[{"platform":"twitter","content":{}}]}'), null);
assert.equal(parseTranslationOutput('{"title":"Title","content":"Translated article"}').content, 'Translated article');
assert.equal(parseTranslationOutput('{"title":"Title","content":""}'), null);

console.log('Interview AI output validation passed');
