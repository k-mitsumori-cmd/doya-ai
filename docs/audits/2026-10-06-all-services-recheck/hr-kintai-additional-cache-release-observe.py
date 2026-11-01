import pathlib,subprocess,json,datetime,time,os
base=pathlib.Path(__file__).parent;path=base/'hr-kintai-additional-cache-release-tracking.json'
state=json.loads(path.read_text());commit=state['commit'];gh='/opt/homebrew/bin/gh';vc='/Users/mitsumori_katsuki/.npm-global/bin/vercel'
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def save():path.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n')
def run(args):
 p=subprocess.run(args,capture_output=True,text=True,timeout=50)
 try:payload=json.loads(p.stdout)
 except ValueError:raise RuntimeError('Read-only observation returned no JSON: '+args[0])
 # Vercel inspect exits1 for an ERROR deployment while returning its valid state.
 if p.returncode and not (args[0]==vc and payload.get('readyState') in ['ERROR','CANCELED']):raise RuntimeError('Read-only observation command failed: '+args[0])
 return payload
state.update(observerStatus='running',observerPid=os.getpid(),observerStartedAt=stamp());save()
while True:
 try:
  runs=run([gh,'run','list','--repo','k-mitsumori-cmd/doya-ai','--commit',commit,'--workflow','ci.yml','--json','databaseId,status,conclusion,headSha'])
  ci=next(r for r in runs if r['headSha']==commit)
  ds=run([vc,'list','doya-ai','--scope','surisutas-projects','--format','json'])
  listed=next(d for d in ds['deployments'] if d.get('meta',{}).get('githubCommitSha')==commit and d.get('target')=='production')
  d=run([vc,'inspect',listed['url'],'--scope','surisutas-projects','--format','json'])
  assert d['url']==listed['url'] and d['target']=='production'
  state.update(checkedAt=stamp(),ci=ci,deployment={'id':d['id'],'url':d['url'],'readyState':d['readyState'],'commit':commit,'target':'production'});state.pop('observationError',None);save()
  if ci['status']=='completed' and ci['conclusion']!='success' or d['readyState'] in ['ERROR','CANCELED']:
   state.update(observerStatus='failed',observerEndedAt=stamp());save();raise SystemExit(1)
  if ci['status']=='completed' and ci['conclusion']=='success' and d['readyState']=='READY':
   p=subprocess.run(['python3',str(base/'verify-hr-kintai-additional-cache-public.py'),d['id'],commit],timeout=180)
   state.update(observerStatus='passed' if p.returncode==0 else 'failed',publicVerificationExitCode=p.returncode,observerEndedAt=stamp());save();raise SystemExit(p.returncode)
 except (RuntimeError,subprocess.TimeoutExpired,StopIteration,AssertionError,ValueError,KeyError) as err:
  state.update(observationError=type(err).__name__,observationErrorAt=stamp());save()
 time.sleep(45)
