"""Owned Unix-socket PostgreSQL for the C1 subscription operation matrix."""
import datetime
import json
import os
import pathlib
import shutil
import subprocess
import uuid

bins = ([pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])] if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN')
        else [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'),
              *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'), reverse=True)])
pg = next((p for p in bins if (p / 'initdb').is_file() and (p / 'pg_ctl').is_file()), None)
if pg is None:
    raise SystemExit('Isolated PostgreSQL binaries unavailable')
folder = pathlib.Path('/tmp') / ('doya-subscription-' + uuid.uuid4().hex[:8])
folder.mkdir(mode=0o700, exist_ok=False)
(folder / 'socket').mkdir(mode=0o700, exist_ok=False)
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
started = False
report = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'scope': 'Owned ephemeral Unix socket PostgreSQL, synthetic User and provider only',
          'privateRoot': str(folder)}
try:
    with (folder / 'init.log').open('w') as log:
        subprocess.run([str(pg / 'initdb'), '-D', str(folder / 'data'), '-U', 'doya_subscription',
                        '--auth=trust', '--no-locale', '--encoding=UTF8'], env=env,
                       stdout=log, stderr=subprocess.STDOUT, check=True)
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'),
                    '-o', "-k " + str(folder / 'socket') + " -h '' -p 56590 -F -c timezone=UTC",
                    '-l', str(folder / 'server.log'), '-w', 'start'], env=env,
                   stdout=subprocess.DEVNULL, check=True)
    started = True
    child = {**env, 'DOYA_SUBSCRIPTION_PG_ROOT': str(folder),
             'DOYA_SUBSCRIPTION_PG_SOCKET': str(folder / 'socket'), 'DOYA_SUBSCRIPTION_PG_PORT': '56590'}
    result = subprocess.run(['node', 'scripts/security-regression/verify-subscription-operation-postgres.cjs'],
                            env=child, timeout=180)
    report['testExitCode'] = result.returncode
finally:
    if started:
        stop = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-m', 'fast', '-w', 'stop'],
                              env=env, stdout=subprocess.DEVNULL)
        report['stopExitCode'] = stop.returncode
    report['endedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    evidence_dir = os.environ.get('DOYA_SUBSCRIPTION_EVIDENCE_DIR')
    if evidence_dir:
        target = pathlib.Path(evidence_dir)
        target.mkdir(parents=True, exist_ok=True)
        for name in ('init.log', 'server.log'):
            if (folder / name).is_file():
                shutil.copy2(folder / name, target / name)
    if not started or report.get('stopExitCode') == 0:
        shutil.rmtree(folder)
    report['removedOwnedDirectory'] = not folder.exists()
    if evidence_dir:
        (target / 'subscription-postgres-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
if report.get('testExitCode') != 0 or report.get('stopExitCode') != 0 or not report['removedOwnedDirectory']:
    raise SystemExit(1)
