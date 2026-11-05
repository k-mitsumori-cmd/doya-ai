import assert from 'node:assert/strict'
import {test} from 'node:test'
import {powerPackReturnMessage,powerPackThanksPoints} from './src/lib/pricing-v2/power-pack-return'
const cases:[string,unknown,number|null][]=[
 ['new paid purchase',{ok:true,points:1000,refundedPoints:0,duplicated:false},1000],
 ['legacy successful response',{ok:true,points:1000,duplicated:false},1000],
 ['duplicate purchase',{ok:true,points:1000,refundedPoints:0,duplicated:true},null],
 ['full refund',{ok:true,points:0,refundedPoints:1000,duplicated:false},null],
 ['partial refund',{ok:true,points:500,refundedPoints:500,duplicated:false},null],
 ['invalid count',{ok:true,points:'1000',duplicated:false},null],
 ['error response',{ok:false,points:1000,duplicated:false},null],
 ['invalid duplicate field',{ok:true,points:1000,duplicated:'false'},null],
]
for(const [name,value,expected] of cases)test('payment thanks: '+name,()=>assert.equal(powerPackThanksPoints(value),expected))
test('refund messages explain the entitlement instead of thanking a new purchase',()=>{
 assert.match(powerPackReturnMessage(cases[3][1])!,/全額分の返金処理/)
 assert.match(powerPackReturnMessage(cases[4][1])!,/返金処理分を除いた/)
 assert.match(powerPackReturnMessage(cases[2][1])!,/反映済み/)
})
