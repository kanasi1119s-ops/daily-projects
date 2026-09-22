'use strict';

// Local, file-based persistence for PulseBoard.
//
// Deliberately simple: a single JSON file on disk, written atomically
// (write to a temp file in the same directory, then rename over the real
// file) so a crash mid-write can never leave a half-written/corrupt file
// in place. No external database, no cloud service, no new dependency.

const fs = require('node:fs');
const path = require('node:path');

const CURRENT_VERSION = 1;

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Load persisted state from disk.
 * Returns null when the file does not exist yet (first run), or when it
 * exists but cannot be parsed (corrupt/unexpected content) — callers should
 * treat null as "start from empty state" rather than crash the app.
 */
function loadSync(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    console.warn(`persistence: could not read ${filePath}: ${err.message}`); // eslint-disable-line no-console
    return null;
  }
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (err) {
    console.warn(`persistence: ${filePath} contains invalid JSON, ignoring it: ${err.message}`); // eslint-disable-line no-console
    return null;
  }
}

/**
 * Persist state to disk atomically: write to a sibling temp file, then
 * rename it over the destination. A rename on the same filesystem is
 * atomic, so readers (or a process that crashes mid-write) never see a
 * partially-written file.
 */
function saveSync(filePath, data) {
  ensureDir(filePath);
  const payload = JSON.stringify({ version: CURRENT_VERSION, ...data }, null, 2);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, payload, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

module.exports = { loadSync, saveSync, CURRENT_VERSION };
