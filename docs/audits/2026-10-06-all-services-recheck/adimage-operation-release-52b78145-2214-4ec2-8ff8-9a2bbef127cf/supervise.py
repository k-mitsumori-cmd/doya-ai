import os,pathlib,json,hashlib,subprocess,datetime
base=pathlib.Path(__file__).parent
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def snapshot():
 files=set()
 for root in ['src','seo','prisma','scripts','.github']:
  p=pathlib.Path(root)
  if p.exists(): files.update(x for x in p.rglob('*') if x.is_file() and not any(y in ['node_modules','.git','.next'] for y in x.parts))
 files.update(x for x in pathlib.Path('.').iterdir() if x.is_file() and x.suffix in ['.json','.js','.mjs','.cjs','.ts'] and not x.name.endswith('tsbuildinfo'))
 files.update(pathlib.Path('docs/audits/2026-10-06-all-services-recheck')/name for name in ['verify-doyaslide-operation-postgres.cjs','doyaslide-operation-postgres-supervise.py','verify-adimage-operation-postgres.cjs','verify-adimage-operation-helper-postgres.cjs','adimage-operation-helper-postgres-supervise.py','verify-adimage-operation-api-postgres.cjs','adimage-operation-api-postgres-supervise.py','verify-adimage-operation-native.cjs'])
 return {str(x):hashlib.sha256(x.read_bytes()).hexdigest() for x in sorted(files)}
manifest=snapshot();(base/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');state={'startedAt':now(),'pid':os.getpid(),'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'sourceFiles':len(manifest),'status':'running','gates':[]}
def save(): (base/'state.json').write_text(json.dumps(state,indent=2)+'\n')
save();environment={**os.environ,'NODE_ENV':'production'}
for name,args in [('private-postgres',['python3','docs/audits/2026-10-06-all-services-recheck/doyaslide-operation-postgres-supervise.py']),('adimage-helper-postgres',['python3','docs/audits/2026-10-06-all-services-recheck/adimage-operation-helper-postgres-supervise.py']),('adimage-api-postgres',['python3','docs/audits/2026-10-06-all-services-recheck/adimage-operation-api-postgres-supervise.py']),('build',['npm','run','build']),('lint',['npm','run','lint']),('native-chrome',['node','docs/audits/2026-10-06-all-services-recheck/verify-adimage-operation-native.cjs'])]:
 with (base/(name+'.log')).open('w') as out: result=subprocess.run(args,stdout=out,stderr=subprocess.STDOUT,env=environment)
 state['gates'].append({'name':name,'exitCode':result.returncode,'endedAt':now()});save()
 if result.returncode:break
current=snapshot();state['changedSources']=[x for x in sorted(set(manifest)|set(current)) if manifest.get(x)!=current.get(x)];state['status']='passed' if len(state['gates'])==6 and all(x['exitCode']==0 for x in state['gates']) and not state['changedSources'] else 'failed';state['endedAt']=now();save();print(json.dumps(state));raise SystemExit(0 if state['status']=='passed' else 1)
