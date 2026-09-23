const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');const {calculateDailyAttendance:calc}=load('src/lib/kintai/attendance.ts');
const day=new Date('2026-09-20T00:00:00+09:00');const at=(type,m)=>({type,timestamp:new Date(+day+m*60000)});let count=0;
function check(name,events,expected,rule=null){const result=calc(events.map(([type,m])=>at(type,m)),rule,day);for(const [k,v] of Object.entries(expected))assert.equal(result[k] instanceof Date?result[k].toISOString():result[k],v,name+' '+k);count++;console.log('PASS',name)}
check('23時の30分勤務',[['clock_in',1380],['clock_out',1410]],{workMinutes:30,nightMinutes:30});
check('午前1時から4時',[['clock_in',60],['clock_out',240]],{nightMinutes:180});
check('22時と5時の境界',[['clock_in',1260],['clock_out',1800]],{workMinutes:540,nightMinutes:420});
check('夜間休憩を除外',[['clock_in',1320],['break_start',1380],['break_end',1470],['clock_out',1740]],{workMinutes:330,breakMinutes:90,nightMinutes:330});
check('日中の対照',[['clock_in',540],['break_start',720],['break_end',780],['clock_out',1080]],{workMinutes:480,breakMinutes:60,nightMinutes:0,overtimeMinutes:0});
check('休憩0分のルール',[['clock_in',540],['clock_out',720]],{workMinutes:180,overtimeMinutes:0},{workStart:'09:00',workEnd:'12:00',breakMinutes:0});
check('再出勤未退勤',[['clock_in',540],['clock_out',600],['clock_in',660]],{clockOut:null,workMinutes:60,earlyLeaveMinutes:0});
check('2勤務の隙間を除外',[['clock_in',60],['clock_out',120],['clock_in',240],['clock_out',300]],{workMinutes:120,nightMinutes:120});
check('休憩中退勤',[['clock_in',540],['break_start',600],['clock_out',630]],{workMinutes:60,breakMinutes:30});
check('勤務外の孤立休憩は除外',[['break_end',500],['clock_in',540],['clock_out',600],['break_start',630],['break_end',660]],{workMinutes:60,breakMinutes:0});
check('重複出勤・退勤・休憩',[['clock_in',540],['clock_in',550],['break_start',600],['break_start',610],['break_end',630],['break_end',640],['clock_out',660],['clock_out',670]],{workMinutes:90,breakMinutes:30});
check('逆順入力を時刻順へ',[['clock_out',660],['clock_in',540]],{workMinutes:120});
check('出勤なし',[['clock_out',660]],{workMinutes:0,clockIn:null,clockOut:null,nightMinutes:0});
check('夜勤所定時間',[['clock_in',1320],['clock_out',1800]],{workMinutes:480,nightMinutes:420,overtimeMinutes:0,earlyLeaveMinutes:0},{workStart:'22:00',workEnd:'06:00',breakMinutes:0});
check('同時刻の自動休憩終了と退勤',[['clock_in',540],['break_start',600],['clock_out',630],['break_end',630]],{workMinutes:60,breakMinutes:30});
// 独立した1分単位の基準値で日中/夜間境界・2日間を照合。
let oracleCases=0;
for(let start=0;start<1440;start+=37)for(const duration of [1,30,120,480,1500]){
 const end=start+duration;let expected=0;for(let t=start;t<end;t++){const m=t%1440;if(m<300||m>=1320)expected++}
 const r=calc([at('clock_in',start),at('clock_out',end)],null,day);assert.equal(r.nightMinutes,expected);assert.equal(r.workMinutes,duration);assert.ok(r.nightMinutes<=r.workMinutes);oracleCases++;
}
console.log(JSON.stringify({passed:count,minuteOracleCases:oracleCases}));
