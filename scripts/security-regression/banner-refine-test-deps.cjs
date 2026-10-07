const crypto=require('node:crypto'),sharp=require('sharp'),{load}=require('./load-typescript.cjs');
const operation=load('src/lib/banner/refine-operation.ts',{'node:crypto':crypto,'@/lib/prisma':{prisma:{}},'./monthly-quota':{}});
const input=load('src/lib/banner/refine-input.ts',{sharp,'./refine-operation':operation},{setTimeout,clearTimeout,TextDecoder});
module.exports={operation,input,refineModules:{'node:crypto':crypto,'@/lib/banner/refine-operation':operation,'@/lib/banner/refine-input':input,'@/lib/banner/history-access':{bannerHistoryCutoff:async()=>new Date(0)}}};
