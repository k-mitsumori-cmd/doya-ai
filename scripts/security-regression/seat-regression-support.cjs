// Shared paths only. No application environment or provider credentials are read.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const root = path.resolve(__dirname, '../..');
function seatSourcePath(file) {
  const base = process.env.DOYA_TEST_BASELINE;
  const candidate = base && path.join(base, file);
  return candidate && fs.existsSync(candidate) ? candidate : path.join(root, file);
}
const evidenceDir = process.env.DOYA_SEAT_EVIDENCE_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'doya-seat-regression-'));
fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
module.exports = { root, seatSourcePath, evidenceDir };
