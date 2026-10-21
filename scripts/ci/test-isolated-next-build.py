#!/usr/bin/env python3
"""Cheap failure-path tests; these do not start Next, Prisma, or a namespace."""

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("isolated_next_build", HERE / "isolated-next-build.py")
assert SPEC and SPEC.loader
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


class GateTests(unittest.TestCase):
    def test_child_env_creates_fresh_runtime_and_has_only_fixed_names(self):
        with tempfile.TemporaryDirectory() as directory:
            evidence = Path(directory) / "evidence"
            evidence.mkdir()
            environment = gate.child_env(evidence, "/usr/bin/node")
            runtime = Path(directory) / "evidence-runtime"
            self.assertTrue((runtime / "empty-home").is_dir())
            self.assertTrue((runtime / "build-tmp").is_dir())
            self.assertEqual(runtime.stat().st_mode & 0o777, 0o700)
            self.assertEqual(environment["HOME"], str(runtime / "empty-home"))
            self.assertEqual(environment["TMPDIR"], str(runtime / "build-tmp"))
            self.assertEqual(environment["NEXT_FONT_GOOGLE_MOCKED_RESPONSES"], str(gate.FONT_FIXTURE))
            self.assertEqual(set(environment), {
                "PATH", "HOME", "TMPDIR", "LANG", "NODE_ENV", "CI", "NEXT_TELEMETRY_DISABLED",
                "NEXT_FONT_GOOGLE_MOCKED_RESPONSES", "DOYA_BUILD_NO_WEBPACK_CACHE", "DATABASE_URL",
                "DIRECT_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_BASE_URL",
                "NEXTAUTH_SECRET", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
                "OPENAI_API_KEY", "GEMINI_API_KEY",
            })

    def test_deny_probe_requires_different_namespace_and_deny(self):
        compile(gate.PROBE_SOURCE, "<namespace-probe>", "exec")
        self.assertEqual(gate.validate_probe("net:[1]", json.dumps({"namespace": "net:[2]", "denied": True}))["denied"], True)
        with self.assertRaises(gate.GateError):
            gate.validate_probe("net:[1]", json.dumps({"namespace": "net:[1]", "denied": True}))
        with self.assertRaises(gate.GateError):
            gate.validate_probe("net:[1]", json.dumps({"namespace": "net:[2]", "denied": False}))
        with self.assertRaises(gate.GateError):
            gate.validate_probe("net:[1]", "not JSON")

    def test_env_files_and_vercel_directory_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            gate.reject_env_files(root)
            (root / ".env.production.local").write_text("synthetic")
            with self.assertRaises(gate.GateError):
                gate.reject_env_files(root)
            (root / ".env.production.local").unlink()
            (root / ".vercel").mkdir()
            with self.assertRaises(gate.GateError):
                gate.reject_env_files(root)

    def test_ignored_audit_executable_is_denied_but_report_is_allowed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            (root / ".gitignore").write_text("docs/audits/\n")
            audits = root / "docs/audits"
            audits.mkdir(parents=True)
            (audits / "report.json").write_text("{}")
            with mock.patch.object(gate, "ROOT", root):
                self.assertEqual(gate.ignored_source_files(), [])
                (audits / "verify-example.cjs").write_text("throw Error('ignored')")
                self.assertEqual(gate.ignored_source_files(), [str(Path("docs") / "audits" / "verify-example.cjs")])
                with mock.patch.object(gate, "run_git", return_value="a" * 40), \
                     mock.patch.object(gate, "working_changes", return_value=[]):
                    with self.assertRaises(gate.GateError):
                        gate.validate_checkout("a" * 40)

    def test_namespace_command_has_no_fallback_and_clears_environment(self):
        with mock.patch.object(gate.sys, "platform", "linux"), mock.patch.object(gate.shutil, "which", side_effect=lambda name: "/usr/bin/" + name):
            command = gate.namespace_command(["/usr/bin/node", "build"], {"PATH": "/usr/bin", "CI": "1"})
        self.assertEqual(command[:5], ["/usr/bin/sudo", "-n", "/usr/bin/unshare", "--net", "--fork"])
        self.assertIn("--kill-child=SIGTERM", command)
        self.assertIn("-i", command)
        self.assertEqual(command[-2:], ["/usr/bin/node", "build"])
        with mock.patch.object(gate.shutil, "which", return_value=None):
            with self.assertRaises(gate.GateError):
                gate.namespace_command(["node", "build"], {})

    def test_only_pinned_font_responses(self):
        node = gate.shutil.which("node")
        self.assertIsNotNone(node)
        valid = gate.validate_font_fixture(node)
        self.assertEqual(valid["fixtureUrls"], sorted(gate.FONT_URLS))
        with mock.patch.object(gate, "FONT_SHA256", "0" * 64):
            with self.assertRaises(gate.GateError):
                gate.validate_font_fixture(node)

    def test_timeout_terminates_the_supervised_process_group(self):
        with tempfile.TemporaryDirectory() as directory, \
             mock.patch.object(gate, "BUILD_TIMEOUT_SECONDS", 0.01), \
             mock.patch.object(gate, "BUILD_MIN_START_BYTES", 0), \
             mock.patch.object(gate, "BUILD_MIN_RUNNING_BYTES", 0):
            pid_file = Path(directory) / "pid"
            script = "import os,time,pathlib,sys;pathlib.Path(sys.argv[1]).write_text(str(os.getpid()));time.sleep(30)"
            result = gate.run_build([sys.executable, "-c", script, str(pid_file)], Path(directory))
            self.assertEqual(result["reason"], "timeout")
            self.assertEqual(result["cleanup"], {"groupDrained": True, "killEscalated": False})
            self.assertNotEqual(result["exitCode"], 0)
            pid = int(pid_file.read_text())
            with self.assertRaises(ProcessLookupError):
                os.kill(pid, 0)

    def test_timeout_kills_child_that_ignores_term_after_leader_exits(self):
        with tempfile.TemporaryDirectory() as directory, \
             mock.patch.object(gate, "BUILD_TIMEOUT_SECONDS", 0.01), \
             mock.patch.object(gate, "BUILD_MIN_START_BYTES", 0), \
             mock.patch.object(gate, "BUILD_MIN_RUNNING_BYTES", 0), \
             mock.patch.object(gate, "GROUP_TERM_GRACE_SECONDS", 0.2):
            pid_file = Path(directory) / "child-pid"
            script = "import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(30)"
            leader = (
                "import os,subprocess,sys,time,pathlib;"
                "p=subprocess.Popen([sys.executable,'-c',sys.argv[2]]);"
                "pathlib.Path(sys.argv[1]).write_text(f'{p.pid} {os.getpgrp()}');time.sleep(30)"
            )
            result = gate.run_build([sys.executable, "-c", leader, str(pid_file), script], Path(directory))
            self.assertEqual(result["reason"], "timeout")
            self.assertEqual(result["cleanup"], {"groupDrained": True, "killEscalated": True})
            _, group_id = map(int, pid_file.read_text().split())
            self.assertEqual(gate.live_process_group_members(group_id), [])

    def test_successful_leader_with_surviving_child_is_not_a_pass(self):
        with tempfile.TemporaryDirectory() as directory, \
             mock.patch.object(gate, "BUILD_MIN_START_BYTES", 0), \
             mock.patch.object(gate, "BUILD_MIN_RUNNING_BYTES", 0), \
             mock.patch.object(gate, "GROUP_TERM_GRACE_SECONDS", 0.2):
            pid_file = Path(directory) / "child-pid"
            child = "import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(30)"
            leader = (
                "import os,subprocess,sys,time,pathlib;"
                "p=subprocess.Popen([sys.executable,'-c',sys.argv[2]]);"
                "pathlib.Path(sys.argv[1]).write_text(f'{p.pid} {os.getpgrp()}');"
                "time.sleep(0.3)"
            )
            result = gate.run_build([sys.executable, "-c", leader, str(pid_file), child], Path(directory))
            self.assertEqual(result["exitCode"], 0)
            self.assertEqual(result["reason"], "orphaned-process-after-exit")
            self.assertEqual(result["cleanup"], {"groupDrained": True, "killEscalated": True})
            _, group_id = map(int, pid_file.read_text().split())
            self.assertEqual(gate.live_process_group_members(group_id), [])

    def test_low_disk_fails_before_starting_a_build(self):
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(gate, "BUILD_MIN_START_BYTES", 10**30):
            with self.assertRaises(gate.GateError):
                gate.run_build([sys.executable, "-c", "raise RuntimeError('must not start')"], Path(directory))

    def test_nonzero_build_exit_is_not_a_pass(self):
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(gate, "BUILD_MIN_START_BYTES", 0):
            result = gate.run_build([sys.executable, "-c", "import sys;sys.exit(17)"], Path(directory))
            self.assertEqual(result["exitCode"], 17)
            self.assertIsNone(result["reason"])

    def test_event_sha_mismatch_fails_before_build(self):
        with mock.patch.object(gate, "run_git", return_value="a" * 40):
            with self.assertRaises(gate.GateError):
                gate.validate_checkout("b" * 40)

    def test_report_outputs_are_recordable_but_source_mutation_is_rejected(self):
        self.assertFalse(gate.is_source_path("docs/audits/report.json"))
        self.assertTrue(gate.is_source_path(str(Path("docs") / "audits" / "2026-10-06-all-services-recheck" / "verify-example.cjs")))
        self.assertTrue(gate.is_source_path(str(Path("src") / "app" / "page.tsx")))
        self.assertTrue(gate.is_source_path("package-lock.json"))
        event = "a" * 40
        with mock.patch.object(gate, "run_git", side_effect=lambda *args: event if args[-1] == "HEAD" else "b" * 40), \
             mock.patch.object(gate, "reject_env_files"), \
             mock.patch.object(gate, "ignored_source_files", return_value=[]), \
             mock.patch.object(gate, "working_changes", return_value=["docs/audits/report.json"]):
            self.assertEqual(gate.validate_checkout(event)["head"], event)
            with self.assertRaises(gate.GateError):
                gate.validate_checkout(event, require_clean=True)
        with mock.patch.object(gate, "run_git", return_value=event), \
             mock.patch.object(gate, "reject_env_files"), \
             mock.patch.object(gate, "ignored_source_files", return_value=[]), \
             mock.patch.object(gate, "working_changes", return_value=[str(Path("src") / "app" / "page.tsx")]):
            with self.assertRaises(gate.GateError):
                gate.validate_checkout(event)
        with mock.patch.object(gate, "run_git", return_value=event), \
             mock.patch.object(gate, "reject_env_files"), \
             mock.patch.object(gate, "ignored_source_files", return_value=[]), \
             mock.patch.object(gate, "working_changes", return_value=[str(Path("docs") / "audits" / "x" / "verify-example.cjs")]):
            with self.assertRaises(gate.GateError):
                gate.validate_checkout(event)

    def test_existing_ci_job_remains_mandatory_and_new_job_is_separate(self):
        current = (gate.ROOT / ".github/workflows/ci.yml").read_bytes()
        parts = current.split(b"\n  next-build-isolated:\n")
        self.assertEqual(len(parts), 2)
        original, suffix_bytes = parts
        suffix = suffix_bytes.decode()
        self.assertIn(b"  check:\n", original)
        for mandatory in (b"npm run lint", b"npm run test:security", b"membership-known-role", b"npx tsc --noEmit"):
            self.assertIn(mandatory, original)
        self.assertIn("persist-credentials: false", suffix)
        self.assertIn("python3 scripts/ci/isolated-next-build.py build", suffix)
        self.assertIn("if: always()", suffix)
        self.assertNotIn("continue-on-error", current.decode())


if __name__ == "__main__":
    unittest.main()
