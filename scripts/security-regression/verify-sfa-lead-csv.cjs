const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const { parseLeadCsv } = load('src/lib/sfa/lead-csv.ts');

const normalize = (value) => JSON.parse(JSON.stringify(value));
const rows = normalize(parseLeadCsv('\uFEFFname,note,url\r\n"株式会社A","1行目\r\n2行目, 補足と""引用""",https://a.example\r\n\r\n株式会社B,通常,https://b.example\r\n'));
assert.equal(rows.length, 2);
assert.deepEqual(rows[0], { name: '株式会社A', note: '1行目\r\n2行目, 補足と"引用"', url: 'https://a.example' });
assert.deepEqual(rows[1], { name: '株式会社B', note: '通常', url: 'https://b.example' });
assert.equal(normalize(parseLeadCsv('企業名,メモ\n会社C,"挨拶, 詳細"'))[0].メモ, '挨拶, 詳細');

for (const [csv, expected] of [
  ['name,note\n"会社A,メモ', '引用符が閉じられていません'],
  ['name,note\n"会社A"余分,メモ', '引用符の後に余分な文字'],
  ['name,note\n会社A,"メモ""', '引用符が閉じられていません'],
  ['name,note\n会社A', '列数がヘッダと一致しません'],
  ['name,note\n会社A,メモ,余分', '列数がヘッダと一致しません'],
  ['name,name\n会社A,会社B', '列名が空、または重複'],
  ['note,url\nメモ,https://a.example', '企業名の列'],
  ['name\n', 'ヘッダ行と1件以上'],
]) assert.throws(() => parseLeadCsv(csv), (error) => error.message.includes(expected), csv);

const tooMany = `name\n${Array.from({ length: 501 }, (_, index) => `会社${index}`).join('\n')}`;
assert.throws(() => parseLeadCsv(tooMany), /500件まで/);
console.log('PASS SFA lead CSV: quoted newlines, commas, escaped quotes, BOM, and malformed input');
