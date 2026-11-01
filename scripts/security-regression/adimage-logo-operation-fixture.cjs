// Actual logo operation guard for existing isolated PostgreSQL fixtures; no inert guard mocks.
const crypto=require('node:crypto'),{load}=require('./load-typescript.cjs')
function makeAdImageLogoOperationFixture(budget,getCore,globals={}) {
 const logo=load('src/lib/adimage/logo.ts',{'sharp':require('sharp')},globals)
 const output=load('src/lib/adimage/analysis-result.ts',{'./types':load('src/lib/adimage/types.ts',{})},{TextEncoder})
 const context=load('src/lib/adimage/logo-context.ts',{'./analysis-result':output},{TextEncoder})
 const input=load('src/lib/adimage/logo-input.ts',{'./logo':logo,'./logo-context':context},{File,FormData,Uint8Array,TextEncoder,setTimeout,clearTimeout,...globals})
 return load('src/lib/adimage/logo-operation.ts',{'node:crypto':crypto,'./image-budget':budget,'./logo-input':input,'./logo-context':context,'./image-operation':{hasActiveAdImageOperation:(...args)=>getCore().hasActiveAdImageOperation(...args)}},globals)
}
module.exports={makeAdImageLogoOperationFixture}
