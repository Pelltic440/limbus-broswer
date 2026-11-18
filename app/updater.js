'use strict';
// Keeps the browser engine (Electron/Chromium) current: checks the npm registry for a newer patch of the
// same major version, downloads the official Windows build from GitHub, verifies its checksum, then a small
// PowerShell script swaps the engine files while the browser is closed and starts it again.
const { app, session } = require('electron');
const fetchWeb = (url) => session.fromPartition('persist:limbus').fetch(url);
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const WORK = path.join(os.tmpdir(), 'limbus-update');

function newer(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}
async function getText(url) {
  const r = await fetchWeb(url);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
  return r.text();
}
async function check() {
  const cur = process.versions.electron, major = cur.split('.')[0];
  const tags = JSON.parse(await getText('https://registry.npmjs.org/-/package/electron/dist-tags'));
  const patch = tags[major + '-x-y'];
  const latest = tags.latest;
  return {
    current: cur,
    patch: patch && newer(patch, cur) ? patch : null,
    nextMajor: latest && Number(String(latest).split('.')[0]) > Number(major) ? latest : null
  };
}
function expectedHash(sums, name) {
  const line = String(sums).split(/\r?\n/).map((l) => l.trim().split(/\s+\*?/)).filter((p) => p[1] === name)[0];
  return line && /^[0-9a-f]{64}$/i.test(line[0]) ? line[0].toLowerCase() : null;
}
async function hashFile(file) {
  const h = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(file), h);
  return h.digest('hex');
}
async function downloadVerified(version, platformArch) {
  fs.mkdirSync(WORK, { recursive: true });
  const base = 'https://github.com/electron/electron/releases/download/v' + version + '/';
  const name = 'electron-v' + version + '-' + platformArch + '.zip';
  const want = expectedHash(await getText(base + 'SHASUMS256.txt'), name);
  if (!want) throw new Error('No checksum published for ' + name);
  const dest = path.join(WORK, name);
  const res = await fetchWeb(base + name);
  if (!res.ok || !res.body) throw new Error('Download failed (HTTP ' + res.status + ')');
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest));
  if ((await hashFile(dest)) !== want) { fs.rmSync(dest, { force: true }); throw new Error('Checksum mismatch, update discarded'); }
  return dest;
}
const PS = [
  'param([string]$Zip,[string]$Dest,[int]$ProcId)',
  '$ErrorActionPreference = "Continue"',
  '$log = Join-Path $env:TEMP "limbus-update.log"',
  'try {',
  '  try { Wait-Process -Id $ProcId -Timeout 40 -ErrorAction SilentlyContinue } catch {}',
  '  Start-Sleep -Seconds 2',
  '  $ProgressPreference = "SilentlyContinue"',
  '  $tmp = Join-Path $env:TEMP "limbus-update\\x"',
  '  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }',
  '  Expand-Archive -LiteralPath $Zip -DestinationPath $tmp -Force',
  '  Get-ChildItem $tmp -Force | ForEach-Object {',
  '    if ($_.Name -eq "resources") {',
  '      Get-ChildItem $_.FullName -Force | Where-Object { $_.Name -ne "app" } | ForEach-Object { Copy-Item $_.FullName (Join-Path $Dest "resources") -Recurse -Force }',
  '    } elseif ($_.Name -eq "electron.exe") {',
  '      Copy-Item $_.FullName (Join-Path $Dest "LimbusBrowser.exe") -Force',
  '    } else {',
  '      Copy-Item $_.FullName $Dest -Recurse -Force',
  '    }',
  '  }',
  '  Remove-Item $tmp -Recurse -Force',
  '  "updated ok " + (Get-Date) | Out-File $log -Append',
  '} catch {',
  '  ("update failed: " + $_) | Out-File $log -Append',
  '} finally {',
  '  Start-Process (Join-Path $Dest "LimbusBrowser.exe")',
  '}'
].join('\r\n');

function installDir() {
  if (process.platform !== 'win32') return null;
  if (path.basename(process.execPath).toLowerCase() !== 'limbusbrowser.exe') return null;
  return path.dirname(process.execPath);
}
async function apply(version) {
  const dir = installDir();
  if (!dir) throw new Error('Updates apply only to the installed Windows copy.');
  const zip = await downloadVerified(version, 'win32-x64');
  const ps1 = path.join(WORK, 'apply-update.ps1');
  fs.writeFileSync(ps1, PS, 'utf8');
  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ps1, '-Zip', zip, '-Dest', dir, '-ProcId', String(process.pid)], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  setTimeout(() => app.quit(), 300);
  return true;
}
module.exports = { check, apply, downloadVerified, newer, installDir, expectedHash, hashFile };
