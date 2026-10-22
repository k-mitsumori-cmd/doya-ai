import datetime
import json
import os
import pathlib
import shutil
import subprocess
import uuid

bins = [pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])] if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'), *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'), reverse=True)]
pg = next((candidate for candidate in bins if (candidate / 'initdb').is_file() and (candidate / 'pg_ctl').is_file()), None)
if pg is None:
    raise SystemExit('Isolated PostgreSQL binaries unavailable')
folder = pathlib.Path('/tmp') / ('doya-r1-three-' + uuid.uuid4().hex[:8])
folder.mkdir(mode=0o700)
(folder / 'socket').mkdir(mode=0o700)
env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
port = 56591
started = False
report = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scope': 'Owned ephemeral Unix socket PostgreSQL, synthetic data and mail only; no provider or production connection', 'privateRoot': str(folder)}
try:
    with (folder / 'init.log').open('w') as log:
        subprocess.run([str(pg / 'initdb'), '-D', str(folder / 'data'), '-U', 'doya_r1_three', '--auth=trust', '--no-locale', '--encoding=UTF8'], env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-o', '-k ' + str(folder / 'socket') + " -h '' -p " + str(port) + ' -F -c timezone=UTC', '-l', str(folder / 'server.log'), '-w', 'start'], env=env, stdout=subprocess.DEVNULL, check=True)
    started = True
    child = {**env, 'DOYA_R1_THREE_PG_ROOT': str(folder), 'DOYA_R1_THREE_PG_SOCKET': str(folder / 'socket'), 'DOYA_R1_THREE_PG_PORT': str(port)}
    result = subprocess.run(['node', 'scripts/security-regression/verify-r1-three-membership-postgres.cjs'], env=child, timeout=180)
    report['testExitCode'] = result.returncode
finally:
    if started:
        stop = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-m', 'fast', '-w', 'stop'], env=env, stdout=subprocess.DEVNULL)
        report['stopExitCode'] = stop.returncode
    report['endedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    if report.get('stopExitCode') == 0:
        shutil.rmtree(folder)
    report['removedOwnedDirectory'] = not folder.exists()
    print(json.dumps(report))
if report.get('testExitCode') != 0 or report.get('stopExitCode') != 0 or not report['removedOwnedDirectory']:
    raise SystemExit(1)
