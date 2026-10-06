const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../..'),ts=require(path.join(root,'node_modules/typescript')),cache={};
function readModule(file){if(cache[file])return cache[file];const output={};cache[file]=output;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:output,require:n=>{if(!n.startsWith('.'))throw Error('Unexpected dependency '+n);return readModule(path.resolve(path.dirname(file),n+'.ts'));},process:{env:{}}});return output;}
const serviceModule=readModule(path.join(root,'src/lib/services.ts')),publicIds=new Set(serviceModule.getPublicServices().map(s=>s.id));
const services=serviceModule.SERVICES.map(s=>({id:s.id,name:s.name,status:s.status,href:s.href,public:publicIds.has(s.id),retired:serviceModule.RETIRED_SERVICE_IDS.has(s.id)}));
fs.writeFileSync(path.join(__dirname,'service-registry.json'),JSON.stringify(services,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'dmmf.json'),JSON.stringify(require(path.join(root,'node_modules/@prisma/client')).Prisma.dmmf.datamodel,null,2)+'\n');
console.log(JSON.stringify({publicServices:publicIds.size,services:services.length}));
