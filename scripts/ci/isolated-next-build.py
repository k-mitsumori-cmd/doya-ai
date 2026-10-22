#!/usr/bin/env python3
"""No-secret, network-isolated Next production build evidence for CI.

Dependency installation and Prisma generation happen in the workflow before this
script. Only the Next build child enters a fresh Linux network namespace. Never
use this output as evidence of real Google Fonts, provider, database, or browser
behavior.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time


ROOT = Path(__file__).resolve().parents[2]
FONT_FIXTURE = ROOT / "scripts/ci/google-fonts-build-fixture.cjs"
FONT_SHA256 = "052c50ebe4c4e42e41276e5d1eff5f29fa2458cca458400069749c9171583ba5"
FONT_URLS = (
    "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap",
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&display=swap",
)
BUILD_TIMEOUT_SECONDS = 35 * 60
BUILD_MIN_START_BYTES = 8 * 1024**3
BUILD_MIN_RUNNING_BYTES = 3 * 1024**3
SOURCE_PREFIXES = ("src/", "seo/", "scripts/", "prisma/", "public/", "assets/", ".github/")
AUDIT_SOURCE_SUFFIXES = (".cjs", ".js", ".mjs", ".ts", ".tsx", ".py", ".sh", ".sql")
SOURCE_ROOT_FILES = {
    "package.json", "package-lock.json", "next.config.js", "next.config.mjs",
    "tsconfig.json", "next-env.d.ts", "postcss.config.js", "postcss.config.mjs",
    "tailwind.config.js", "tailwind.config.ts", "eslint.config.js", "eslint.config.mjs",
    "vercel.json", ".vercelignore", ".gitignore", ".eslintrc.json",
    "middleware.ts", "instrumentation.ts", "asc-shot-upload.cjs",
}


class GateError(RuntimeError):
    pass


def run_git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def prisma_generator_guard_inputs() -> dict[str, object]:
    names = (
        "scripts/prisma/generate.cjs",
        "scripts/prisma/generator-utf8-preload.cjs",
        "node_modules/prisma/build/index.js",
        "node_modules/@prisma/client/generator-build/index.js",
    )
    versions = {
        name: json.loads((ROOT / f"node_modules/{name}/package.json").read_text())["version"]
        for name in ("prisma", "@prisma/client")
    }
    if set(versions.values()) != {"5.22.0"}:
        raise GateError("Prisma generator package version changed")
    return {"versions": versions, "sha256": {name: sha256(ROOT / name) for name in names}}


def is_source_path(name: str) -> bool:
    return (name.startswith(SOURCE_PREFIXES) or name in SOURCE_ROOT_FILES or
            (name.startswith("docs/audits/") and name.endswith(AUDIT_SOURCE_SUFFIXES)))


def working_changes() -> list[str]:
    raw = subprocess.check_output(["git", "status", "--porcelain=v1", "--untracked-files=all", "-z"], cwd=ROOT)
    return [os.fsdecode(record[3:]) for record in raw.split(b"\0") if len(record) >= 4]


def ignored_source_files() -> list[str]:
    raw = subprocess.check_output([
        "git", "ls-files", "--others", "-i", "--exclude-standard", "-z", "--",
        "src", "seo", "scripts", "prisma", "public", "assets", ".github", "docs/audits",
    ], cwd=ROOT)
    return [os.fsdecode(name) for name in raw.split(b"\0") if name and is_source_path(os.fsdecode(name))]


def source_digest() -> str:
    """Hash executable/config/schema/package inputs; reports in docs may be rewritten by suites."""
    names = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).split(b"\0")
    digest = hashlib.sha256()
    for raw in filter(None, names):
        if not is_source_path(os.fsdecode(raw)):
            continue
        path = ROOT / os.fsdecode(raw)
        digest.update(raw + b"\0")
        if path.is_symlink():
            digest.update(os.fsencode(os.readlink(path)))
        elif path.is_file():
            digest.update(bytes.fromhex(sha256(path)))
        else:
            raise GateError(f"tracked path missing: {os.fsdecode(raw)}")
    return digest.hexdigest()


def reject_env_files(root: Path) -> None:
    forbidden = sorted(path.name for path in root.glob(".env*") if path.is_file() or path.is_symlink())
    if (root / ".vercel").exists():
        forbidden.append(".vercel")
    if forbidden:
        raise GateError("environment files are present: " + ", ".join(forbidden))


def validate_checkout(event_sha: str, *, require_clean: bool = False) -> dict[str, str]:
    head = run_git("rev-parse", "HEAD")
    if not event_sha or event_sha != head:
        raise GateError("checkout HEAD does not match exact GITHUB_SHA")
    changes = working_changes()
    if require_clean and changes:
        raise GateError("fresh checkout has modified or untracked files")
    if any(is_source_path(name) for name in changes):
        raise GateError("executable, configuration, schema, or package source changed")
    if ignored_source_files():
        raise GateError("ignored files appeared under an executable source directory")
    reject_env_files(ROOT)
    return {"eventSha": event_sha, "head": head, "tree": run_git("rev-parse", "HEAD^{tree}")}


def validate_font_fixture(node: str) -> dict[str, object]:
    fixture_hash = sha256(FONT_FIXTURE)
    if fixture_hash != FONT_SHA256:
        raise GateError("fixed two-URL font fixture changed")
    query = "const x=require(process.argv[1]);console.log(JSON.stringify(Object.keys(x).sort()))"
    urls = json.loads(subprocess.check_output([node, "-e", query, str(FONT_FIXTURE)], text=True))
    if urls != sorted(FONT_URLS):
        raise GateError("font fixture must contain exactly the two pinned CSS URLs")
    css_hook = ROOT / "node_modules/next/dist/compiled/@next/font/dist/google/fetch-css-from-google-fonts.js"
    font_hook = ROOT / "node_modules/next/dist/compiled/@next/font/dist/google/fetch-font-file.js"
    if not css_hook.is_file() or not font_hook.is_file():
        raise GateError("installed Next font hooks are missing")
    css_source = css_hook.read_text()
    font_source = font_hook.read_text()
    if "NEXT_FONT_GOOGLE_MOCKED_RESPONSES" not in css_source or "Missing mocked response for URL:" not in css_source:
        raise GateError("installed Next CSS hook no longer rejects unknown font URLs")
    if "NEXT_FONT_GOOGLE_MOCKED_RESPONSES" not in font_source:
        raise GateError("installed Next font-file hook changed")
    package = json.loads((ROOT / "node_modules/next/package.json").read_text())
    return {
        "fixtureSha256": fixture_hash,
        "fixtureUrls": urls,
        "installedNextVersion": package["version"],
        "cssHookSha256": sha256(css_hook),
        "fontFileHookSha256": sha256(font_hook),
    }


def child_env(evidence: Path, node: str) -> dict[str, str]:
    # Keep build scratch outside the small artifact directory.
    runtime = evidence.parent / (evidence.name + "-runtime")
    home = runtime / "empty-home"
    temp = runtime / "build-tmp"
    runtime.mkdir(mode=0o700, parents=True, exist_ok=True)
    home.mkdir(mode=0o700, exist_ok=True)
    temp.mkdir(mode=0o700, exist_ok=True)
    return {
        "PATH": str(Path(node).parent) + ":/usr/local/bin:/usr/bin:/bin",
        "HOME": str(home),
        "TMPDIR": str(temp),
        "LANG": "C.UTF-8",
        "NODE_ENV": "production",
        "CI": "1",
        "NEXT_TELEMETRY_DISABLED": "1",
        "NEXT_FONT_GOOGLE_MOCKED_RESPONSES": str(FONT_FIXTURE),
        "DOYA_BUILD_NO_WEBPACK_CACHE": "1",
        # All values are fixed syntactic placeholders. The child has no network.
        "DATABASE_URL": "postgresql://ci:ci@127.0.0.1:9/ci",
        "DIRECT_URL": "postgresql://ci:ci@127.0.0.1:9/ci",
        "NEXTAUTH_URL": "https://example.invalid",
        "NEXT_PUBLIC_APP_URL": "https://example.invalid",
        "NEXT_PUBLIC_BASE_URL": "https://example.invalid",
        "NEXTAUTH_SECRET": "synthetic-next-build-only-secret-00000000",
        "STRIPE_SECRET_KEY": "sk_test_synthetic_next_build_only",
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_test_synthetic_next_build_only",
        "OPENAI_API_KEY": "sk-synthetic-next-build-only",
        "GEMINI_API_KEY": "synthetic-next-build-only",
    }


def namespace_command(argv: list[str], environment: dict[str, str]) -> list[str]:
    sudo = shutil.which("sudo")
    unshare = shutil.which("unshare")
    env = shutil.which("env")
    if not sudo or not unshare or not env or sys.platform != "linux":
        raise GateError("Linux sudo/unshare/env network namespace prerequisites unavailable")
    return [
        sudo, "-n", unshare, "--net", "--fork", "--kill-child=SIGTERM", f"--setuid={os.getuid()}",
        f"--setgid={os.getgid()}", "--", env, "-i",
        *(f"{key}={value}" for key, value in sorted(environment.items())),
        *argv,
    ]


PROBE_SOURCE = """import errno,json,os,socket
s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.settimeout(2)
try:
 s.connect(('203.0.113.1',443))
 print(json.dumps({'namespace':os.readlink('/proc/self/ns/net'),'denied':False,'reason':'connected'}))
except OSError as e:
 print(json.dumps({'namespace':os.readlink('/proc/self/ns/net'),'denied':e.errno in (errno.ENETUNREACH,errno.EHOSTUNREACH,errno.EPERM,errno.EACCES),'errno':e.errno}))
finally:s.close()
"""


def validate_probe(parent_namespace: str, output: str) -> dict[str, object]:
    try:
        probe = json.loads(output)
    except json.JSONDecodeError as error:
        raise GateError("namespace probe returned invalid JSON") from error
    if probe.get("namespace") == parent_namespace or not probe.get("denied"):
        raise GateError("network namespace or outbound-denial probe failed")
    return probe


def network_probe(environment: dict[str, str]) -> dict[str, object]:
    parent_namespace = os.readlink("/proc/self/ns/net")
    command = namespace_command([sys.executable, "-c", PROBE_SOURCE], environment)
    completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=15, check=False)
    if completed.returncode != 0:
        raise GateError(f"network namespace probe exit {completed.returncode}: {completed.stderr[-500:]}")
    return validate_probe(parent_namespace, completed.stdout)


GROUP_TERM_GRACE_SECONDS = 10
GROUP_KILL_GRACE_SECONDS = 10


def live_process_group_members(pgid: int) -> list[int]:
    # A reparented child may survive after the leader exits. Ignore only zombies.
    listing = subprocess.run(["ps", "-eo", "pid=,pgid=,stat="], capture_output=True, text=True, timeout=5, check=True)
    members = []
    for line in listing.stdout.splitlines():
        fields = line.split()
        if len(fields) >= 3 and int(fields[1]) == pgid and not fields[2].startswith("Z"):
            members.append(int(fields[0]))
    return members


def wait_group_drained(pgid: int, seconds: float) -> bool:
    deadline = time.monotonic() + seconds
    while True:
        if not live_process_group_members(pgid):
            return True
        if time.monotonic() >= deadline:
            return False
        time.sleep(min(0.1, max(0, deadline - time.monotonic())))


def stop_process_group(process: subprocess.Popen[bytes]) -> dict[str, object]:
    escalated = False
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    if not wait_group_drained(process.pid, GROUP_TERM_GRACE_SECONDS):
        escalated = True
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        if not wait_group_drained(process.pid, GROUP_KILL_GRACE_SECONDS):
            raise GateError(f"build process group still live after SIGKILL: {live_process_group_members(process.pid)}")
    process.wait(timeout=5)
    return {"groupDrained": True, "killEscalated": escalated}


def memory_available_bytes() -> int | None:
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemAvailable:"):
                return int(line.split()[1]) * 1024
    except (OSError, ValueError, IndexError):
        pass
    return None


def run_build(command: list[str], evidence: Path) -> dict[str, object]:
    log = evidence / "next-build.log"
    free_start = shutil.disk_usage(ROOT).free
    if free_start < BUILD_MIN_START_BYTES:
        raise GateError("build disk preflight below 8 GiB")
    memory_start = memory_available_bytes()
    began = time.monotonic()
    with log.open("wb") as output:
        process = subprocess.Popen(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
        reason = None
        cleanup = None
        minimum = free_start
        while process.poll() is None:
            elapsed = time.monotonic() - began
            current = shutil.disk_usage(ROOT).free
            minimum = min(minimum, current)
            if elapsed >= BUILD_TIMEOUT_SECONDS:
                reason = "timeout"
            elif current < BUILD_MIN_RUNNING_BYTES:
                reason = "disk-below-3-GiB"
            if reason:
                cleanup = stop_process_group(process)
                break
            time.sleep(2)
        if reason is None and live_process_group_members(process.pid):
            cleanup = stop_process_group(process)
            reason = "orphaned-process-after-exit"
    result = {
        "exitCode": process.returncode,
        "reason": reason,
        "cleanup": cleanup,
        "durationSeconds": round(time.monotonic() - began, 2),
        "freeBytesBefore": free_start,
        "minimumFreeBytes": minimum,
        "freeBytesAfter": shutil.disk_usage(ROOT).free,
        "memoryAvailableBytesBefore": memory_start,
        "memoryAvailableBytesAfter": memory_available_bytes(),
        "logSha256": sha256(log),
    }
    return result


def verify_output() -> dict[str, object]:
    required = ["BUILD_ID", "routes-manifest.json", "prerender-manifest.json", "required-server-files.json", "trace"]
    missing = [name for name in required if not (ROOT / ".next" / name).is_file()]
    if not (ROOT / ".next/server").is_dir():
        missing.append("server/")
    if missing:
        raise GateError("Next build output missing: " + ", ".join(missing))
    return {"buildIdSha256": sha256(ROOT / ".next/BUILD_ID"), "requiredOutputs": required + ["server/"]}


def write_manifest(evidence: Path, value: dict[str, object]) -> None:
    (evidence / "manifest.json").write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["prepare", "build", "finalize"])
    parser.add_argument("--evidence-dir", required=True, type=Path)
    arguments = parser.parse_args()
    evidence = arguments.evidence_dir.resolve()
    evidence.mkdir(parents=True, exist_ok=True)
    manifest_path = evidence / "manifest.json"
    manifest: dict[str, object] = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    try:
        manifest["checkout"] = validate_checkout(os.environ.get("GITHUB_SHA", ""), require_clean=arguments.mode == "prepare")
        if arguments.mode == "prepare":
            if (ROOT / ".next").exists():
                raise GateError("fresh checkout already has .next output")
            manifest["initialSourceSha256"] = source_digest()
            manifest["inputsSha256"] = {name: sha256(ROOT / name) for name in ("package.json", "package-lock.json", "prisma/schema.prisma", "next.config.js")}
            manifest["status"] = "prepared"
            return 0
        if arguments.mode == "finalize":
            if manifest.get("status") != "build-passed":
                raise GateError("build did not complete before finalization")
            logs = ("named-suites.log", "type-before.log", "next-build.log", "type-after.log")
            if any(not (evidence / name).is_file() for name in logs):
                raise GateError("required suite, type, or build log is missing")
            if manifest.get("output") != verify_output():
                raise GateError("Next build output changed after generated-type check")
            if manifest.get("initialSourceSha256") != source_digest():
                raise GateError("tracked source changed after generated-type check")
            if manifest.get("prismaGeneratorGuard") != prisma_generator_guard_inputs():
                raise GateError("Prisma generator guard input changed after generation")
            manifest["gateLogsSha256"] = {name: sha256(evidence / name) for name in logs}
            manifest["nonSourceWorkingChanges"] = [name for name in working_changes() if not is_source_path(name)]
            manifest["status"] = "passed"
            return 0
        if manifest.get("status") != "prepared":
            raise GateError("missing exact checkout preflight evidence")
        if manifest.get("checkout") != validate_checkout(os.environ.get("GITHUB_SHA", "")):
            raise GateError("checkout changed since preflight")
        if manifest.get("initialSourceSha256") != source_digest():
            raise GateError("tracked source changed since preflight")
        if (ROOT / ".next").exists():
            raise GateError("build must start with empty .next")
        node = shutil.which("node")
        if not node:
            raise GateError("installed node executable missing")
        manifest["nodeVersion"] = subprocess.check_output([node, "--version"], text=True).strip()
        manifest["font"] = validate_font_fixture(node)
        generated_client = ROOT / "node_modules/.prisma/client/index.js"
        generated_types = ROOT / "node_modules/.prisma/client/index.d.ts"
        if not generated_client.is_file() or not generated_types.is_file():
            raise GateError("Prisma client was not generated")
        manifest["generatedPrismaSha256"] = {"index.js": sha256(generated_client), "index.d.ts": sha256(generated_types)}
        manifest["prismaGeneratorGuard"] = prisma_generator_guard_inputs()
        environment = child_env(evidence, node)
        manifest["buildEnvNames"] = sorted(environment)
        manifest["namespaceProbe"] = network_probe(environment)
        manifest["status"] = "building"
        write_manifest(evidence, manifest)
        command = namespace_command([node, str(ROOT / "node_modules/next/dist/bin/next"), "build"], environment)
        manifest["build"] = run_build(command, evidence)
        if manifest["build"]["reason"] or manifest["build"]["exitCode"] != 0:
            raise GateError(f"isolated Next build failed: {manifest['build']['reason'] or 'exit'} ({manifest['build']['exitCode']})")
        manifest["output"] = verify_output()
        if validate_checkout(os.environ.get("GITHUB_SHA", "")) != manifest["checkout"]:
            raise GateError("checkout changed during the build")
        if source_digest() != manifest["initialSourceSha256"]:
            raise GateError("tracked source changed during the build")
        manifest["status"] = "build-passed"
        return 0
    except (GateError, OSError, subprocess.SubprocessError) as error:
        manifest["status"] = "failed"
        manifest["error"] = str(error)
        print(f"isolated Next build gate: {error}", file=sys.stderr)
        return 1
    finally:
        write_manifest(evidence, manifest)


if __name__ == "__main__":
    raise SystemExit(main())
