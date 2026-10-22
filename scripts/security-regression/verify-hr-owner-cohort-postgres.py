"""Run fixed HR after controls and an independent v6 snapshot-before observation.

Only owned private Unix-socket PostgreSQL clusters are used. A known before
observation is evidence about the old schedule, never fixed-after acceptance.
"""

import datetime
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import tempfile
import uuid


ROOT = pathlib.Path.cwd()
LOCK = ROOT / 'scripts/security-regression/fixtures/hr-owner-h5-source-lock.json'
AFTER_SUPERVISOR = ROOT / 'scripts/security-regression/verify-hr-owner-transfer-postgres.py'
H3_CURRENT_SUPERVISOR = ROOT / 'scripts/security-regression/verify-hr-invite-registration-current-postgres.py'
H3_FINAL_NULL_SUPERVISOR = ROOT / 'scripts/security-regression/verify-hr-invite-final-null-counter-postgres.py'
BEFORE_PROBE = ROOT / 'docs/audits/2026-10-06-all-services-recheck/verify-hr-invite-registration-snapshot-before.cjs'
SNAPSHOT_DATA = pathlib.Path('scripts/security-regression/fixtures/hr-owner-v6-before')
GENERATED = (
    pathlib.Path('node_modules/.prisma/client/schema.prisma'),
    pathlib.Path('node_modules/.prisma/client/index.js'),
    pathlib.Path('node_modules/.prisma/client/default.js'),
    pathlib.Path('node_modules/@prisma/client/default.js'),
    pathlib.Path('node_modules/@prisma/client/runtime/library.js'),
    pathlib.Path('node_modules/@prisma/client/generator-build/index.js'),
    pathlib.Path('node_modules/prisma/build/index.js'),
    pathlib.Path('node_modules/@prisma/client/package.json'),
    pathlib.Path('node_modules/prisma/package.json'),
    pathlib.Path('node_modules/typescript/package.json'),
    pathlib.Path('node_modules/typescript/lib/typescript.js'),
)
KNOWN_BEFORE = {
    'committed_email_invite_after_retirement',
    'retirement_rejected_after_retry',
    'serialization_aborted_no_write',
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_hash(path):
    if not path.is_file() or path.is_symlink():
        raise ValueError('Missing or symlinked H5 input: ' + str(path))
    return digest(path.read_bytes())


def source_lock():
    lock = json.loads(LOCK.read_text())
    if lock.get('version') != 1 or not lock.get('sourceFiles') or not lock.get('baselineData'):
        raise ValueError('Invalid H5 source lock')
    for group in ('sourceFiles', 'baselineData'):
        if len(lock[group]) != len(set(lock[group])):
            raise ValueError('Duplicate H5 source lock path')
        for name, expected in lock[group].items():
            path = pathlib.PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts or not name or not isinstance(expected, str) or len(expected) != 64:
                raise ValueError('Invalid H5 source lock entry: ' + name)
            if read_hash(ROOT / name) != expected:
                raise ValueError('H5 source lock mismatch: ' + name)
    return lock


def generated_lock():
    source_schema = read_hash(ROOT / 'prisma/schema.prisma')
    generated_schema = read_hash(ROOT / GENERATED[0])
    formatter = ROOT / 'node_modules/prisma/build/index.js'
    formatter_hash = read_hash(formatter)
    with tempfile.TemporaryDirectory(prefix='doya-owner-hr-format-') as temporary:
        private = pathlib.Path(temporary)
        formatted = {}
        for label, source in (('source', ROOT / 'prisma/schema.prisma'),
                              ('generated', ROOT / GENERATED[0])):
            target = private / (label + '.prisma')
            target.write_bytes(source.read_bytes())
            env = {'PATH': os.environ.get('PATH', ''), 'HOME': str(private),
                   'PRISMA_HIDE_UPDATE_MESSAGE': '1', 'NO_COLOR': '1'}
            try:
                subprocess.run(['node', str(formatter), 'format', '--schema', str(target)],
                               cwd=private, env=env, stdin=subprocess.DEVNULL,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               timeout=15, check=True)
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                raise ValueError('Pinned Prisma schema formatter failed') from None
            formatted[label] = read_hash(target)
    if formatted['source'] != formatted['generated']:
        raise ValueError('Fresh generated Prisma formatted schema differs from candidate formatted schema')
    packages = json.loads((ROOT / 'package-lock.json').read_text())['packages']
    for name in ('prisma', '@prisma/client', 'typescript'):
        installed = json.loads((ROOT / 'node_modules' / name / 'package.json').read_text())
        if installed['version'] != packages['node_modules/' + name]['version']:
            raise ValueError('Installed package differs from pinned lockfile: ' + name)
    return {**{str(path): read_hash(ROOT / path) for path in GENERATED},
            'sourceSchemaRawSha256': source_schema,
            'generatedSchemaRawSha256': generated_schema,
            'formattedSourceSchemaSha256': formatted['source'],
            'formattedGeneratedSchemaSha256': formatted['generated'],
            'formatterSha256': formatter_hash}


def verify_static(lock):
    for group in ('sourceFiles', 'baselineData'):
        for name, expected in lock[group].items():
            if read_hash(ROOT / name) != expected:
                raise ValueError('H5 source drift: ' + name)


def verify_generated(expected):
    actual = {str(path): read_hash(ROOT / path) for path in GENERATED}
    actual.update(sourceSchemaRawSha256=read_hash(ROOT / 'prisma/schema.prisma'),
                  generatedSchemaRawSha256=read_hash(ROOT / GENERATED[0]),
                  formatterSha256=read_hash(ROOT / 'node_modules/prisma/build/index.js'),
                  formattedSourceSchemaSha256=expected['formattedSourceSchemaSha256'],
                  formattedGeneratedSchemaSha256=expected['formattedGeneratedSchemaSha256'])
    if actual != expected:
        raise ValueError('H5 generated Prisma input drift')


def materialize_before(lock, destination):
    for name, expected in lock['baselineData'].items():
        prefix = str(SNAPSHOT_DATA) + '/'
        if not name.startswith(prefix) or not name.endswith('.txt'):
            raise ValueError('Unexpected H5 baseline data path: ' + name)
        relative = name[len(prefix):-4]
        if not relative.startswith('src/') or not relative.endswith('.ts'):
            raise ValueError('Unexpected H5 baseline module: ' + relative)
        data = (ROOT / name).read_bytes()
        if digest(data) != expected:
            raise ValueError('H5 baseline changed during materialization')
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    if len(list(destination.rglob('*.ts'))) != len(lock['baselineData']):
        raise ValueError('Incomplete H5 baseline materialization')


def pg_binary():
    candidates = ([pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])]
                  if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else
                  [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'),
                   *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'),
                           key=lambda item: int(item.parent.name), reverse=True)])
    found = next((item for item in candidates if (item / 'initdb').is_file() and (item / 'pg_ctl').is_file()), None)
    if found is None:
        raise ValueError('Private PostgreSQL binaries unavailable')
    return found


def run_before(evidence, baseline, generated, expected_path, expected_hash):
    pg = pg_binary()
    folder = pathlib.Path('/tmp') / ('doya-owner-hr-' + uuid.uuid4().hex[:8])
    folder.mkdir(mode=0o700, exist_ok=False)
    (folder / 'socket').mkdir(mode=0o700)
    result_file = evidence / 'h3-before-results.json'
    log_file = evidence / 'h3-before.log'
    supervisor_file = evidence / 'h3-before-supervisor.json'
    state = {'phase': 'v6-snapshot-before-observation', 'safetyAccepted': False,
             'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
             'privateFolder': str(folder), 'status': 'running'}
    started = False
    env = {key: value for key, value in os.environ.items() if not key.startswith('PG') and key != 'DOYA_TEST_BASELINE'}
    try:
        with (folder / 'init.log').open('w') as output:
            subprocess.run([str(pg / 'initdb'), '-D', str(folder / 'data'), '-U', 'doya_owner_hr',
                            '--auth=trust', '--no-locale', '--encoding=UTF8'], env=env,
                           stdout=output, stderr=subprocess.STDOUT, check=True)
        subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'),
                        '-o', '-k ' + str(folder / 'socket') + " -h '' -p 56484 -F -c timezone=UTC",
                        '-l', str(folder / 'server.log'), '-w', 'start'], env=env,
                       stdout=subprocess.DEVNULL, check=True)
        started = True
        child_env = {**env, 'DOYA_OWNER_HR_PG_SOCKET': str(folder / 'socket'),
                     'DOYA_OWNER_HR_PG_PORT': '56484', 'DOYA_OWNER_HR_H3_BEFORE': '1',
                     'DOYA_TEST_BASELINE': str(baseline), 'DOYA_OWNER_HR_H5_BASELINE': str(baseline),
                     'DOYA_OWNER_HR_H5_PHASE': 'before', 'DOYA_OWNER_HR_H3_EVIDENCE': str(result_file),
                     'DOYA_OWNER_HR_H5_EXPECTED': str(expected_path),
                     'DOYA_OWNER_HR_H5_EXPECTED_SHA256': expected_hash}
        with log_file.open('w') as output:
            child = subprocess.run(['node', str(BEFORE_PROBE)], env=child_env,
                                   stdout=output, stderr=subprocess.STDOUT, timeout=600)
        report = json.loads(result_file.read_text()) if result_file.exists() else {}
        state['probeExitCode'] = child.returncode
        state['classification'] = report.get('classification')
        state['evidenceValid'] = (
            child.returncode == 0 and report.get('phase') == 'v6_snapshot_after_registration_before'
            and report.get('classification') in KNOWN_BEFORE and report.get('safetyAccepted') is False
            and report.get('membershipCreated') == 0
            and report.get('wait', {}).get('holderPid') != report.get('wait', {}).get('waiterPid')
            and report.get('wait', {}).get('queryContainsUser') is True
            and report.get('sourceHashes') is not None
            and report.get('h5ExpectedSha256') == expected_hash
            and report.get('baselineHashes') == {
                name[len(str(SNAPSHOT_DATA)) + 1:-4]: expected
                for name, expected in json.loads(LOCK.read_text())['baselineData'].items()}
            and {name: read_hash(ROOT / name) for name in report.get('sourceHashes', {})}
                == report.get('sourceHashes')
        )
        verify_generated(generated)
        state['status'] = 'observed' if state['evidenceValid'] else 'failed'
    except Exception as error:
        state.update(status='failed', errorType=type(error).__name__, error=str(error))
    finally:
        if started:
            stop = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-m', 'fast', '-w', 'stop'],
                                  env=env, stdout=subprocess.DEVNULL)
            status = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), 'status'],
                                    env=env, stdout=subprocess.DEVNULL)
            state['stopExitCode'] = stop.returncode
            state['postStopStatusExitCode'] = status.returncode
            if stop.returncode == 0 and status.returncode == 3:
                shutil.rmtree(folder)
                state['privateFolderRemoved'] = not folder.exists()
        elif folder.exists():
            shutil.rmtree(folder)
            state['privateFolderRemoved'] = not folder.exists()
        if (state.get('stopExitCode') != 0 or state.get('postStopStatusExitCode') != 3
                or state.get('privateFolderRemoved') is not True):
            state['status'] = 'failed'
            state['evidenceValid'] = False
        state['endedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        supervisor_file.write_text(json.dumps(state, indent=2) + '\n')
    return state


def main():
    path = pathlib.Path(os.environ['DOYA_OWNER_HR_H5_EVIDENCE_DIR'])
    if not path.is_absolute() or path.exists() or path.is_symlink():
        raise ValueError('H5 requires a new absolute owned evidence directory')
    path.mkdir(mode=0o700, exist_ok=False)
    state = {'phase': 'hr-owner-cohort', 'safetyAccepted': False,
             'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': 'running'}
    try:
        lock = source_lock()
        generated = generated_lock()
        state['prePgGeneratedHashes'] = generated
        state['sourceLockSha256'] = read_hash(LOCK)
        with tempfile.TemporaryDirectory(prefix='doya-owner-hr-v6-', dir='/tmp') as temporary:
            baseline = pathlib.Path(temporary)
            materialize_before(lock, baseline)
            before_hashes = {name[len(str(SNAPSHOT_DATA)) + 1:-4]: expected
                             for name, expected in lock['baselineData'].items()}
            if {str(p.relative_to(baseline)): read_hash(p) for p in baseline.rglob('*.ts')} != before_hashes:
                raise ValueError('H5 baseline failed pre-PG verification')
            expected_path = path / 'child-expected-inputs.json'
            expected_path.write_text(json.dumps({
                'version': 1,
                'sourceLockSha256': read_hash(LOCK),
                'sourceFiles': lock['sourceFiles'],
                'materializedBaseline': before_hashes,
                'generatedFiles': {str(item): generated[str(item)] for item in GENERATED},
            }, sort_keys=True) + '\n')
            expected_hash = read_hash(expected_path)
            state['childExpectedSha256'] = expected_hash
            try:
                after_dir = path / 'after'
                after_dir.mkdir(mode=0o700)
                after_env = {**os.environ, 'DOYA_OWNER_HR_EVIDENCE_DIR': str(after_dir),
                             'DOYA_OWNER_HR_H5_BASELINE': str(baseline),
                             'DOYA_OWNER_HR_H5_PHASE': 'after',
                             'DOYA_OWNER_HR_H5_EXPECTED': str(expected_path),
                             'DOYA_OWNER_HR_H5_EXPECTED_SHA256': expected_hash}
                with (path / 'after-supervisor.log').open('w') as output:
                    after = subprocess.run(['python3', str(AFTER_SUPERVISOR)], env=after_env,
                                           stdout=output, stderr=subprocess.STDOUT, timeout=900)
                after_result = json.loads((after_dir / 'hr-owner-transfer-postgres-supervisor.json').read_text())
                state['after'] = {'exitCode': after.returncode, 'status': after_result.get('status'),
                                  'evidenceValid': after_result.get('evidenceValid'),
                                  'privateFolderRemoved': after_result.get('privateFolderRemoved')}
                if after.returncode != 0 or after_result.get('status') != 'passed' or not after_result.get('evidenceValid'):
                    raise ValueError('H5 after74 or exact waits failed')
                verify_static(lock)
                verify_generated(generated)
                before_dir = path / 'before'
                before_dir.mkdir(mode=0o700)
                state['before'] = run_before(before_dir, baseline, generated, expected_path, expected_hash)
                if state['before'].get('status') != 'observed' or not state['before'].get('evidenceValid'):
                    raise ValueError('H5 v6 before observation did not meet one known classification')
                verify_static(lock)
                verify_generated(generated)
                h3_dir = path / 'current-h3-after'
                h3_dir.mkdir(mode=0o700)
                h3_env = {**os.environ, 'DOYA_OWNER_HR_EVIDENCE_DIR': str(h3_dir),
                          'DOYA_OWNER_HR_H5_BASELINE': str(baseline),
                          'DOYA_OWNER_HR_H5_PHASE': 'after',
                          'DOYA_OWNER_HR_H5_EXPECTED': str(expected_path),
                          'DOYA_OWNER_HR_H5_EXPECTED_SHA256': expected_hash}
                with (path / 'current-h3-after-supervisor.log').open('w') as output:
                    h3 = subprocess.run(['python3', str(H3_CURRENT_SUPERVISOR)], env=h3_env,
                                        stdout=output, stderr=subprocess.STDOUT, timeout=900)
                h3_result = json.loads((h3_dir / 'h3-current-after-supervisor.json').read_text())
                state['currentH3After'] = {'exitCode': h3.returncode, 'status': h3_result.get('status'),
                                           'evidenceValid': h3_result.get('evidenceValid'),
                                           'privateFolderRemoved': h3_result.get('privateFolderRemoved')}
                if h3.returncode != 0 or h3_result.get('status') != 'passed' or not h3_result.get('evidenceValid'):
                    raise ValueError('H3 current-after exact snapshot schedule or positive failed')
                verify_static(lock)
                verify_generated(generated)
                counter_dir = path / 'final-null-counter'
                counter_dir.mkdir(mode=0o700)
                counter_env = {**os.environ, 'DOYA_OWNER_HR_COUNTER_EVIDENCE_DIR': str(counter_dir),
                               'DOYA_OWNER_HR_H5_BASELINE': str(baseline),
                               'DOYA_OWNER_HR_H5_PHASE': 'after',
                               'DOYA_OWNER_HR_H5_EXPECTED': str(expected_path),
                               'DOYA_OWNER_HR_H5_EXPECTED_SHA256': expected_hash}
                with (path / 'final-null-counter-supervisor.log').open('w') as output:
                    counter = subprocess.run(['python3', str(H3_FINAL_NULL_SUPERVISOR)], env=counter_env,
                                             stdout=output, stderr=subprocess.STDOUT, timeout=900)
                counter_result = json.loads((counter_dir / 'h3-final-null-counter-supervisor.json').read_text())
                state['finalNullCounter'] = {'exitCode': counter.returncode, 'status': counter_result.get('status'),
                                             'evidenceValid': counter_result.get('evidenceValid'),
                                             'observedClassification': counter_result.get('observedClassification'),
                                             'observedHttpStatus': counter_result.get('observedHttpStatus'),
                                             'privateFolderRemoved': counter_result.get('privateFolderRemoved')}
                if counter.returncode != 0 or counter_result.get('status') != 'passed' or not counter_result.get('evidenceValid'):
                    raise ValueError('H3 final-null counter schedule unsafe or unknown')
            finally:
                actual_baseline = {str(p.relative_to(baseline)): read_hash(p) for p in baseline.rglob('*.ts')}
                state['materializedBaselineAligned'] = actual_baseline == before_hashes
                if not state['materializedBaselineAligned']:
                    raise ValueError('H5 materialized v6 baseline drift after child')
        verify_static(lock)
        verify_generated(generated)
        if read_hash(expected_path) != expected_hash:
            raise ValueError('H5 child expected manifest drift')
        state['status'] = 'source_and_observation_passed'
    except Exception as error:
        state.update(status='failed', errorType=type(error).__name__, error=str(error))
    finally:
        try:
            if read_hash(LOCK) != state.get('sourceLockSha256'):
                raise ValueError('H5 source lock changed after pre-PG capture')
            verify_static(json.loads(LOCK.read_text()))
            if 'prePgGeneratedHashes' in state:
                verify_generated(state['prePgGeneratedHashes'])
            if state.get('childExpectedSha256') and read_hash(path / 'child-expected-inputs.json') != state['childExpectedSha256']:
                raise ValueError('H5 child expected manifest changed after cleanup')
            state['postCleanupSourceAligned'] = True
        except Exception as error:
            state['postCleanupSourceAligned'] = False
            state['postCleanupSourceError'] = type(error).__name__
            state['status'] = 'failed'
        state['endedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        (path / 'hr-owner-cohort-supervisor.json').write_text(json.dumps(state, indent=2) + '\n')
    if state['status'] != 'source_and_observation_passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
