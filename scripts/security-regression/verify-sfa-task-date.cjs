const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const { jstDateKey, isJstOverdue } = load('src/lib/sfa/task-date.ts')

const beforeMidnight = new Date('2026-09-30T14:59:59Z')
const afterMidnight = new Date('2026-09-30T15:00:00Z')
const dueToday = '2026-10-01T00:00:00.000Z'
const dueYesterday = '2026-09-30T00:00:00.000Z'

assert.equal(jstDateKey(beforeMidnight), '2026-09-30')
assert.equal(jstDateKey(afterMidnight), '2026-10-01')
assert.equal(jstDateKey(dueToday), '2026-10-01', 'date input round-trips on every client timezone')
assert.equal(isJstOverdue(dueToday, afterMidnight), false, 'today is not overdue at JST midnight')
assert.equal(isJstOverdue(dueYesterday, afterMidnight), true, 'yesterday is overdue at JST midnight')
assert.equal(isJstOverdue(dueToday, beforeMidnight), false)
assert.equal(jstDateKey('invalid'), null)
assert.equal(isJstOverdue(null, afterMidnight), false)
console.log('PASS SFA task due dates follow JST calendar days')
