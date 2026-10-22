// The business fixtures exercise work after a canonical beta gate accepted a known service.
// Policy allow/deny, guest and early-return behavior are tested with the actual helper elsewhere.
const assert = require('node:assert/strict')
exports.forService = serviceId => Object.freeze({
  betaServiceDenied: async actual => { assert.equal(actual, serviceId, 'the route must guard its own service'); return null },
})
