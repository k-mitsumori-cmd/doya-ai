"""Run the HR owner-transfer probe against an owned private Unix-socket PostgreSQL cluster."""
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import uuid

PROBE = pathlib.Path('docs/audits/2026-10-06-all-services-recheck/verify-hr-owner-transfer-private-postgres.cjs')
evidence_dir = pathlib.Path(os.environ.get('DOYA_OWNER_HR_EVIDENCE_DIR', 'docs/audits/2026-10-06-all-services-recheck'))
evidence_dir.mkdir(parents=True, exist_ok=True)
result_file = evidence_dir / 'hr-owner-transfer-postgres-results.json'
supervisor_file = evidence_dir / 'hr-owner-transfer-postgres-supervisor.json'
probe_log = evidence_dir / 'hr-owner-transfer-postgres.log'

EXPECTED = {
    'HR before36 old route transfers after target retirement without a fence',
    'HR before36 old route cannot replay a lost successful response',
    'HR atomic uppercase transfer, exact replay and personal fields unchanged',
    'HR sole owner preflight remains safe without inventing another member',
    'HR missing cancel is durable and cannot undo a committed transfer',
    'HR retirement fences only a new missing cancel write; existing receipt remains readable',
    'HR missing cancel retirement-first User wait rejects the new receipt',
    'HR missing cancel-first User wait creates one receipt before retirement',
    'HR target plan drift and malformed receipt fail without role mutation',
    'HR target role, status and User binding drift reject without creating a receipt',
    'HR exact raw target plan replays but changed confirmation and unknown plan fail closed',
    'HR same UUID has independent actor and immutable organization receipts',
    'HR late committed receipt wins after target User deletion',
    'HR late canceled receipt wins after target User deletion',
    'HR candidate pagination reaches member 61 without a new eligibility cap',
    'HR actual creator first membership and exact existing membership replay',
    'HR actual creator rejects retirement before new organization and member writes',
    'HR creator retirement-first actual User wait leaves no organization',
    'HR creator-first actual User wait has one owner membership',
    'HR invitation registration phantom restarts discovery and respects a new retirement fence',
    'HR two actual invitation accept routes compete for the last FREE member slot',
    'HR public invitation GET reports expiry without mutating its receipt or membership',
    'HR public invitation GET reads accepted and unknown tokens without writes',
    'HR actual accept expires a pending invitation without creating a membership',
    'HR actual accept cannot claim the same token twice',
    'HR actual invitation issue is MEMBER-only for seven days and respects the last FREE seat',
    'HR distinct UUID transfers serialize on User and commit only the first owner change',
}
for kind in ('organization-create', 'member-patch', 'member-delete', 'organization-patch', 'invite-issue', 'invite-accept'):
    EXPECTED.update({
        f'HR actual {kind} route commits one authorized write',
        f'HR actual {kind} route rejects retirement before any write',
        f'HR actual {kind} retirement-first User wait rejects the route',
        f'HR actual {kind} route-first User wait completes before retirement',
    })
for kind in ('member-patch', 'member-delete', 'invite-issue', 'invite-accept'):
    EXPECTED.update({
        f'HR actual {kind} current OWNER retirement-first User wait rejects the route',
        f'HR actual {kind} route-first current OWNER User wait completes before retirement',
    })
for kind in ('member', 'invite'):
    EXPECTED.update({
        f'HR {kind} shared writer has one bounded actual mutation',
        f'HR {kind} retirement-first User wait rejects shared writer',
        f'HR {kind} writer-first User wait leaves one completed mutation',
    })
for user in ('old', 'new'):
    EXPECTED.update({
        f'HR {user} retirement-first User wait rejects new transfer',
        f'HR {user} transfer-first User wait preserves one committed result',
    })
for first in ('cancel', 'transfer'):
    EXPECTED.add(f'HR {first}-first operation wait has one durable terminal result')
for fault in ('demote', 'promote', 'receipt'):
    EXPECTED.add(f'HR {fault} fault rolls back both roles and receipt; same ID retries')
assert len(EXPECTED) == 74

WAIT_NAMES = {'creator retirement-first', 'creator-first retirement',
              'invitation registration phantom retirement-first',
              'missing cancel retirement-first', 'missing cancel-first retirement',
              'distinct UUID second transfer User wait'}
for kind in ('organization-create', 'member-patch', 'member-delete', 'organization-patch', 'invite-issue', 'invite-accept'):
    WAIT_NAMES.update((f'{kind} route retirement-first', f'{kind} route-first retirement'))
for kind in ('member', 'invite'):
    WAIT_NAMES.update((f'{kind} retirement-first', f'{kind} writer-first'))
for kind in ('member-patch', 'member-delete', 'invite-issue', 'invite-accept'):
    WAIT_NAMES.update((f'{kind} current OWNER retirement-first', f'{kind} route-first current OWNER retirement'))
for user in ('old', 'new'):
    WAIT_NAMES.update((f'{user} retirement-first', f'{user} transfer-first'))
for first in ('cancel', 'transfer'):
    WAIT_NAMES.add(f'{first}-first contender')
assert len(WAIT_NAMES) == 36
OPERATION_WAIT_NAMES = {'cancel-first advisory', 'transfer-first advisory'}

def valid_wait_rows(wait_rows, operation_rows):
    def witnessed(row, target):
        return (isinstance(row.get('holderPid'), int) and row['holderPid'] > 0
                and isinstance(row.get('waiterPid'), int) and row['waiterPid'] > 0
                and row['holderPid'] != row['waiterPid']
                and row.get('waitEventType') == 'Lock' and row.get('lockTarget') == target
                and row.get('queryContainsTarget') is True
                and isinstance(row.get('blockingPids'), list)
                and row['holderPid'] in row['blockingPids'])
    return (len(wait_rows) == len(WAIT_NAMES)
            and {row.get('name') for row in wait_rows} == WAIT_NAMES
            and len({row.get('name') for row in wait_rows}) == len(wait_rows)
            and all(witnessed(row, '"User"') for row in wait_rows)
            and len(operation_rows) == len(OPERATION_WAIT_NAMES)
            and {row.get('name') for row in operation_rows} == OPERATION_WAIT_NAMES
            and len({row.get('name') for row in operation_rows}) == len(operation_rows)
            and all(witnessed(row, 'pg_advisory_xact_lock') for row in operation_rows))

SOURCE_FILES = {
    'src/lib/hr/owner-transfer/types.ts', 'src/lib/hr/owner-transfer/receipt.ts', 'src/lib/hr/owner-transfer/store.ts',
    'src/lib/hr/access.ts', 'src/lib/hr/membership-write.ts', 'src/lib/account-lifecycle/state.ts',
    'src/lib/account-lifecycle/store.ts', 'src/lib/hr/types.ts', 'src/lib/hr/constants.ts', 'src/lib/hr/billing.ts',
    'src/lib/private-api-response.ts', 'src/app/api/hr/organization/route.ts',
    'src/app/api/hr/organization/members/[id]/route.ts', 'src/app/api/hr/organization/invite/route.ts',
    'src/app/api/hr/organization/invite/accept/route.ts', 'src/app/api/hr/organization/invite/[token]/route.ts',
    'src/lib/account-retirement.ts', 'scripts/security-regression/load-typescript.cjs',
    'scripts/security-regression/retirement-fixture.cjs', 'prisma/schema.prisma', 'package.json', 'package-lock.json',
    'node_modules/.prisma/client/schema.prisma', 'node_modules/.prisma/client/index.js', str(PROBE.resolve()),
    'scripts/security-regression/fixtures/hr-owner-before36/transfer-owner.route.txt',
    'scripts/security-regression/fixtures/hr-owner-before36/manifest.json',
}
assert len(SOURCE_FILES) == 27

candidates = ([pathlib.Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])]
              if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else
              [pathlib.Path('/opt/homebrew/opt/postgresql@17/bin'),
               *sorted(pathlib.Path('/usr/lib/postgresql').glob('*/bin'),
                       key=lambda item: int(item.parent.name), reverse=True)])
pg = next((item for item in candidates if (item / 'initdb').is_file() and (item / 'pg_ctl').is_file()), None)
if pg is None:
    raise SystemExit('Private PostgreSQL binaries unavailable')
folder = pathlib.Path('/tmp') / ('doya-owner-hr-' + uuid.uuid4().hex[:8])
folder.mkdir(mode=0o700, exist_ok=False)
(folder / 'socket').mkdir(mode=0o700)
port = 56483
env = {key: value for key, value in os.environ.items() if not key.startswith('PG') and key != 'DOYA_TEST_BASELINE'}
state = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
         'privateFolder': str(folder), 'status': 'running'}
supervisor_file.write_text(json.dumps(state, indent=2) + '\n')
started = False
try:
    with (folder / 'init.log').open('w') as output:
        subprocess.run([str(pg / 'initdb'), '-D', str(folder / 'data'), '-U', 'doya_owner_hr', '--auth=trust',
                        '--no-locale', '--encoding=UTF8'], env=env, stdout=output, stderr=subprocess.STDOUT, check=True)
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'),
                    '-o', "-k " + str(folder / 'socket') + " -h '' -p " + str(port) + ' -F -c timezone=UTC',
                    '-l', str(folder / 'server.log'), '-w', 'start'], env=env, stdout=subprocess.DEVNULL, check=True)
    started = True
    child_env = {**env, 'DOYA_OWNER_HR_PG_SOCKET': str(folder / 'socket'),
                 'DOYA_OWNER_HR_PG_PORT': str(port), 'DOYA_OWNER_HR_EVIDENCE': str(result_file)}
    if os.environ.get('DOYA_OWNER_HR_H5_EXPECTED'):
        assert os.environ.get('DOYA_OWNER_HR_H5_PHASE') == 'after'
        assert 'DOYA_TEST_BASELINE' not in os.environ
        assert os.environ.get('DOYA_OWNER_HR_H5_BASELINE')
        assert 'DOYA_TEST_BASELINE' not in child_env
    with probe_log.open('w') as output:
        result = subprocess.run(['node', str(PROBE)], env=child_env, stdout=output,
                                stderr=subprocess.STDOUT, timeout=600)
    proof = json.loads(result_file.read_text()) if result_file.exists() else {}
    hashes = proof.get('sourceHashes', {})
    wait_rows = proof.get('waits', [])
    operation_rows = proof.get('operationWaits', [])
    evidence_valid = (
        result.returncode == 0 and proof.get('passed') == len(EXPECTED)
        and len(proof.get('cases', [])) == len(EXPECTED) and set(proof.get('cases', [])) == EXPECTED
        and valid_wait_rows(wait_rows, operation_rows)
        and proof.get('checkedAt', '') >= state['startedAt']
        and set(hashes) == SOURCE_FILES
        and (not os.environ.get('DOYA_OWNER_HR_H5_EXPECTED') or
             proof.get('h5ExpectedSha256') == os.environ.get('DOYA_OWNER_HR_H5_EXPECTED_SHA256'))
        and all(pathlib.Path(name).is_file() and hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest() == digest
                for name, digest in hashes.items())
    )
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
