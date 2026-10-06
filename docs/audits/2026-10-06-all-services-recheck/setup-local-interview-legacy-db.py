import tempfile,pathlib,subprocess,json,os
root=pathlib.Path(tempfile.mkdtemp(prefix='doya-il-qa-',dir='/tmp')).resolve();os.chmod(root,0o700)
socket=root/'socket';socket.mkdir(mode=0o700);data=root/'data';bin=pathlib.Path('/opt/homebrew/opt/postgresql@17/bin')
with (root/'init.log').open('w') as out:subprocess.run([str(bin/'initdb'),'-D',str(data),'-U','doya_qa','-A','trust','--no-locale'],stdout=out,stderr=subprocess.STDOUT,check=True)
subprocess.run([str(bin/'pg_ctl'),'-D',str(data),'-l',str(root/'postgres.log'),'-o',"-F -c listen_addresses='' -k "+str(socket)+' -p 56477','start','-w'],check=True)
d={'root':str(root),'data':str(data),'socket':str(socket),'port':56477,'url':'postgresql://doya_qa@localhost:56477/postgres?host='+str(socket)}
pathlib.Path('/tmp/doya-local-interview-legacy-db-20261006.json').write_text(json.dumps(d,indent=2)+'\n')
print(json.dumps({'started':True,'tcpListening':False}))
