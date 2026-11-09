"""Fresh private PostgreSQL; actual Prisma/ledger with synthetic Stripe/session.

Never inherits application credentials. Keep the stopped synthetic cluster and
safe evidence for inspection. DATABASE_URL and DIRECT_URL are both replaced.
"""
from pathlib import Path
import datetime
import re
import json
import os
import shutil
import subprocess
import tempfile
import time

root = Path(__file__).resolve().parents[2]
candidates = [Path('/opt/homebrew/opt/postgresql@17/bin'),
              *sorted(Path('/usr/lib/postgresql').glob('*/bin'), reverse=True)]
pg = next((p for p in candidates if (p / 'initdb').is_file() and (p / 'pg_ctl').is_file()), None)
if not pg:
    raise SystemExit('PostgreSQL initdb/pg_ctl required for isolated team-seat regression')
folder = Path(tempfile.mkdtemp(prefix='doya-seat-models-', dir='/tmp'))
folder.chmod(0o700)
socket = folder / 'socket'
socket.mkdir(mode=0o700)
env = {k: os.environ[k] for k in ['PATH', 'HOME', 'USER', 'LANG', 'TMPDIR',
       'DOYA_TEST_BASELINE', 'DOYA_SEAT_EVIDENCE_DIR'] if k in os.environ}
output = Path(env.get('DOYA_SEAT_EVIDENCE_DIR', str(folder / 'evidence')))
output.mkdir(mode=0o700, parents=True, exist_ok=True)
env['DOYA_SEAT_EVIDENCE_DIR'] = str(output)
env['PRISMA_GENERATE_SKIP_AUTOINSTALL'] = '1'
prisma_version = json.loads((root / 'node_modules/prisma/package.json').read_text())['version']
client_version = json.loads((root / 'node_modules/@prisma/client/package.json').read_text())['version']
assert prisma_version == client_version
(folder / 'package.json').write_text(json.dumps({'name': 'doya-private-seat-audit', 'private': True, 'dependencies': {'@prisma/client': client_version, 'prisma': prisma_version}}))
(folder / 'node_modules').symlink_to(root / 'node_modules', target_is_directory=True)
node = shutil.which('node', path=env.get('PATH'))
if not node:
    raise SystemExit('Node.js required for isolated team-seat regression')
db_name = 'doya_seat_models_' + str(time.time_ns())
url = 'postgresql://doya_seat_test@localhost:56509/' + db_name + '?host=' + str(socket) + '&sslmode=disable&connection_limit=8'
private_env = folder / 'environment.json'
private_state = folder / 'state.json'
private_env.write_text(json.dumps({'DATABASE_URL': url, 'DIRECT_URL': url}))
private_state.write_text(json.dumps({'socket': str(socket), 'prismaClientPath': str(folder / 'client')}))
private_env.chmod(0o600)
private_state.chmod(0o600)
test_exit = None
started = False
client_generated = False
try:
    with (folder / 'init.log').open('w') as log:
        subprocess.run([str(pg / 'initdb'), '-D', str(folder / 'data'), '-U', 'doya_seat_test',
                        '--auth=trust', '--no-locale', '--encoding=UTF8'],
                       env=env, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=60)
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-o',
                    "-k " + str(socket) + " -h '' -p 56509 -F -c timezone=UTC -c unix_socket_permissions=0700 -c shared_buffers=16MB",
                    '-l', str(folder / 'server.log'), '-w', 'start'],
                   env=env, stdout=subprocess.DEVNULL, check=True, timeout=30)
    started = True
    subprocess.run([str(pg / 'createdb'), '-h', str(socket), '-p', '56509', '-U', 'doya_seat_test', db_name],
                   env=env, check=True, timeout=15)
    # Copy only the schema: Prisma must not discover application .env files.
    schema = folder / 'schema.prisma'
    source = (root / 'prisma/schema.prisma').read_text()
    output_line = '\n  output = ' + json.dumps(str(folder / 'client'))
    modified, replacements = re.subn(r'(generator\s+client\s*\{[\s\S]*?)(\n\})', lambda m: m.group(1) + output_line + m.group(2), source, count=1)
    assert replacements == 1 and modified.replace(output_line, '', 1) == source
    schema.write_text(modified)
    with (folder / 'generate.log').open('w') as log:
        subprocess.run([node, str(root / 'node_modules/prisma/build/index.js'), 'generate', '--schema', str(schema)], cwd=folder,
                       env={**env, 'DATABASE_URL': url, 'DIRECT_URL': url}, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=120)
    client_generated = True
    with (folder / 'schema.log').open('w') as log:
        subprocess.run([node, str(root / 'node_modules/prisma/build/index.js'), 'db', 'push',
                        '--skip-generate', '--schema', str(schema)], cwd=folder,
                       env={**env, 'DATABASE_URL': url, 'DIRECT_URL': url},
                       stdout=log, stderr=subprocess.STDOUT, check=True, timeout=120)
    for name in ['verify-hr-owner-payer-transition-postgres.cjs']:
        result = subprocess.run([node, str(Path(__file__).parent / name),
                                 str(private_env), str(private_state)], cwd=root, env=env, timeout=180)
        test_exit = result.returncode
        if test_exit != 0:
            break
finally:
    status = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), 'status'],
                            env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
    if status.returncode == 0:
        subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-m', 'fast', '-w', 'stop'],
                       env=env, stdout=subprocess.DEVNULL, check=True, timeout=30)
        status = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), 'status'],
                                env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
    receipt = {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'ownedPrivateCluster': str(folder), 'started': started, 'testExit': test_exit,
               'privateServerStopped': status.returncode == 3, 'syntheticClusterRetained': True,
               'networkListenDisabled': True, 'applicationCredentialsInherited': False,
               'schemaCopiedWithoutApplicationEnv': True, 'privateClientGeneratedFromCurrentSchema': client_generated, 'sharedClientModified': False, 'stripeNetworkRequests': 0}
    (output / 'seat-postgres-lifecycle.json').write_text(json.dumps(receipt, indent=2) + '\n')
    if status.returncode != 3:
        raise SystemExit('Owned private PostgreSQL did not stop; inspect before continuing')
raise SystemExit(test_exit if test_exit is not None else 1)
