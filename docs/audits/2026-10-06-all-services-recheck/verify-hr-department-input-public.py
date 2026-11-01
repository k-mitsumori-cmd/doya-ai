import sys, subprocess, pathlib, json, datetime
base=pathlib.Path(__file__).parent
marker,commit=sys.argv[1:3]
subprocess.run(['python3',str(base/'verify-hr-org-chart-pagination-public.py'),marker,commit],check=True)
prior=json.loads((base/'hr-org-chart-pagination-public.json').read_text())
assert prior['passed'] and prior['commit']==commit and prior['deployment']==marker
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'deployment':marker,'passed':True,'inheritedPublicProof':'hr-org-chart-pagination-public.json','scope':'Exact deployment identity, inherited17-service/static/SEO/banner/cache/org-chart page checks and anonymous private401. Mutation/input/locking behavior is verified separately in synthetic authenticated actualNext53 and realPG47, not exercised against production/customer data. Settings durable-create repair and whole17-service2074criterion188GET audit remain incomplete.'}
(base/'hr-department-input-public.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
