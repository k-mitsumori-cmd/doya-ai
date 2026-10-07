const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');
const file='src/app/kintai/settings/page.tsx',source=fs.readFileSync(file,'utf8');
const fn=source.slice(source.indexOf('function computeSchedulePreview('),source.indexOf('export default function SettingsPage'));
const context={};vm.runInNewContext(ts.transpileModule(fn,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
const tests=[
 ['day without break','09:00','17:00',0,'09:00 - 17:00 勤務 = 8時間'],
 ['night without break','22:00','06:00',0,'22:00 - 翌日06:00 勤務 = 8時間'],
 ['short shift without break','23:45','00:15',0,'23:45 - 翌日00:15 勤務 = 0時間30分'],
 ['day with break','09:00','18:00',60,'09:00 - 13:00 勤務 → 13:00 - 14:00 休憩 → 14:00 - 18:00 勤務 = 8時間'],
 ['night with next day break','22:00','07:00',60,'22:00 - 翌日02:00 勤務 → 翌日02:00 - 翌日03:00 休憩 → 翌日03:00 - 翌日07:00 勤務 = 8時間'],
 ['break crossing midnight','20:00','04:00',60,'20:00 - 23:30 勤務 → 23:30 - 翌日00:30 休憩 → 翌日00:30 - 翌日04:00 勤務 = 7時間'],
 ['equal endpoints preserve zero-duration semantics','09:00','09:00',0,''],
 ['empty time','','17:00',0,''],
 ['no working time','09:00','10:00',60,'']
];
const cases=tests.map(([name,start,end,minutes,expected])=>{const actual=context.computeSchedulePreview(start,end,minutes);return {name,expected,actual,passed:actual===expected}});
const result={checkedAt:new Date().toISOString(),passed:cases.filter(c=>c.passed).length,cases,sourceHash:crypto.createHash('sha256').update(source).digest('hex'),scope:'Actual TSX preview function; day/night/minute/zero-break rendering. No database or provider calls.'};
fs.writeFileSync(process.env.DOYA_PREVIEW_RESULT||'docs/audits/2026-10-06-all-services-recheck/kintai-schedule-preview-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));assert(cases.every(c=>c.passed),'Schedule preview mismatch');
