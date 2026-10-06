const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const out=__dirname,root=path.resolve(out,'../../..'),data=JSON.parse(fs.readFileSync(path.join(out,'data.json'))),dmmf=JSON.parse(fs.readFileSync(path.join(out,'dmmf.json')));
assert.equal(data.manifest.schema_sha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'prisma/schema.prisma'))).digest('hex'));
assert.deepEqual(Object.keys(data.models).sort(),dmmf.models.map(m=>m.name).sort());
let fields=0,edges=0,cardinalityIssues=[];
for(const m of dmmf.models){const generated=data.models[m.name];assert.equal(generated.table,m.dbName||m.name);assert.deepEqual(generated.fields.map(f=>f.name).sort(),m.fields.map(f=>f.name).sort());
 for(const f of m.fields){fields++;const scalar=generated.fields.find(x=>x.name===f.name);assert.equal(scalar.type,f.type+(f.isList?'[]':f.isRequired?'':'?'),m.name+'.'+f.name);if(f.kind!=='object'||!f.relationFromFields.length)continue;edges++;
  const relationCode=data.charts.find(c=>c.id==='all').code;const unique=f.relationFromFields.length===1&&m.fields.some(x=>x.name===f.relationFromFields[0]&&(x.isUnique||x.isId))||[...(m.uniqueFields||[]),...(m.primaryKey?[m.primaryKey.fields]:[])].some(keys=>keys.length===f.relationFromFields.length&&keys.every(k=>f.relationFromFields.includes(k)));
  const primary=[...m.fields.filter(x=>x.isId).map(x=>x.name),...(m.primaryKey?.fields||[])]; const sep=f.relationFromFields.every(k=>primary.includes(k))?'--':'..';
  const expected=`    ${f.type} ${f.isRequired?'||':'|o'}${sep}${unique?'o|':'o{'} ${m.name} : "${f.relationFromFields.join(',')}"`;
  if(!relationCode.includes(expected))cardinalityIssues.push(expected);
 }
}
assert.equal(edges,data.manifest.relations);assert.deepEqual(cardinalityIssues,[]);
const persona=dmmf.models.filter(m=>m.name.startsWith('Persona')).map(m=>m.name);assert.equal(persona.length,5);for(const name of persona)assert.equal(data.models[name].group,'persona');
assert.equal(new Set(data.charts.find(c=>c.id==='all').names).size,dmmf.models.length);
const result={models:dmmf.models.length,fields,declaredForeignKeys:edges,publicServices:data.services.filter(s=>s.public).length,charts:data.charts.length,personaModels:persona,fieldsAndCardinalityMatch:true,schemaSha256:data.manifest.schema_sha256,browserVisualQA:'not performed: browser URL policy rejects file protocol',databaseRecords:'not inspected'};
fs.writeFileSync(path.join(out,'prisma-validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
