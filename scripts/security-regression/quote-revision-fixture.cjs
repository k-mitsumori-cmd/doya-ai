const {load}=require('./load-typescript.cjs');
const crypto=require('node:crypto');
const actual=load('src/lib/quote/document-revision.ts',{'node:crypto':crypto});
module.exports={...actual,
  lockQuoteDocumentActor:(tx,ctx)=>tx.quoteMember.findFirst({where:{organizationId:ctx.organizationId,userId:ctx.userId,status:'ACTIVE'}}),
  assertQuoteDocumentRevision:async(_tx,_doc,expected)=>{actual.quoteExpectedRevision(expected)},
  advanceQuoteDocumentRevision:async(_tx,doc)=>({...doc,revision:crypto.randomBytes(32).toString('hex')}),
};
// Only legacy business/UI fixtures use this adapter. Real locking, stale revisions, ABA and rollback use isolated PostgreSQL tests.
