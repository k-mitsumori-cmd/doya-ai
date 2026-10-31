"""Disposable Unix-socket PostgreSQL; never inherits application credentials."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
candidates = ([Path(os.environ['DOYA_PRIVATE_POSTGRES_BIN'])] if os.environ.get('DOYA_PRIVATE_POSTGRES_BIN') else
              [Path('/opt/homebrew/opt/postgresql@17/bin'), *sorted(Path('/usr/lib/postgresql').glob('*/bin'), reverse=True)])
pg = next((p for p in candidates if (p / 'initdb').is_file() and (p / 'pg_ctl').is_file()), None)
if not pg:
    raise SystemExit('PostgreSQL initdb/pg_ctl required for isolated Shanai transcription regression')
folder = Path(tempfile.mkdtemp(prefix='doya-shanai-transcript-', dir='/tmp'))
folder.chmod(0o700)
socket = folder / 'socket'
socket.mkdir(mode=0o700)
env = {k: os.environ[k] for k in ['PATH', 'HOME', 'LANG', 'TMPDIR', 'DOYA_SHANAI_TRANSCRIPT_ROOT', 'DOYA_SHANAI_TRANSCRIPT_DEPS', 'DOYA_SHANAI_TRANSCRIPT_PG_OUTPUT'] if k in os.environ}
started = False
try:
    with (folder / 'init.log').open('w') as log:
        subprocess.run([str(pg / 'initdb'), '-D', str(folder / 'data'), '-U', 'doya_shanai', '--auth=trust', '--no-locale', '--encoding=UTF8'], env=env, stdout=log, stderr=subprocess.STDOUT, check=True, timeout=60)
    started = True
    subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-o', f"-k {socket} -h '' -p 56485 -F -c timezone=UTC", '-l', str(folder / 'server.log'), '-w', 'start'], env=env, stdout=subprocess.DEVNULL, check=True, timeout=30)
    url = f'postgresql://doya_shanai@localhost:56485/postgres?host={socket}&sslmode=disable&connection_limit=8'
    result = subprocess.run(['node', 'scripts/security-regression/verify-shanai-transcription-postgres.cjs'], cwd=root, env={**env, 'DOYA_PRIVATE_TEST_DATABASE_URL': url, 'DOYA_PRIVATE_TEST_SOCKET': str(socket)}, timeout=180)
    if result.returncode:
        raise SystemExit(result.returncode)
finally:
    if started:
        subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), '-m', 'fast', '-w', 'stop'], env=env, stdout=subprocess.DEVNULL, check=True, timeout=30)
        status = subprocess.run([str(pg / 'pg_ctl'), '-D', str(folder / 'data'), 'status'], env=env, stdout=subprocess.DEVNULL, timeout=10)
        if status.returncode != 3:
            raise SystemExit('Private PostgreSQL did not stop; files retained')
    if folder.parent == Path('/tmp') and folder.name.startswith('doya-shanai-transcript-'):
        shutil.rmtree(folder)
