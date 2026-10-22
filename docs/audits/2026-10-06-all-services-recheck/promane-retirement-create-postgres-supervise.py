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
COMPAT = pathlib.Path('scripts/security-regression/fixtures/promane-schema-compat')
OLD_SCHEMA = COMPAT / 'legacy-schema.prisma.txt'
CONTRACT = COMPAT / 'model-contract.json'
CHECK = COMPAT / 'verify-contract.cjs'
CURRENT_SCHEMA = '12e8a7da80d07b572d2e2c52c1efc52fe9a424e9f8befbb6a21f11bf86609f49'
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
    manifest = json.loads(PIN.read_text())
    if (manifest.get('baseCommit') != BASE_COMMIT or manifest.get('baseTree') != BASE_TREE
            or len(manifest.get('entries', {})) != 18):
        raise ValueError('Pinned before-source manifest does not describe exact 46a9 inputs')
    old = manifest['entries']['prisma/schema.prisma']
    if (old.get('source') != 'pinned-data' or old.get('dataPath') != str(OLD_SCHEMA)
            or old['sha256'] != '7e8359729a998a68b5ebb9e336ea65cf5aed3f82abc4ab3712238d5d1c995964'
            or hashlib.sha256(OLD_SCHEMA.read_bytes()).hexdigest() != old['sha256']):
        raise ValueError('Historical schema data changed')
    if hashlib.sha256(pathlib.Path('prisma/schema.prisma').read_bytes()).hexdigest() != CURRENT_SCHEMA:
        raise ValueError('Current execution schema changed')
    if phase == 'before':
        baseline = folder / 'baseline'
        pinned = 0
        for name, entry in manifest['entries'].items():
            stable = pathlib.Path(entry['dataPath']) if entry['source'] in ('pinned', 'pinned-data') else pathlib.Path(name)
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

    for name, entry in manifest['entries'].items():
        if entry['source'] == 'pinned' and (len(entry.get('afterSha256', '')) != 64 or
                                           entry['afterSha256'] == entry['sha256']):
            raise ValueError('Pinned old runtime needs a distinct current after SHA: ' + name)
    # The old schema is inert provenance. Current generated Prisma supplies all DDL
    # and queries; all 33 required models must retain their complete DMMF shape.
    source_names = {
        (str(baseline / name) if phase == 'before' and entry['source'] == 'pinned' else
         entry['dataPath'] if phase == 'before' and entry['source'] == 'pinned-data' else name): name
        for name, entry in manifest['entries'].items()
    }
    extras = [str(PIN), str(BASE / 'verify-promane-retirement-create-postgres.cjs'),
              str(BASE / 'promane-retirement-create-postgres-supervise.py'),
              str(OLD_SCHEMA), str(CONTRACT), str(CHECK),
              'prisma/schema.prisma', 'package.json', 'package-lock.json',
              'node_modules/.prisma/client/schema.prisma', 'node_modules/.prisma/client/index.js',
              'node_modules/.prisma/client/default.js', 'node_modules/@prisma/client/default.js',
              'node_modules/@prisma/client/package.json', 'node_modules/@prisma/client/runtime/library.js',
              'node_modules/prisma/package.json',
              'node_modules/typescript/package.json', 'node_modules/typescript/lib/typescript.js']
    paths = sorted(set(source_names) | set(extras))
    if not all(pathlib.Path(name).is_file() for name in paths):
        raise ValueError('Promane create phase input missing')
    hashes = {name: hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest() for name in paths}
    for actual, logical in source_names.items():
        entry = manifest['entries'][logical]
        expected = (entry['sha256'] if phase == 'before'
                    else CURRENT_SCHEMA if logical == 'prisma/schema.prisma'
                    else entry['afterSha256'] if entry['source'] == 'pinned'
                    else entry['sha256'])
        if hashes[actual] != expected:
            raise ValueError('Promane create phase source drift: ' + actual)
    locked_packages = json.loads(pathlib.Path('package-lock.json').read_text())['packages']
    for package in ('typescript', 'prisma', '@prisma/client'):
        installed = json.loads(pathlib.Path('node_modules', package, 'package.json').read_text())['version']
        if installed != locked_packages['node_modules/' + package]['version']:
            raise ValueError('Installed package differs from current lockfile: ' + package)
    if pathlib.Path('node_modules/.prisma/client/schema.prisma').stat().st_size <= 1000:
        raise ValueError('Actual generated Prisma schema required')
    compatible = subprocess.run(['node', str(CHECK)], env=env, capture_output=True, text=True,
                                timeout=15, check=True)
    compatibility = json.loads(compatible.stdout)
    if compatibility['compatibleModels'] != 33:
        raise ValueError('Promane generated-client model count changed')
    source_lock = folder / 'source-lock.json'
    source_lock.write_text(json.dumps({'phase': phase, 'sourceHashes': hashes,
                                       'loadedSourcePaths': paths, 'logicalSourcePaths': source_names,
                                       'compatibility': compatibility}, sort_keys=True) + '\n')
    state['sourceLockSha256'] = hashlib.sha256(source_lock.read_bytes()).hexdigest()

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
                 'DOYA_SFA_AUTHORITY_PG_PORT': str(port),
                 'DOYA_PROMANE_R1_SOURCE_LOCK': str(source_lock), 'DOYA_PROMANE_R1_EXPECT': phase}
    probe_log = pathlib.Path(env.get('DOYA_PROMANE_R1_PROBE_LOG', str(BASE / 'promane-retirement-create-postgres.log')))
    with probe_log.open('w') as output:
        result = subprocess.run(['node', str(BASE / 'verify-promane-retirement-create-postgres.cjs')],
                                env=child_env, stdout=output, stderr=subprocess.STDOUT, timeout=300)
    evidence = pathlib.Path(env.get('DOYA_PROMANE_R1_EVIDENCE', str(BASE / 'promane-retirement-create-postgres-results.json')))
    proof = json.loads(evidence.read_text()) if evidence.exists() else {}
    expected = 2 if phase == 'before' else 18
    source_hashes = proof.get('sourceHashes', {})
    expected_source_paths = {
        (entry['dataPath'] if phase == 'before' and entry['source'] in ('pinned', 'pinned-data') else name)
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
        and proof.get('sourceLockSha256') == state['sourceLockSha256']
        and proof.get('compatibility') == compatibility
        and proof.get('prismaClient', {}).get('dmmfModelCount') == 249
        and proof.get('prismaClient', {}).get('generatedSchemaSha256') == hashes['node_modules/.prisma/client/schema.prisma']
        and proof.get('prismaClient', {}).get('packageSha256') == hashes['node_modules/@prisma/client/package.json']
        and proof.get('inputHashesAtStart') == hashes
        and proof.get('inputHashesAtEnd') == hashes
    )
    state['sourceInputsStableAtEnd'] = {
        name: hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest() for name in paths
    } == hashes
    evidence_valid = evidence_valid and state['sourceInputsStableAtEnd']
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
