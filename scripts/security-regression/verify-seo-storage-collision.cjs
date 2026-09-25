const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');const {load,check,results}=require('./load-typescript.cjs');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'doya-storage-audit-'));try{
 const lib=load('seo/lib/storage.ts',{'node:fs':fs,'node:path':path,'node:crypto':crypto,'@supabase/supabase-js':{}},{process:{cwd:()=>dir,env:{SEO_STORAGE_DIR:dir}}});
 await check('100 concurrent same-name saves preserve every image',async()=>{const rows=await Promise.all(Array.from({length:100},(_,i)=>lib.saveBase64ToFile({base64:Buffer.from('image-'+i).toString('base64'),filename:'same.png',subdir:'images'})));assert.equal(new Set(rows.map(r=>r.relativePath)).size,100);for(let i=0;i<rows.length;i++)assert.equal((await lib.readFileAsBuffer(rows[i].relativePath)).toString(),'image-'+i)});
 for(const filename of ['../bad.png','/tmp/bad.png','a\\b.png',''])await check('reject filename '+filename,async()=>{await assert.rejects(lib.saveBase64ToFile({base64:'AA==',filename,subdir:'images'}))});
 await check('reject directory escape',async()=>{await assert.rejects(lib.saveBase64ToFile({base64:'AA==',filename:'x.png',subdir:'../outside'}))});
 await check('existing legacy files remain readable',async()=>{fs.writeFileSync(path.join(dir,'images','legacy.png'),'legacy');assert.equal((await lib.readFileAsBuffer('images/legacy.png')).toString(),'legacy')});
 console.log(JSON.stringify({passed:results.length,results},null,2));
}finally{fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
