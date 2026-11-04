const {load}=require('./load-typescript.cjs')
const tier=load('src/lib/hr/plan-tier.ts',{'@/lib/unified-plan':load('src/lib/unified-plan.ts'),'@/lib/plan-utils':load('src/lib/plan-utils.ts')})
exports.loadHrBilling=(dependencies={},globals={})=>load('src/lib/hr/billing.ts',{...dependencies,'@/lib/hr/plan-tier':tier},globals)
