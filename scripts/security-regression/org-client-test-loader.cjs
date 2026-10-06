const {load}=require('./load-typescript.cjs');
function createOrgClient(service,globals={}){
 const transport=load('src/lib/org-client-response.ts',{}, {AbortController,TextDecoder,Uint8Array,setTimeout,clearTimeout,...globals});
 const protocol=load('src/lib/org-write-response.ts',{'./aio/brand-profile-input':load('src/lib/aio/brand-profile-input.ts'),'./aio/coverage':load('src/lib/aio/coverage.ts')});
 return {client:load('src/lib/'+service+'/client.ts',{'../org-client-response':transport,'../org-write-response':protocol}),transport,protocol};
}
module.exports={createOrgClient};
