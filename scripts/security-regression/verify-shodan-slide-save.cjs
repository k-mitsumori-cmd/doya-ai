const assert=require('node:assert/strict');const{load,check,results}=require('./load-typescript.cjs');
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){const row={id:'p',organizationId:'o',slidesJson:[{title:'one'},{title:'two'}],slideImages:[{title:'one',imagePath:'old0'},{title:'two',imagePath:'old1'}]};let chain=Promise.resolve(),locks=0,writes=0;let missing=false;
 const tx={$queryRaw:async(_parts,id,org)=>{locks++;assert.equal(id,'p');assert.equal(org,'o');return missing?[]:[{id:'p'}]},shodanPreparation:{findFirst:async()=>row,update:async({where,data})=>{assert.ok(locks>0);assert.equal(where.organizationId,'o');writes++;Object.assign(row,plain(data));return row}}};
 const api=load('src/lib/shodan/save-slide-images.ts',{'@/lib/prisma':{prisma:{$transaction:fn=>{const r=chain.then(()=>fn(tx));chain=r.catch(()=>{});return r}}}});
 return{row,api,get writes(){return writes},setMissing(){missing=true},save:(expected,changes)=>api.saveSlideImages('p','o',expected.slidesJson,expected.slideImages,changes)};
}
(async()=>{
 await check('different slide writes both survive',async()=>{const f=fixture(),old=plain(f.row);await Promise.all([0,1].map(index=>f.save(old,[{index,image:{title:'new',imagePath:'new'+index}}])));assert.deepEqual(f.row.slideImages.map(x=>x.imagePath),['new0','new1'])});
 await check('same slide stale write rejected',async()=>{const f=fixture(),old=plain(f.row);const r=await Promise.allSettled([0,1].map(i=>f.save(old,[{index:0,image:{title:'new',imagePath:'new'+i}}])));assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.writes,1)});
 await check('changed structure rejects generated image',async()=>{const f=fixture(),old=plain(f.row);f.row.slidesJson=[{title:'different'}];await assert.rejects(f.save(old,[{index:0,image:{title:'new',imagePath:'new'}}]),e=>e instanceof f.api.SlideImageConflict);assert.equal(f.writes,0)});
 await check('missing or transferred parent rejects before writes',async()=>{const f=fixture(),old=plain(f.row);f.setMissing();await assert.rejects(f.save(old,[{index:0,image:{title:'new',imagePath:'new'}}]));assert.equal(f.writes,0)});
 for(const index of [-1,2,0.5])await check('invalid slot '+index,async()=>{const f=fixture();await assert.rejects(f.save(plain(f.row),[{index,image:{title:'new',imagePath:'new'}}]));assert.equal(f.writes,0)});
 await check('one conflicting batch slot prevents every batch write',async()=>{const f=fixture(),old=plain(f.row);f.row.slideImages[1].imagePath='other';await assert.rejects(f.save(old,[0,1].map(index=>({index,image:{title:'new',imagePath:'new'+index}}))));assert.equal(f.row.slideImages[0].imagePath,'old0');assert.equal(f.writes,0)});
 console.log(JSON.stringify({passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
