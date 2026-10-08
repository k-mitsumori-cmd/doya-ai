import pathlib,json,hashlib,subprocess,datetime,os,ast,re,shutil
base=pathlib.Path((pathlib.Path(__file__).parent/'hr-kintai-additional-cache-current-gate.txt').read_text().strip())
state=json.loads((base/'state.json').read_text());assert state['status']=='failed' and len(state['gates'])==130 and state['gates'][-1]['name']=='doyalist-next' and state['gates'][-1]['exitCode']==1
assert all(x['exitCode']==0 for x in state['gates'][:-1]) and state['changedSources']==[]
try:os.kill(state['pid'],0)
except ProcessLookupError:pass
else:raise AssertionError('Original gate must be authoritatively stopped before configuration repair')
manifest=json.loads((base/'source-manifest.json').read_text())
source=(base/'supervise.py').read_text();namespace={'__file__':str((base/'supervise.py').resolve())}
exec(source.split('manifest=snapshot()')[0],namespace)
assert namespace['snapshot']()==manifest
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==state['head']
tree=ast.parse(source);loop=next(node for node in tree.body if isinstance(node,ast.For) and isinstance(node.target,ast.Tuple) and [x.id for x in node.target.elts]==['name','args'])
sequence=ast.literal_eval(loop.iter);assert len(sequence)==150
assert [x['name'] for x in state['gates']]==[name for name,args in sequence[:130]]
cleanup=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='cleanup_stopped_probe')
namespace.update(base=base.resolve(),pathlib=pathlib,json=json,re=re,subprocess=subprocess,shutil=shutil)
exec(compile(ast.Module(body=[cleanup],type_ignores=[]),str(base/'supervise.py'),'exec'),namespace)
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
state['gateResumeHistory']=[{'checkedAt':now(),'originalStoppedPid':state['pid'],'originalGates':130,'retainedPassingGates':129,'rerunFrom':'doyalist-next','cause':'Wrong inherited DOYA_FROZEN_GATE_POINTER referenced old SEO snapshot','sourceManifestUnchanged':True,'configurationOnly':True,'configurationOverride':'DOYA_FROZEN_GATE_POINTER points to current HR/Kintai gate; original supervisor remains frozen unchanged','oldEvidence':'before-frozen-pointer-repair','supervisorHash':hashlib.sha256(source.encode()).hexdigest()}]
state.update(pid=os.getpid(),status='running',gates=state['gates'][:-1]);state.pop('endedAt',None)
def save():(base/'state.json').write_text(json.dumps(state,indent=2)+'\n')
save();environment={**os.environ,'NODE_ENV':'production','DOYA_FROZEN_GATE_POINTER':str((pathlib.Path(__file__).parent/'hr-kintai-additional-cache-current-gate.txt').resolve())}
for name,args in sequence[129:]:
 assert namespace['snapshot']()==manifest
 with (base/(name+'.log')).open('w') as out:result=subprocess.run(args,stdout=out,stderr=subprocess.STDOUT,env=environment)
 state['gates'].append({'name':name,'exitCode':result.returncode,'endedAt':now()});save()
 if result.returncode:break
 namespace['cleanup_stopped_probe'](name)
current=namespace['snapshot']();state['changedSources']=[p for p in sorted(set(manifest)|set(current)) if manifest.get(p)!=current.get(p)]
state.update(status='passed' if len(state['gates'])==150 and all(x['exitCode']==0 for x in state['gates']) and not state['changedSources'] else 'failed',endedAt=now());save()
print(json.dumps({'status':state['status'],'gates':len(state['gates']),'changedSources':state['changedSources'],'retained129':True}));raise SystemExit(0 if state['status']=='passed' else 1)
