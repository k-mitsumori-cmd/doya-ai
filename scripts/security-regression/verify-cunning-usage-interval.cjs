const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs'),{splitCunningInterval,cunningMonthStart}=load('src/lib/cunning/usage-interval.ts')
function parts(a,b){return JSON.parse(JSON.stringify(splitCunningInterval(new Date(a),new Date(b))))}
assert.deepEqual(parts('2026-09-30T14:59:45Z','2026-09-30T15:00:45Z'),[{monthStart:'2026-08-31T15:00:00.000Z',milliseconds:15000},{monthStart:'2026-09-30T15:00:00.000Z',milliseconds:45000}])
assert.deepEqual(parts('2026-12-31T14:59:59.999Z','2026-12-31T15:00:00.001Z'),[{monthStart:'2026-11-30T15:00:00.000Z',milliseconds:1},{monthStart:'2026-12-31T15:00:00.000Z',milliseconds:1}])
assert.equal(parts('2024-01-31T15:00:00Z','2024-02-29T15:00:00Z')[0].milliseconds,29*86400000)
assert.equal(cunningMonthStart(new Date('2026-09-30T15:00:00Z')).toISOString(),'2026-09-30T15:00:00.000Z')
assert.deepEqual(parts('2026-09-01','2026-09-01'),[])
for(const [a,b] of [['invalid','2026-09-01'],['2026-09-02','2026-09-01'],['2020-01-01','2026-09-01']])assert.throws(()=>parts(a,b))
console.log('PASS JST month/year boundaries, leap February, exact milliseconds, empty interval and invalid ranges')
