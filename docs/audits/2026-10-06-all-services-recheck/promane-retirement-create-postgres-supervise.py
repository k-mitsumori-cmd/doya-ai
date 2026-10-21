import datetime
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import uuid

BASE = pathlib.Path('docs/audits/2026-10-06-all-services-recheck')
PIN = pathlib.Path('scripts/security-regression/fixtures/promane-r1-46a9/manifest.json')
BASE_COMMIT = '46a9e4fc4a93f49fa3cd2157252aa6cf5ee69006'
BASE_TREE = 'c32d6d1becb58c0c3f9c670bca0ae38c027e26f4'
phase = os.environ.get('DOYA_PROMANE_R1_EXPECT', 'after')
if phase not in ('before', 'after'):
    raise SystemExit('DOYA_PROMANE_R1_EXPECT must be before or after')

candidates = ([pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])]
              if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else
              [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'),
               *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'),
                       key=lambda item: int(item.parent.name), reverse=True)])
pg = next((item for item in candidates if (item / 'initdb').is_file() and (item / 'pg_ctl').is_file()), None)
if pg is None:
    raise SystemExit('PostgreSQL initdb/pg_ctl not installed; private operation regression cannot run')

folder = pathlib.Path('/tmp') / ('doya-sfa-authority-' + uuid.uuid4().hex[:8])
folder.mkdir(mode=0o700, exist_ok=False)
(folder / 'socket').mkdir(mode=0o700)
port = 56481
env = {key: value for key, value in os.environ.items() if not key.startswith('PG') and key != 'DOYA_TEST_BASELINE'}
report = pathlib.Path(env.get('DOYA_PROMANE_R1_SUPERVISOR', str(BASE / 'promane-retirement-create-postgres-supervisor.json')))
state = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
         'pid': os.getpid(), 'privateFolder': str(folder), 'phase': phase, 'status': 'running'}
report.write_text(json.dumps(state, indent=2) + '\n')
started = False

try:
    if phase == 'before':
        manifest = json.loads(PIN.read_text())
        if (manifest.get('baseCommit') != BASE_COMMIT or manifest.get('baseTree') != BASE_TREE
                or len(manifest.get('entries', {})) != 18):
            raise ValueError('Pinned before-source manifest does not describe exact 46a9 inputs')
        baseline = folder / 'baseline'
        pinned = 0
        for name, entry in manifest['entries'].items():
            stable = pathlib.Path(entry['dataPath']) if entry['source'] == 'pinned' else pathlib.Path(name)
            if hashlib.sha256(stable.read_bytes()).hexdigest() != entry['sha256']:
                raise ValueError('Pinned before-source input changed: ' + name)
            if entry['source'] == 'pinned':
                pinned += 1
                target = baseline / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(stable.read_bytes())
                if hashlib.sha256(target.read_bytes()).hexdigest() != entry['sha256']:
                    raise ValueError('Pinned before-source materialization changed: ' + name)
        if pinned != 3:
            raise ValueError('Expected exactly three pinned old runtime blobs')
        env['DOYA_TEST_BASELINE'] = str(baseline.resolve())
        state['baseCommit'] = BASE_COMMIT
        state['baselineManifestSha256'] = hashlib.sha256(PIN.read_bytes()).hexdigest()

    with (folder / 'init.log').open('w') as output:
        subprocess.run([str(pg / 'initdb'), '-D', str(folder / 'data'), '-U', 'doya_sfa',
                        '--auth=trust', '--no-locale', '--encoding=UTF8'],
                       env=env, stdout=output, stderr=subprocess.STDOUT, check=True)
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'),
                    '-o', "-k " + str(folder / 'socket') + " -h '' -p " + str(port) + ' -F -c timezone=UTC',
                    '-l', str(folder / 'server.log'), '-w', 'start'],
                   env=env, stdout=subprocess.DEVNULL, check=True)
    started = True
    child_env = {**env, 'DOYA_SFA_AUTHORITY_PG_SOCKET': str(folder / 'socket'),
                 'DOYA_SFA_AUTHORITY_PG_PORT': str(port)}
    probe_log = pathlib.Path(env.get('DOYA_PROMANE_R1_PROBE_LOG', str(BASE / 'promane-retirement-create-postgres.log')))
    with probe_log.open('w') as output:
        result = subprocess.run(['node', str(BASE / 'verify-promane-retirement-create-postgres.cjs')],
                                env=child_env, stdout=output, stderr=subprocess.STDOUT, timeout=300)
    evidence = pathlib.Path(env.get('DOYA_PROMANE_R1_EVIDENCE', str(BASE / 'promane-retirement-create-postgres-results.json')))
    proof = json.loads(evidence.read_text()) if evidence.exists() else {}
    expected = 2 if phase == 'before' else 18
    source_hashes = proof.get('sourceHashes', {})
    manifest = json.loads(PIN.read_text())
    expected_source_paths = {
        (entry['dataPath'] if phase == 'before' and entry['source'] == 'pinned' else name)
        for name, entry in manifest['entries'].items()
    } | {str(PIN), str(BASE / 'verify-promane-retirement-create-postgres.cjs')}
    evidence_valid = (
        proof.get('passed') == expected and proof.get('expected') == expected
        and len(proof.get('observed', [])) == 2
        and len(proof.get('cases', [])) == (0 if phase == 'before' else 16)
        and len(proof.get('lockWaitEvidence', [])) == (0 if phase == 'before' else 6)
        and proof.get('phase') == ('before_gap_observed' if phase == 'before' else 'after_guard_verified')
        and proof.get('baseCommit') == (BASE_COMMIT if phase == 'before' else None)
        and proof.get('checkedAt', '') >= state['startedAt']
        and set(source_hashes) == expected_source_paths
        and all(pathlib.Path(path).is_file() and hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest() == digest
                for path, digest in source_hashes.items())
    )
    state.update(probeExitCode=result.returncode, evidenceValid=evidence_valid,
                 status='passed' if result.returncode == 0 and evidence_valid else 'failed')
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
    report.write_text(json.dumps(state, indent=2) + '\n')
    print(json.dumps(state))

if state['status'] != 'passed' or state.get('stopExitCode') != 0 or state.get('postStopStatusExitCode') != 3 or not state.get('privateFolderRemoved'):
    raise SystemExit(1)
