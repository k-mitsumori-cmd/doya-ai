import test from 'node:test'
import assert from 'node:assert/strict'
import { companySeatUsage, SeatUsageUnavailableError } from './company-seat-usage'

// Pure current-identity rules. Actual rollout, SQL locking, and admission are
// verified separately against a private database; these tests perform no IO.
const now = new Date('2026-11-08T00:00:00Z')
const owner = { id: 'owner', email: 'owner@example.invalid' }
const guest = { id: 'guest', email: 'guest@example.invalid' }
const op = (key = 'tool:guest') => ({ companyId: 'company', key, kind: 'operator' as const, userId: 'guest' })
const reserve = (email = 'guest@example.invalid', key = 'invite') => ({ companyId: 'company', key, kind: 'reservation' as const, email, startsAt: new Date(+now - 1000), expiresAt: new Date(+now + 1000) })
const calculate = (x: Partial<Parameters<typeof companySeatUsage>[0]> = {}) => companySeatUsage({ companyId: 'company', ownerUserId: 'owner', users: [owner, guest], entries: [op(), reserve()], now, ...x })

test('operating account remains counted without verified exclusion',()=>assert.equal(calculate().used,2));
test('enforced guest stored membership and same-current-email invitation are excluded once',()=>assert.equal(calculate({excludedOperatingUserIds:['guest']}).used,1));
test('pending invitation for uniquely resolved excluded guest does not reserve paid seat',()=>assert.equal(calculate({entries:[reserve()],excludedOperatingUserIds:['guest']}).used,1));
test('case-ambiguous current email cannot silently remove a reserved seat',()=>{const v=calculate({users:[owner,guest,{id:'other',email:'GUEST@example.invalid'}],entries:[reserve()],excludedOperatingUserIds:['guest']});assert.equal(v.used,2);assert.equal(v.unresolvedReservations,1)});
test('historical email is not evidence to exclude an unresolved invitation',()=>assert.equal(calculate({users:[owner,{...guest,email:'new@example.invalid'}],entries:[reserve()],excludedOperatingUserIds:['guest']}).used,2));
test('unrelated excluded ID never drops a known operating account',()=>assert.equal(calculate({excludedOperatingUserIds:['different']}).used,2));
test('malformed reservation dates still fail for an excluded guest',()=>assert.throws(()=>calculate({entries:[{...reserve(),expiresAt:new Date(NaN)}],excludedOperatingUserIds:['guest']}),SeatUsageUnavailableError));
test('company owner can never be excluded',()=>assert.throws(()=>calculate({excludedOperatingUserIds:['owner']}),SeatUsageUnavailableError));
test('duplicate source keys still fail even for excluded operator',()=>assert.throws(()=>calculate({entries:[op(),op()],excludedOperatingUserIds:['guest']}),SeatUsageUnavailableError));
test('missing current account is not accepted by the pure validator just because excluded',()=>assert.throws(()=>calculate({users:[owner],entries:[op()],excludedOperatingUserIds:['guest']}),SeatUsageUnavailableError));
test('opaque legacy row cannot be guessed to belong to excluded guest',()=>assert.equal(calculate({entries:[{companyId:'company',key:'opaque',kind:'opaque'}],excludedOperatingUserIds:['guest']}).used,2));
test('foreign company row still fails even for excluded guest',()=>assert.throws(()=>calculate({entries:[{...op(),companyId:'foreign'}],excludedOperatingUserIds:['guest']}),SeatUsageUnavailableError));
test('guest exclusion is local to one company and never removes ownership elsewhere',()=>{assert.equal(calculate({excludedOperatingUserIds:['guest']}).used,1);assert.equal(companySeatUsage({companyId:'other',ownerUserId:'guest',users:[owner,guest],entries:[{companyId:'other',key:'other:operator',kind:'operator',userId:'owner'}],now}).used,2)});
test('current email matching keeps the existing case and whitespace normalization',()=>assert.equal(calculate({users:[owner,{...guest,email:' GUEST@example.invalid '}],entries:[reserve(' guest@example.invalid ')],excludedOperatingUserIds:['guest']}).used,1));
test('expired unrelated invitation still releases its reservation',()=>assert.equal(calculate({entries:[{...reserve('unknown@example.invalid'),expiresAt:now}],excludedOperatingUserIds:['guest']}).used,1));
