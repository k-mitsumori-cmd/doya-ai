"""Owned private PostgreSQL with application credentials excluded; retain stopped synthetic data."""
from pathlib import Path
import os, tempfile, subprocess, json, datetime

root = Path(__file__).resolve().parents[2]
candidates = [Path('/opt/homebrew/opt/postgresql@17/bin'), *sorted(Path('/usr/lib/postgresql').glob('*/bin'), reverse=True)]
pg = next((p for p in candidates if (p / 'initdb').is_file() and (p / 'pg_ctl').is_file()), None)
if not pg:
    raise SystemExit('PostgreSQL initdb/pg_ctl required for isolated AskLink edit regression')
folder = Path(tempfile.mkdtemp(prefix='doya-asklink-edit-', dir='/tmp'))
folder.chmod(0o700)
socket = folder / 'socket'
socket.mkdir(mode=0o700)
env = {k: os.environ[k] for k in ['PATH', 'HOME', 'LANG', 'TMPDIR', 'DOYA_TEST_BASELINE', 'DOYA_ASKLINK_EDIT_PG_OUTPUT'] if k in os.environ}
exitcode = None
try:
    with (folder / 'init.log').open('w') as log:
        subprocess.run([str(pg / 'initdb'), '-D', str(folder / 'data'), '-U', 'doya_asklink_edit', '--auth=trust', '--no-locale', '--encoding=UTF8'], env=env, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=60)
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-o', "-k " + str(socket) + " -h '' -p 56489 -F -c timezone=UTC -c unix_socket_permissions=0700 -c shared_buffers=16MB", '-l', str(folder / 'server.log'), '-w', 'start'], env=env, stdout=subprocess.DEVNULL, check=True, timeout=30)
    url = 'postgresql://doya_asklink_edit@localhost:56489/postgres?host=' + str(socket) + '&sslmode=disable&connection_limit=8'
    result = subprocess.run(['node', 'scripts/security-regression/verify-asklink-edit-postgres.cjs'], cwd=root, env={**env, 'DOYA_PRIVATE_TEST_DATABASE_URL': url, 'DOYA_PRIVATE_TEST_SOCKET': str(socket)}, timeout=180)
    exitcode = result.returncode
finally:
    status = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), 'status'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
    if status.returncode == 0:
        subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-m', 'fast', '-w', 'stop'], env=env, stdout=subprocess.DEVNULL, check=True, timeout=30)
        status = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), 'status'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
    output = Path(env.get('DOYA_ASKLINK_EDIT_PG_OUTPUT', str(root / 'docs/audits/2026-10-06-all-services-recheck/asklink-edit-postgres-results.json')))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.with_name(output.stem + '-lifecycle.json').write_text(json.dumps({'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'folder': str(folder), 'nodeExit': exitcode, 'privateServerStopped': status.returncode == 3, 'pgCtlFinalStatus': status.returncode, 'syntheticClusterRetained': True, 'networkListenDisabled': True, 'folderMode': oct(folder.stat().st_mode & 0o777), 'applicationEnvironmentInherited': False}, indent=2) + '\n')
    if status.returncode != 3:
        raise SystemExit('Owned private PostgreSQL did not stop; inspect before continuing')
raise SystemExit(exitcode if exitcode is not None else 1)
