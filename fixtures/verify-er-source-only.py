#!/usr/bin/env python3
import copy
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import argparse

BASE = pathlib.Path(__file__).resolve().parents[1] / 'scripts/architecture'
DATE = '2026-10-22'
def sha(b): return hashlib.sha256(b).hexdigest()
def command(*args, cwd=None, expect=0):
    p = subprocess.run(args, cwd=cwd, text=True, capture_output=True)
    if p.returncode != expect: raise AssertionError((args, p.returncode, p.stdout, p.stderr))
    return p.stdout
def reject(message, *args, env=None):
    p = subprocess.run(args, text=True, capture_output=True, env=env)
    if p.returncode == 0 or message not in p.stdout + p.stderr:
        raise AssertionError((args, p.returncode, p.stdout, p.stderr, message))

def field(name, type, kind='scalar', required=True, **kw):
    return {**dict(name=name,type=type,kind=kind,isRequired=required,isList=False,isId=False,isUnique=False,dbName=None), **kw}

def main(dependency_root):
  with tempfile.TemporaryDirectory(prefix='er-fixture-') as folder:
    temp=pathlib.Path(folder); root=temp/'repo'; inp=temp/'bundle'; out=temp/'out'
    (root/'prisma').mkdir(parents=True); (root/'src/lib').mkdir(parents=True)
    schema='''generator client {\n provider = "prisma-client-js"\n}\nmodel ParentA {\n id String\n tenant String\n children Child[]\n lease Lease?\n @@id([id, tenant])\n @@map("parents_a")\n}\nmodel Child {\n id String @id\n left String\n right String\n reviewerId String? @map("reviewer_id")\n status Status\n owner ParentA @relation(\n   "Owner", fields: [left, right],\n   references: [id, tenant])\n reviewer ParentA? @relation("Reviewer", fields: [reviewerId], references: [id])\n @@unique([left, right])\n @@map("children")\n}\nmodel Lease {\n id String\n tenant String\n parent ParentA @relation(fields: [id, tenant], references: [id, tenant])\n @@id([id, tenant])\n}\nenum Status {\n OPEN\n CLOSED\n}\n'''
    (root/'prisma/schema.prisma').write_text(schema)
    (root/'src/lib/services.ts').write_text('export const SERVICES = []\nexport const RETIRED_SERVICE_IDS = new Set()\nexport function getPublicServices(){return SERVICES}\n')
    (root/'src/lib/shell').mkdir(); (root/'src/lib/shell/company.ts').write_text('// fixture caller\n')
    (root/'.gitignore').write_text('node_modules/\n')
    (root/'package.json').write_text('{"name":"er-source-fixture","version":"1.0.0"}\n')
    (root/'package-lock.json').write_text('{"name":"er-source-fixture","lockfileVersion":3}\n')
    command('git','init','-q',cwd=root); command('git','config','user.email','fixture@example.invalid',cwd=root);command('git','config','user.name','Fixture',cwd=root);command('git','add','.',cwd=root);command('git','commit','-qm','fixture',cwd=root)
    commit=command('git','rev-parse','HEAD',cwd=root).strip();tree=command('git','rev-parse','HEAD^{tree}',cwd=root).strip()
    pa={'name':'ParentA','dbName':'parents_a','fields':[field('id','String'),field('tenant','String'),field('children','Child','object',False,relationFromFields=[],relationToFields=[]),field('lease','Lease','object',False,relationFromFields=[],relationToFields=[])], 'uniqueFields':[], 'primaryKey':{'fields':['id','tenant']}}
    child={'name':'Child','dbName':'children','fields':[field('id','String',isId=True),field('left','String'),field('right','String'),field('reviewerId','String',required=False,dbName='reviewer_id'),field('status','Status','enum'),field('owner','ParentA','object',True,relationFromFields=['left','right'],relationToFields=['id','tenant'],relationName='Owner'),field('reviewer','ParentA','object',False,relationFromFields=['reviewerId'],relationToFields=['id'],relationName='Reviewer')], 'uniqueFields':[['right','left']], 'primaryKey':None}
    lease={'name':'Lease','dbName':None,'fields':[field('id','String'),field('tenant','String'),field('parent','ParentA','object',True,relationFromFields=['id','tenant'],relationToFields=['id','tenant'])], 'uniqueFields':[], 'primaryKey':{'fields':['id','tenant']}}
    dmmf={'models':[pa,child,lease],'enums':[{'name':'Status','values':[{'name':'OPEN','dbName':None},{'name':'CLOSED','dbName':None}]}]}
    registry=[{'id':'demo','name':'Demo','status':'active','href':'/demo','public':True,'retired':False}]
    inp.mkdir(); (inp/'schema.prisma').write_text(schema);(inp/'dmmf.json').write_text(json.dumps(dmmf));(inp/'service-registry.json').write_text(json.dumps(registry));(inp/'validation.json').write_text('{}')
    files={p.name:sha(p.read_bytes()) for p in inp.iterdir()}
    manifest={'date':DATE,'sourceCommit':commit,'sourceTree':tree,'sourceStatus':'','schemaSha256':sha(schema.encode()),'generatedClientSchemaSha256':sha(schema.encode()),'formattedSourceSchemaSha256':sha(schema.encode()),'formattedGeneratedClientSchemaSha256':sha(schema.encode()),'closureSha256':{'prisma/schema.prisma':sha(schema.encode()),'src/lib/services.ts':sha((root/'src/lib/services.ts').read_bytes())},'filesSha256':files,'counts':{'models':3,'enums':1,'services':1,'publicServices':1}}
    (inp/'manifest.json').write_text(json.dumps(manifest))
    evidence_path='src/lib/shell/company.ts'
    groups=temp/'groups.json';groups.write_text(json.dumps({'sourceCommit':commit,'schemaSha256':sha(schema.encode()),'evidenceSha256':{evidence_path:sha((root/evidence_path).read_bytes())},'models':{n:{'group':'core','evidence':evidence_path} for n in ['ParentA','Child','Lease']}}))
    mermaid=temp/'mermaid.js';mermaid.write_text('window.mermaid={initialize(){},render:async()=>({svg:"<svg></svg>"})};')
    common=['--root',str(root),'--input-dir',str(inp),'--out-dir',str(out),'--date',DATE]
    build=['python3',str(BASE/'build-er.py'),*common,'--mermaid-source',str(mermaid),'--group-map',str(groups)]
    command(*build)
    command('python3',str(BASE/'make-er-html.py'),*common)
    good=command('python3',str(BASE/'validate-er.py'),*common)
    output_manifest_path=out/'manifest.json';output_manifest=json.loads(output_manifest_path.read_text())
    entity_file=out/'entities.csv';original_entities=entity_file.read_bytes()
    entity_file.write_bytes(original_entities.replace(b'parents_a',b'wrong_tbl',1))
    output_manifest['outputSha256']['entities.csv']=sha(entity_file.read_bytes())
    output_manifest_path.write_text(json.dumps(output_manifest))
    reject('Entity CSV semantic column mismatch','python3',str(BASE/'validate-er.py'),*common)
    entity_file.write_bytes(original_entities);output_manifest['outputSha256']['entities.csv']=sha(original_entities)
    relation_file=out/'relations.csv';original_relations=relation_file.read_bytes()
    relation_file.write_bytes(original_relations.replace(b'True',b'False',1))
    assert relation_file.read_bytes()!=original_relations
    output_manifest['outputSha256']['relations.csv']=sha(relation_file.read_bytes())
    output_manifest_path.write_text(json.dumps(output_manifest))
    reject('Relation CSV semantic column mismatch','python3',str(BASE/'validate-er.py'),*common)
    relation_file.write_bytes(original_relations);output_manifest['outputSha256']['relations.csv']=sha(original_relations)
    output_manifest_path.write_text(json.dumps(output_manifest))
    scripts=re.findall(r'<script>(.*?)</script>',(out/'index.html').read_text(),re.S)
    assert len(scripts)==2
    for script in scripts:
        check=subprocess.run(['node','--check'],input=script,text=True,capture_output=True)
        assert check.returncode==0,check.stderr
    broken=scripts[-1].replace(r'\n\n','\n\n')
    assert broken!=scripts[-1]
    assert subprocess.run(['node','--check'],input=broken,text=True,capture_output=True).returncode!=0
    html_file=out/'index.html';original_html=html_file.read_bytes()
    html_file.write_text(original_html.decode().replace(r'\n\n','\n\n'))
    output_manifest['outputSha256']['index.html']=sha(html_file.read_bytes())
    output_manifest_path.write_text(json.dumps(output_manifest))
    reject('Inline JavaScript syntax invalid','python3',str(BASE/'validate-er.py'),*common)
    html_file.write_bytes(original_html);output_manifest['outputSha256']['index.html']=sha(original_html)
    output_manifest_path.write_text(json.dumps(output_manifest))
    data=json.loads((out/'data.json').read_text())
    assert len(data['relations'])==3 and data['manifest']['models']==3
    assert [r['relationField'] for r in data['relations']]==['owner','reviewer','parent']
    owner,reviewer,parent=data['relations']
    assert owner['fk']==['left','right'] and owner['references']==['id','tenant'] and owner['unique'] and not owner['optional']
    assert reviewer['optional'] and not reviewer['unique'] and reviewer['relationName']=='Reviewer'
    assert parent['identifying'] and parent['unique']
    assert 'String id PK' in (out/'all.mmd').read_text() and 'String tenant PK' in (out/'all.mmd').read_text()
    assert 'String left FK' in (out/'all.mmd').read_text() and 'String right FK' in (out/'all.mmd').read_text()
    assert child['uniqueFields']==[['right','left']] and owner['fk']==['left','right'] and owner['references']==['id','tenant']
    assert 'reviewer_id' in (out/'entities.csv').read_text() and data['enums']['Status']['values'][1]['name']=='CLOSED'
    reject('Output must be a new path',*build) # Existing output may never be silently overwritten.
    original=(out/'all.mmd').read_text();(out/'all.mmd').write_text(original.replace('reviewerId','reversedId'))
    reject('Output hash mismatch', 'python3',str(BASE/'validate-er.py'),*common)
    (out/'all.mmd').write_text(original)
    evidence_file=root/evidence_path;original_evidence=evidence_file.read_bytes();evidence_file.write_text('changed caller\n')
    reject('Group map caller changed','python3',str(BASE/'build-er.py'),*['--root',str(root),'--input-dir',str(inp),'--out-dir',str(temp/'stale-caller'),'--date',DATE],'--mermaid-source',str(mermaid),'--group-map',str(groups))
    evidence_file.write_bytes(original_evidence)
    # A correctly hashed bundle can still be semantically stale; model names must match schema.
    dmmf_file=inp/'dmmf.json'; original_dmmf=dmmf_file.read_bytes(); changed=json.loads(original_dmmf)
    changed['models']=changed['models'][:-1]
    dmmf_file.write_text(json.dumps(changed)); old_dmmf_hash=manifest['filesSha256']['dmmf.json']; old_count=manifest['counts']['models']
    manifest['filesSha256']['dmmf.json']=sha(dmmf_file.read_bytes()); manifest['counts']['models']=2
    (inp/'manifest.json').write_text(json.dumps(manifest))
    reject('Schema and DMMF model/enum sets differ','python3',str(BASE/'build-er.py'),*['--root',str(root),'--input-dir',str(inp),'--out-dir',str(temp/'stale'),'--date',DATE],'--mermaid-source',str(mermaid),'--group-map',str(groups))
    dmmf_file.write_bytes(original_dmmf);manifest['filesSha256']['dmmf.json']=old_dmmf_hash;manifest['counts']['models']=old_count
    (inp/'manifest.json').write_text(json.dumps(manifest))
    services_file=root/'src/lib/services.ts'; original_services=services_file.read_text()
    services_file.write_text("import * as leaked from 'node:fs'\nexport const SERVICES = leaked\n")
    exporter=BASE/'export-er-inputs.cjs'
    typescript=dependency_root/'node_modules/typescript'
    if not typescript.exists():
        raise AssertionError('Local read-only TypeScript dependency unavailable for closure fixture')
    reject('Unknown/external service import','node','-e','require(process.argv[1]).readClosure(process.argv[2],require(process.argv[3]))',str(exporter),str(root),str(typescript))
    services_file.write_text(original_services)
    (root/'src/lib/services.ts').write_text('changed\n')
    second=temp/'second';bad=['--root',str(root),'--input-dir',str(inp),'--out-dir',str(second),'--date',DATE]
    reject('Source closure changed','python3',str(BASE/'build-er.py'),*bad,'--mermaid-source',str(mermaid),'--group-map',str(groups))
    services_file.write_text(original_services)
    node_modules=root/'node_modules';client=node_modules/'@prisma/client';generated=node_modules/'.prisma/client'
    client.mkdir(parents=True);generated.mkdir(parents=True)
    (node_modules/'typescript').symlink_to(typescript)
    prisma_package=dependency_root/'node_modules/prisma/package.json'
    if not prisma_package.exists(): raise AssertionError('Local read-only pinned Prisma formatter unavailable')
    prisma_version=json.loads(prisma_package.read_text())['version']
    (node_modules/'prisma').symlink_to(dependency_root/'node_modules/prisma')
    (client/'package.json').write_text(json.dumps({'name':'@prisma/client','version':prisma_version,'main':'default.js'}))
    (client/'default.js').write_text("module.exports = { ...require('.prisma/client/default') }\n")
    (generated/'default.js').write_text("module.exports = { ...require('.') }\n")
    export_schema='''generator client {\n provider = "prisma-client-js"\n}\ndatasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\nmodel Fixture {\n id String @id\n name String?\n}\n'''
    export_dmmf={'models':[{'name':'Fixture','dbName':None,'fields':[field('id','String',isId=True),field('name','String',required=False)],'uniqueFields':[],'primaryKey':None}],'enums':[]}
    (root/'prisma/schema.prisma').write_text(export_schema)
    command('git','add','prisma/schema.prisma',cwd=root)
    command('git','commit','-qm','valid exporter schema',cwd=root)
    export_commit=command('git','rev-parse','HEAD',cwd=root).strip()
    export_tree=command('git','rev-parse','HEAD^{tree}',cwd=root).strip()
    (generated/'index.js').write_text('module.exports = { Prisma: { dmmf: { datamodel: '+json.dumps(export_dmmf)+' } } }\n')
    (generated/'schema.prisma').write_text(export_schema)
    command('node',str(dependency_root/'node_modules/prisma/build/index.js'),'format','--schema',str(generated/'schema.prisma'),cwd=temp)
    assert sha((generated/'schema.prisma').read_bytes())!=sha(export_schema.encode())
    export_args=['node',str(exporter),'--root',str(root),'--out-dir',str(temp/'exported'),'--date',DATE,'--diagnostics-dir',str(temp/'positive-diagnostics')]
    exported=json.loads(command(*export_args))
    assert not (temp/'positive-diagnostics').exists()
    exported_manifest=json.loads((temp/'exported/manifest.json').read_text())
    assert exported['passed'] and exported['models']==1
    assert exported_manifest['sourceCommit']==export_commit and exported_manifest['sourceTree']==export_tree
    assert 'node_modules/.prisma/client/index.js' in exported_manifest['closureSha256']
    assert 'node_modules/prisma/build/index.js' in exported_manifest['closureSha256']
    assert exported_manifest['schemaSha256']==sha(export_schema.encode())
    assert exported_manifest['generatedClientSchemaSha256']==sha((generated/'schema.prisma').read_bytes())
    assert exported_manifest['formattedSourceSchemaSha256']==exported_manifest['formattedGeneratedClientSchemaSha256']
    assert json.loads((temp/'exported/dmmf.json').read_text())==export_dmmf
    assert json.loads((temp/'exported/service-registry.json').read_text())==[]
    reject('Expected --root, --out-dir, --date exactly once',*export_args,'--date',DATE)
    reject('Expected --root, --out-dir, --date exactly once',*export_args,'--diagnostics-dir',str(temp/'duplicate-diagnostics'))
    reject('Expected --root, --out-dir, --date exactly once',*export_args,'--unknown',str(temp/'unknown-diagnostics'))
    inside_link=temp/'inside-link';inside_link.symlink_to(root,target_is_directory=True)
    reject('ER output must be a new directory outside source checkout','node',str(exporter),'--root',str(root),'--out-dir',str(inside_link/'er'),'--date',DATE)
    def diagnostic_reject(path, out):
        reject('ER diagnostics must be a new independent directory outside source checkout',
               'node',str(exporter),'--root',str(root),'--out-dir',str(out),'--date',DATE,'--diagnostics-dir',str(path))
    (temp/'existing-diagnostics').mkdir()
    diagnostic_reject(temp/'existing-diagnostics',temp/'existing-case')
    diagnostic_reject(root/'inside-diagnostics',temp/'inside-case')
    diagnostic_reject(inside_link/'inside-diagnostics',temp/'symlink-parent-case')
    (temp/'symlink-diagnostics').symlink_to(temp/'existing-diagnostics',target_is_directory=True)
    diagnostic_reject(temp/'symlink-diagnostics',temp/'symlink-case')
    diagnostic_reject(temp/'same-case',temp/'same-case')
    (temp/'parent-case').mkdir()
    diagnostic_reject(temp/'parent-case',temp/'parent-case'/'bundle')
    services_file.write_text('dirty tracked change\n')
    reject('Tracked source is dirty before ER export','node',str(exporter),'--root',str(root),'--out-dir',str(temp/'dirty'),'--date',DATE)
    services_file.write_text(original_services)
    formatted_schema=(generated/'schema.prisma').read_bytes()
    (generated/'schema.prisma').write_bytes(formatted_schema+b'\n// stale client\n')
    diagnostic_dir=temp/'stale-diagnostics'
    stale_args=['node',str(exporter),'--root',str(root),'--out-dir',str(temp/'stale-client'),'--date',DATE,'--diagnostics-dir',str(diagnostic_dir)]
    sentinel='DOYA_ER_SENTINEL_DO_NOT_CAPTURE'
    stale_env={**os.environ,'ER_DIAGNOSTIC_SENTINEL':sentinel,'TMPDIR':str(temp)}
    stale=subprocess.run(stale_args,text=True,capture_output=True,env=stale_env)
    assert stale.returncode!=0 and 'Generated client formatted schema does not match repository formatted schema' in stale.stderr
    assert not (temp/'stale-client').exists()
    assert {p.name for p in diagnostic_dir.iterdir()}=={'source.raw.prisma','generated.raw.prisma','source.formatted.prisma','generated.formatted.prisma','manifest.json'}
    diag=json.loads((diagnostic_dir/'manifest.json').read_text())
    assert diag['kind']=='er-export-diagnostics-v1' and diag['passed'] is False and diag['errorStage']=='formatted_schema_mismatch'
    assert diag['code']=='ER_FORMATTED_SCHEMAS_DIFFER'
    assert diag['sourceCommit']==export_commit and diag['sourceTree']==export_tree
    assert diag['versions']['prismaClient']==prisma_version and diag['versions']['prismaFormatter']==prisma_version
    assert (diagnostic_dir/'source.raw.prisma').read_bytes()==export_schema.encode()
    assert (diagnostic_dir/'generated.raw.prisma').read_bytes()==formatted_schema+b'\n// stale client\n'
    for side in ['source','generated']:
        assert diag['schemas'][side]['formatSucceeded'] is True
        for kind in ['raw','formatted']:
            body=(diagnostic_dir/f'{side}.{kind}.prisma').read_bytes()
            assert diag['schemas'][side][kind]=={'sha256':sha(body),'size':len(body)}
    assert diag['schemas']['source']['formatted']['sha256']!=diag['schemas']['generated']['formatted']['sha256']
    assert 'node_modules/.prisma/client/index.js' in diag['inputSha256']
    assert all(sentinel.encode() not in p.read_bytes() for p in diagnostic_dir.iterdir())
    (generated/'schema.prisma').write_bytes(formatted_schema)
    (generated/'schema.prisma').write_bytes(formatted_schema.replace(b'name String?',b'name String @default("x")'))
    reject('Generated client formatted schema does not match repository formatted schema','node',str(exporter),'--root',str(root),'--out-dir',str(temp/'attribute-drift'),'--date',DATE)
    (generated/'schema.prisma').write_bytes(formatted_schema)
    (generated/'schema.prisma').write_bytes(formatted_schema.replace(b'model Fixture {',b'/// changed documentation\nmodel Fixture {'))
    reject('Generated client formatted schema does not match repository formatted schema','node',str(exporter),'--root',str(root),'--out-dir',str(temp/'comment-drift'),'--date',DATE)
    (generated/'schema.prisma').write_bytes(formatted_schema)
    (generated/'schema.prisma').write_text('model Broken {\n this is invalid\n}\n')
    format_dir=temp/'format-diagnostics'
    before_temp={p.name for p in temp.iterdir() if p.name.startswith('doya-er-format-')}
    reject('Pinned Prisma schema formatter failed','node',str(exporter),'--root',str(root),'--out-dir',str(temp/'formatter-fail'),'--date',DATE,'--diagnostics-dir',str(format_dir),env={**os.environ,'TMPDIR':str(temp)})
    after_temp={p.name for p in temp.iterdir() if p.name.startswith('doya-er-format-')}
    assert after_temp==before_temp
    assert not (temp/'formatter-fail').exists()
    assert {p.name for p in format_dir.iterdir()}=={'source.raw.prisma','generated.raw.prisma','source.formatted.prisma','manifest.json'}
    format_diag=json.loads((format_dir/'manifest.json').read_text())
    assert format_diag['errorStage']=='format_generated' and format_diag['passed'] is False
    assert format_diag['code']=='ER_GENERATED_FORMAT_FAILED'
    assert format_diag['schemas']['source']['formatSucceeded'] is True and format_diag['schemas']['generated']['formatSucceeded'] is False
    assert format_diag['schemas']['generated']['formatted'] is None
    (generated/'schema.prisma').write_bytes(formatted_schema)
    services_file.write_text("import { EXTRA } from './untracked'\nexport const SERVICES = EXTRA\nexport const RETIRED_SERVICE_IDS = new Set()\nexport function getPublicServices(){return SERVICES}\n")
    command('git','add','src/lib/services.ts',cwd=root)
    command('git','commit','-qm','tracked importer',cwd=root)
    (root/'src/lib/untracked.ts').write_text('export const EXTRA = []\n')
    assert command('git','status','--porcelain','--untracked-files=no',cwd=root).strip()==''
    reject('Source closure is not present in HEAD: src/lib/untracked.ts','node',str(exporter),'--root',str(root),'--out-dir',str(temp/'untracked-relative'),'--date',DATE)
    print(json.dumps({'passed':True,'valid':json.loads(good)['passed'],'models':3,'orderedRelations':3,'exporterPositive':True,'negativeCases':['invalid_inline_js','entity_csv_semantic_with_rehashed_output','relation_csv_semantic_with_rehashed_output','output_collision','missing_or_reversed_mermaid_field','caller_evidence_drift','stale_dmmf_model_set','unknown_external_service_import','service_closure_drift','duplicate_export_arg','symlink_output_inside_root','initial_dirty_tracked_source','stale_generated_schema','generated_attribute_drift','generated_comment_drift','formatter_failure','untracked_relative_import','diagnostic_path_boundary','diagnostic_mismatch_capture','diagnostic_partial_formatter_capture','diagnostic_env_sentinel'],'scope':'Synthetic small schema and client only; current 246-model DMMF not exported or accepted.'}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--dependency-root',type=pathlib.Path,required=True)
    main(parser.parse_args().dependency_root.resolve())
