const {load}=require('./load-typescript.cjs')
function attachEvaluationRunner(mocks){
 Object.assign(mocks,completionNotificationMocks())
 const db=mocks['@/lib/prisma'].prisma
 if(!db.systemSetting){
  const values=new Map()
  db.systemSetting={findUnique:async({where})=>values.has(where.key)?{key:where.key,value:values.get(where.key)}:null,upsert:async({where,create,update})=>{values.set(where.key,values.has(where.key)?update.value:create.value);return{key:where.key,value:values.get(where.key)}},deleteMany:async({where})=>{if(!values.has(where.key)||where.value!==undefined&&values.get(where.key)!==where.value)return{count:0};values.delete(where.key);return{count:1}}}
 }
 mocks['@/lib/aishodan/evaluation-task']=load('src/lib/aishodan/evaluation-task.ts',{'node:crypto':require('node:crypto')});
 mocks['@/lib/aishodan/evaluation-view']=load('src/lib/aishodan/evaluation-view.ts',{'./evaluation-task':mocks['@/lib/aishodan/evaluation-task']});
 mocks['@/lib/aishodan/evaluation-lease']=load('src/lib/aishodan/evaluation-lease.ts',{'@/lib/prisma':{prisma:db},'node:crypto':require('node:crypto')})
 mocks['@/lib/aishodan/evaluate-current-session']=load('src/lib/aishodan/evaluate-current-session.ts',mocks)
 mocks['@/lib/aishodan/deliver-completion-notifications']={deliverPendingCompletionNotifications:async()=>{
  await mocks['@/lib/notifications']?.postToSlackBlocks('Synthetic completion',[])
  return{sent:1,retried:0,exhausted:0,skipped:0}
 },deliverPendingFailureNotifications:async()=>{
  await mocks['@/lib/notifications']?.postToSlackBlocks('Synthetic failure',[])
  return{sent:1,retried:0,exhausted:0,skipped:0}
 }}
 return mocks
}
function completionNotificationMocks(){
 const tasks=load('src/lib/aishodan/evaluation-task.ts',{'node:crypto':require('node:crypto')})
 return{'./completion-notification-task':load('src/lib/aishodan/completion-notification-task.ts',{'./evaluation-task':tasks,'node:crypto':require('node:crypto')})}
}
module.exports={attachEvaluationRunner,completionNotificationMocks}
