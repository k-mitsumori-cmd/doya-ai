const assert=require('node:assert/strict');const {load}=require('./load-typescript.cjs');
const reader=load('src/lib/billing-response-client.ts');const status=load('src/lib/subscription-status-client.ts',{'./billing-response-client':reader});
const parser=load('src/lib/subscription-mutation-client.ts',{'./billing-response-client':reader,'./subscription-status-client':status});
const sub={subscriptionId:'sub_one',status:'active',cancelAtPeriodEnd:true,currentPeriodEnd:2000000000};
const valid={ok:true,mode:'period_end',...sub,canceledCount:1,results:[sub]};let count=0;
for(const operation of ['cancel','resume']){const good=operation==='cancel'?valid:{ok:true,...sub,cancelAtPeriodEnd:false};assert.ok(parser.parseSubscriptionMutation(good,operation));count++;
for(const value of [{},{...good,ok:false},{...good,ok:'true'},{...good,error:'private'},{...good,code:'FAIL'},{...good,subscriptionId:[]},{...good,hasSubscription:false},{...good,status:'canceled'},{...good,currentPeriodEnd:NaN},{...good,cancelAtPeriodEnd:!good.cancelAtPeriodEnd}]){assert.throws(()=>parser.parseSubscriptionMutation(value,operation));count++}}
for(const value of [{...valid,mode:'immediate'},{...valid,results:[]},{...valid,canceledCount:2},{...valid,failedCount:0},{...valid,results:[{...sub,error:'private'}]},{...valid,results:[{...sub,ok:false}]},{...valid,results:[{...sub,hasSubscription:false}]},{...valid,results:[{...sub,cancelAtPeriodEnd:false}]},{...valid,results:[{...sub,subscriptionId:'other'}]},{...valid,results:[{...sub,currentPeriodEnd:2000000001}]},{...valid,canceledCount:2,results:[sub,sub]}]){assert.throws(()=>parser.parseSubscriptionMutation(value,'cancel'));count++}
assert.ok(parser.parseSubscriptionMutation({...valid,canceledCount:2,results:[sub,{...sub,subscriptionId:'sub_two'}]},'cancel'));count++;
console.log(JSON.stringify({passed:count,scope:'actual parser; coherent all-contract period-end cancellation and resume confirmation'}));
