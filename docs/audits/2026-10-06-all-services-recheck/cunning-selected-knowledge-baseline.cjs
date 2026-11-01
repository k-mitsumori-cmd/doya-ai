const assert=require('node:assert/strict');
const {fixture,dom}=require('../../../scripts/security-regression/verify-cunning-start-mounted.cjs');
(async()=>{const f=await fixture();try{
 await f.act(()=>f.props(f.c.querySelector('select')).onChange({target:{value:'kb'}}));
 assert.equal(f.c.querySelector('select').value,'kb');
 f.list('/api/cunning/knowledge',async()=>Response.json({bases:[]}));f.auth('authenticated',{user:{id:'alpha',plan:'PRO'}});await f.render();
 const displayed=f.c.querySelector('select').value;await f.click();const submitted=JSON.parse(f.posts()[0].init.body).knowledgeBaseId;
 assert.equal(displayed,'');assert.equal(submitted,'kb');
 console.log(JSON.stringify({status:'confirmed-candidate-defect',case:'Selected knowledge missing from a successful refreshed list',observed:{displayed,submitted},scope:'Actual full Tool with synthetic responses and session creation stub only. Visible unselected option and submitted retained reference disagree. No actual production/customer or provider request.'},null,2));
}finally{await f.close();dom.window.close()}})().catch(e=>{console.error(e);process.exitCode=1});
