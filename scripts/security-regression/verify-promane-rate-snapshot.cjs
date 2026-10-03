const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const { laborCostForEntry } = load('src/lib/promane/labor-cost.ts')
assert.equal(laborCostForEntry({ duration: 60, hourlyRateSnapshot: 2000 }, 5000), 2000)
assert.equal(laborCostForEntry({ duration: 30, hourlyRateSnapshot: 2000 }, 5000), 1000)
assert.equal(laborCostForEntry({ duration: 60, hourlyRateSnapshot: 0 }, 5000), 0)
assert.equal(laborCostForEntry({ duration: 60, hourlyRateSnapshot: null }, 5000), 5000)
assert.equal(laborCostForEntry({ duration: -1, hourlyRateSnapshot: 2000 }, 5000), 0)

console.log('PASS Promane labor cost stays fixed after member rate changes')
