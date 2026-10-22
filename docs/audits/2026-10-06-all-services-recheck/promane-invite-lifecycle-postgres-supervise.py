"""Run the Promane invitation before/after fixture on a disposable Unix-socket PG only."""
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import uuid

BASE = pathlib.Path('docs/audits/2026-10-06-all-services-recheck')
PIN = pathlib.Path('scripts/security-regression/fixtures/promane-invite-r1-66a/manifest.json')
SERIAL_PIN = pathlib.Path('scripts/security-regression/fixtures/promane-invite-r1-serializable/manifest.json')
CLOSURE = pathlib.Path('scripts/security-regression/fixtures/promane-invite-r1-66a/closure.json')
PHASE = os.environ.get('DOYA_PROMANE_INVITE_EXPECT', 'after')
if PHASE not in ('before', 'serializable', 'after'):
    raise SystemExit('DOYA_PROMANE_INVITE_EXPECT must be before, serializable, or after')
manifest = json.loads(PIN.read_text())
if manifest.get('baseCommit') != '66a60eee39f06fed34abdbcc24ab3468f3563eb7' or len(manifest.get('pinnedSources', {})) != 3:
    raise SystemExit('Pinned invitation source manifest is not the reviewed before set')
for name, digest in manifest['pinnedSources'].items():
    source = PIN.parent / name
    if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
        raise SystemExit('Pinned before input changed: ' + name)
serial_manifest = json.loads(SERIAL_PIN.read_text())
closure = json.loads(CLOSURE.read_text())
if closure.get('baseCommit') != manifest['baseCommit'] or len(closure.get('entries', {})) != 18:
    raise SystemExit('Invitation source closure is not the reviewed base')
for name, entry in closure['entries'].items():
    if not (isinstance(entry.get('baseSha256'), str) and isinstance(entry.get('afterSha256'), str)):
        raise SystemExit('Malformed invitation closure entry: ' + name)
    if name not in manifest['pinnedSources'] and hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest() != entry['baseSha256']:
        raise SystemExit('Unpinned base66 source changed: ' + name)
serial_name = pathlib.Path('src/lib/promane/invite-admission.ts')
if (serial_manifest.get('pinnedSerializableHelperSha256') !=
        hashlib.sha256((SERIAL_PIN.parent / serial_name).read_bytes()).hexdigest()):
    raise SystemExit('Pinned Serializable finding input changed')

candidates = ([pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])]
              if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else
              [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'),
               *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'),
                       key=lambda item: int(item.parent.name), reverse=True)])
pg = next((item for item in candidates if (item / 'initdb').is_file() and (item / 'pg_ctl').is_file()), None)
if pg is None:
    raise SystemExit('Private PostgreSQL initdb/pg_ctl unavailable')

folder = pathlib.Path('/tmp') / ('doya-sfa-authority-' + uuid.uuid4().hex[:8])
folder.mkdir(mode=0o700, exist_ok=False)
(folder / 'socket').mkdir(mode=0o700)
port = 56482
env = {key: value for key, value in os.environ.items() if not key.startswith('PG') and key != 'DOYA_TEST_BASELINE'}
report = pathlib.Path(env.get('DOYA_PROMANE_INVITE_SUPERVISOR', str(BASE / 'promane-invite-lifecycle-supervisor.json')))
evidence = pathlib.Path(env.get('DOYA_PROMANE_INVITE_EVIDENCE', str(BASE / 'promane-invite-lifecycle-results.json')))
probe_log = pathlib.Path(env.get('DOYA_PROMANE_INVITE_PROBE_LOG', str(BASE / 'promane-invite-lifecycle.log')))
status = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'phase': PHASE,
          'privateFolder': str(folder), 'status': 'running', 'manifestSha256': hashlib.sha256(PIN.read_bytes()).hexdigest()}
report.write_text(json.dumps(status, indent=2) + '\n')
started = False
try:
    if PHASE in ('before', 'serializable'):
        baseline = folder / 'baseline'
        names = manifest['pinnedSources'] if PHASE == 'before' else [str(serial_name)]
        source_folder = PIN.parent if PHASE == 'before' else SERIAL_PIN.parent
        for name in names:
            target = baseline / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((source_folder / name).read_bytes())
        env['DOYA_TEST_BASELINE'] = str(baseline)
    # Freeze every input before PostgreSQL startup or the child's first require/load.
    source_names = [*closure['entries'], str(CLOSURE), str(PIN), str(SERIAL_PIN),
                    str(BASE / 'verify-promane-invite-lifecycle-postgres.cjs'),
                    str(BASE / 'promane-invite-lifecycle-postgres-supervise.py')]
    overlay_names = set(manifest['pinnedSources']) if PHASE == 'before' else {str(serial_name)} if PHASE == 'serializable' else set()
    loaded_sources = {(str(baseline / name) if name in overlay_names else name): name for name in source_names}
    generated_inputs = ['node_modules/.prisma/client/schema.prisma', 'node_modules/.prisma/client/index.js',
                        'node_modules/.prisma/client/default.js',
                        'node_modules/@prisma/client/package.json', 'node_modules/@prisma/client/default.js',
                        'node_modules/prisma/package.json']
    input_paths = [*loaded_sources, *generated_inputs]
    if len(input_paths) != len(set(input_paths)) or not all(pathlib.Path(name).is_file() for name in input_paths):
        raise RuntimeError('Invitation input path missing or duplicate')
    source_start = {name: hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest() for name in input_paths}
    for actual_path, logical_name in loaded_sources.items():
        if logical_name in closure['entries']:
            entry = closure['entries'][logical_name]
            expected = (entry['baseSha256'] if PHASE == 'before' else serial_manifest['pinnedSerializableHelperSha256']) if logical_name in overlay_names else entry['afterSha256']
            if source_start[actual_path] != expected:
                raise RuntimeError('Invitation phase input differs from pinned source: ' + actual_path)
    if pathlib.Path(generated_inputs[0]).stat().st_size <= 1000:
        raise RuntimeError('Actual generated Prisma schema input is required')
    source_lock = folder / 'source-lock.json'
    source_lock.write_text(json.dumps({'phase': PHASE, 'sourceHashes': source_start,
                                       'loadedSourcePaths': list(loaded_sources), 'generatedInputs': generated_inputs}, sort_keys=True) + '\n')
    status['sourceLockSha256'] = hashlib.sha256(source_lock.read_bytes()).hexdigest()
    with (folder / 'init.log').open('w') as output:
        subprocess.run([str(pg / 'initdb'), '-D', str(folder / 'data'), '-U', 'doya_sfa',
                        '--auth=trust', '--no-locale', '--encoding=UTF8'],
                       env=env, stdout=output, stderr=subprocess.STDOUT, check=True)
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'),
                    '-o', '-k ' + str(folder / 'socket') + " -h '' -p " + str(port) + ' -F -c timezone=UTC',
                    '-l', str(folder / 'server.log'), '-w', 'start'], env=env, stdout=subprocess.DEVNULL, check=True)
    started = True
    child_env = {**env, 'DOYA_SFA_AUTHORITY_PG_SOCKET': str(folder / 'socket'),
                 'DOYA_SFA_AUTHORITY_PG_PORT': str(port), 'DOYA_PROMANE_INVITE_EXPECT': PHASE,
                 'DOYA_PROMANE_INVITE_EVIDENCE': str(evidence.resolve()),
                 'DOYA_PROMANE_INVITE_SOURCE_LOCK': str(source_lock)}
    with probe_log.open('w') as output:
        result = subprocess.run(['node', str(BASE / 'verify-promane-invite-lifecycle-postgres.cjs')],
                                env=child_env, stdout=output, stderr=subprocess.STDOUT, timeout=300)
    proof = json.loads(evidence.read_text()) if evidence.exists() else {}
    expected_cases = {
        'before': ['recipient retirement completed before accept POST', 'actor retirement completed before issue POST'],
        'serializable': ['unregistered recipient appears while issue waits on owner lock'],
        'after': [
            'recipient retirement completed before accept POST', 'actor retirement completed before issue POST',
            'retirement-first User lock waits then accept rejects',
            'recipient retirement-first User lock waits then issue rejects without delivery',
            'issue-first recipient User lock lets later retirement reserve, then accept rejects',
            'writer-first User lock makes retirement preflight see new member',
            'unregistered recipient appears while issue waits on owner lock',
            'foreign email cannot accept or consume invitation',
            'accept rejects malformed lifecycle metadata without writes',
            'issue rejects malformed lifecycle metadata without writes',
            'accept permits an unrelated billing-only fence',
            'issue permits an unrelated billing-only fence',
            'foreign workspace cannot issue invitation',
            'different role never reuses existing active invitation',
            'inactive existing membership is never revived or accepted',
            'active existing member keeps role while consuming invitation',
            'expired invitation cannot grant or consume a seat',
            'expiry after actual member insert rolls back member and acceptedAt',
            'invitation email changes while accept waits on User',
            'invitation role changes while accept waits on User',
            'invitation acceptedAt changes while accept waits on User',
            'invitation expiry changes while accept waits on User',
            'invitation token changes while accept waits on User',
            'inviter role changes while issue waits on owner User',
            'inviter becomes inactive while issue waits on owner User',
            'workspace owner changes to retiring User while issue waits',
            'recipient account email drift while accept waits rejects grant',
            'invitation workspace drift replans onto the current owned workspace',
            'two connections issuing same email commit one invitation and one delivery',
            'two connections compete for final pending seat', 'two connections accept same token once',
        ],
    }[PHASE]
    expected = len(expected_cases)
    expected_wait_labels = {
        'before': [], 'serializable': ['unregistered recipient issue'],
        'after': [
            'retirement-first accept', 'recipient retirement-first issue', 'issue-first retirement reservation', 'writer-first preflight',
            'unregistered recipient issue',
            *['invitation ' + field + ' drift' for field in ('email', 'role', 'acceptedAt', 'expiry', 'token')],
            'inviter role drift', 'inviter active drift', 'workspace owner drift',
            'recipient account email drift', 'invitation workspace drift',
            'same-email issue', 'last-seat issue', 'same-token accept',
        ],
    }[PHASE]
    source_names = [*closure['entries'], str(CLOSURE), str(PIN), str(SERIAL_PIN),
                    str(BASE / 'verify-promane-invite-lifecycle-postgres.cjs'),
                    str(BASE / 'promane-invite-lifecycle-postgres-supervise.py')]
    overlaid = set(manifest['pinnedSources']) if PHASE == 'before' else {str(serial_name)} if PHASE == 'serializable' else set()
    expected_sources = {(str(baseline / name) if name in overlaid else name)
                        for name in source_names}
    source_end = {name: hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest() for name in input_paths}
    valid = (source_start == source_end and proof.get('inputHashesAtStart') == source_start
             and proof.get('inputHashesAtEnd') == source_end
             and proof.get('sourceLockSha256') == status['sourceLockSha256']
             and result.returncode == 0 and proof.get('passed') == expected and proof.get('cases') == expected_cases
             and len(proof.get('observed', [])) == {'before': 2, 'serializable': 1, 'after': 7}[PHASE]
             and [item.get('label') for item in proof.get('waitEvidence', [])] == expected_wait_labels
             and all(item.get('blockedByHolder') is True and item.get('waitType') == 'Lock'
                     for item in proof.get('waitEvidence', []))
             and proof.get('phase') == {'before': 'before_gap_observed', 'serializable': 'serializable_phantom_observed', 'after': 'after_guard_verified'}[PHASE]
             and proof.get('checkedAt', '') >= status['startedAt']
             and set(proof.get('sourceHashes', {})) == expected_sources
             and isinstance(proof.get('prismaClient', {}).get('version'), str)
             and len(proof.get('prismaClient', {}).get('generatedSchemaSha256', '')) == 64
             and proof.get('prismaClient', {}).get('dmmfModelCount') == 246
             and all(pathlib.Path(name).is_file() and hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest() == digest
                     for name, digest in proof.get('sourceHashes', {}).items()))
    status.update(probeExitCode=result.returncode, evidenceValid=valid, status='passed' if valid else 'failed')
except Exception as error:
    status.update(status='failed', errorType=type(error).__name__, error=str(error))
finally:
    if started:
        stopped = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-m', 'fast', '-w', 'stop'],
                                 env=env, stdout=subprocess.DEVNULL)
        status['stopExitCode'] = stopped.returncode
        after = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), 'status'],
                               env=env, stdout=subprocess.DEVNULL)
        status['postStopStatusExitCode'] = after.returncode
        if stopped.returncode == 0 and after.returncode == 3:
            shutil.rmtree(folder)
            status['privateFolderRemoved'] = not folder.exists()
    elif folder.exists():
        shutil.rmtree(folder)
        status['privateFolderRemoved'] = not folder.exists()
    status['endedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    report.write_text(json.dumps(status, indent=2) + '\n')
    print(json.dumps(status))
if status['status'] != 'passed' or status.get('stopExitCode') != 0 or status.get('postStopStatusExitCode') != 3 or not status.get('privateFolderRemoved'):
    raise SystemExit(1)
