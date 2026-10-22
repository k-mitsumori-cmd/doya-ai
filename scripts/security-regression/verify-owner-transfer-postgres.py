"""Run the OWNER-T1 probe against an owned private Unix-socket PostgreSQL cluster."""
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import uuid

PROBE = pathlib.Path('docs/audits/2026-10-06-all-services-recheck/verify-owner-transfer-postgres.cjs')
evidence_dir = pathlib.Path(os.environ.get('DOYA_OWNER_T1_EVIDENCE_DIR', 'docs/audits/2026-10-06-all-services-recheck'))
evidence_dir.mkdir(parents=True, exist_ok=True)
result_file = evidence_dir / 'owner-transfer-postgres-results.json'
supervisor_file = evidence_dir / 'owner-transfer-postgres-supervisor.json'
probe_log = evidence_dir / 'owner-transfer-postgres.log'

candidates = ([pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])]
              if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else
              [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'),
               *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'),
                       key=lambda item: int(item.parent.name), reverse=True)])
pg = next((item for item in candidates if (item / 'initdb').is_file() and (item / 'pg_ctl').is_file()), None)
if pg is None:
    raise SystemExit('Private PostgreSQL binaries unavailable')

folder = pathlib.Path('/tmp') / ('doya-owner-t1-' + uuid.uuid4().hex[:8])
folder.mkdir(mode=0o700, exist_ok=False)
(folder / 'socket').mkdir(mode=0o700)
port = 56482
env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
state = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'privateFolder': str(folder), 'status': 'running'}
supervisor_file.write_text(json.dumps(state, indent=2) + '\n')
started = False
try:
    with (folder / 'init.log').open('w') as output:
        subprocess.run([str(pg / 'initdb'), '-D', str(folder / 'data'), '-U', 'doya_owner', '--auth=trust',
                        '--no-locale', '--encoding=UTF8'], env=env, stdout=output, stderr=subprocess.STDOUT, check=True)
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'),
                    '-o', "-k " + str(folder / 'socket') + " -h '' -p " + str(port) + ' -F -c timezone=UTC',
                    '-l', str(folder / 'server.log'), '-w', 'start'], env=env, stdout=subprocess.DEVNULL, check=True)
    started = True
    child_env = {**env, 'DOYA_OWNER_T1_PG_SOCKET': str(folder / 'socket'),
                 'DOYA_OWNER_T1_PG_PORT': str(port), 'DOYA_OWNER_T1_EVIDENCE': str(result_file)}
    with probe_log.open('w') as output:
        result = subprocess.run(['node', str(PROBE)], env=child_env, stdout=output,
                                stderr=subprocess.STDOUT, timeout=360)
    proof = json.loads(result_file.read_text()) if result_file.exists() else {}
    expected = {
        'shodan: atomic transfer and historical replay', 'aio: atomic transfer and historical replay',
        'quote: atomic transfer and historical replay', 'mensetsu: atomic transfer and historical replay',
        'aishodan: atomic transfer and historical replay', 'cancel before transfer and replay after downgrade',
        'shodan: sole owner retirement preflight remains available',
        'aio: sole owner retirement preflight remains available',
        'quote: sole owner retirement preflight remains available',
        'mensetsu: sole owner retirement preflight remains available',
        'aishodan: sole owner retirement preflight remains available',
        'plan drift, malformed receipt and rollback', 'same UUID independent service scope',
        'same UUID in billing lifecycle family leaves both exact receipt keys independent',
        'forced equal advisory value serializes without aliasing exact receipts',
        'pending target: confirmation fails without mutation',
        'rebound target: confirmation fails without mutation',
        'changed target role: confirmation fails without mutation',
        'missing target User: confirmation fails without mutation',
        'missing owner: confirmation fails without mutation',
        'same operation with different target confirmation is rejected after commit',
        'same UUID in other actor and organization has independent compound receipt',
        'current User.plan alias remains exact in confirmation and unknown plan fails closed',
        'old: retirement fence rejects transfer without role or receipt mutation',
        'new: retirement fence rejects transfer without role or receipt mutation',
        'retirement guard applies only to new missing cancel write',
        'failed second role update rolls back first update and receipt',
        'failed first role update leaves both roles and receipt unchanged',
        'receipt insert fault rolls back both role updates',
        'different operation IDs competing for one owner have one winner',
        'cancel-first: actual operation lock serializes one terminal receipt',
        'transfer-first: actual operation lock serializes one terminal receipt',
        'old: retirement-first actual User wait rejects transfer',
        'new: retirement-first actual User wait rejects transfer',
        'old: transfer-first actual User wait observes committed roles',
        'new: transfer-first actual User wait observes committed roles',
    }
    hashes = proof.get('sourceHashes', {})
    evidence_valid = (
        result.returncode == 0 and proof.get('passed') == len(expected) and set(proof.get('cases', [])) == expected
        and len(proof.get('waits', [])) == 6
        and {row.get('name') for row in proof.get('waits', [])} == {
            'old retirement-first', 'new retirement-first', 'old transfer-first', 'new transfer-first',
            'cancel-first contender', 'transfer-first contender'}
        and len(proof.get('operationWaits', [])) == 2
        and {row.get('name') for row in proof.get('operationWaits', [])} == {'cancel-first', 'transfer-first'}
        and len(proof.get('collisionWaits', [])) == 1
        and proof['collisionWaits'][0].get('holderPid') != proof['collisionWaits'][0].get('waiterPid')
        and proof.get('checkedAt', '') >= state['startedAt'] and len(hashes) == 8
        and all(pathlib.Path(name).is_file() and hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest() == digest
                for name, digest in hashes.items()))
    state.update(probeExitCode=result.returncode, evidenceValid=evidence_valid,
                 status='passed' if evidence_valid else 'failed')
except Exception as error:
    state.update(status='failed', errorType=type(error).__name__, error=str(error))
finally:
    if started:
        stop = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-m', 'fast', '-w', 'stop'],
                              env=env, stdout=subprocess.DEVNULL)
        state['stopExitCode'] = stop.returncode
        status = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), 'status'],
                                env=env, stdout=subprocess.DEVNULL)
        state['postStopStatusExitCode'] = status.returncode
        if stop.returncode == 0 and status.returncode == 3:
            shutil.rmtree(folder)
            state['privateFolderRemoved'] = not folder.exists()
    elif folder.exists():
        shutil.rmtree(folder)
        state['privateFolderRemoved'] = not folder.exists()
    state['endedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    supervisor_file.write_text(json.dumps(state, indent=2) + '\n')
    print(json.dumps(state))

if state['status'] != 'passed' or state.get('stopExitCode') != 0 or state.get('postStopStatusExitCode') != 3 or not state.get('privateFolderRemoved'):
    raise SystemExit(1)
