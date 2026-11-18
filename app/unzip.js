'use strict';
// Small zip reader (stored + deflate only, no zip64) so updates can be unpacked on any system without extra
// programs. It refuses anything that could write outside the target folder and caps sizes, because the
// archive comes from the network.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MAX_ENTRIES = 6000;
const MAX_TOTAL = 150 * 1024 * 1024;

function readEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOff = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOff === 0xffffffff) throw new Error('Zip64 archives are not supported');
  if (count > MAX_ENTRIES) throw new Error('Too many files in the update');
  if (cdOff + cdSize > buf.length) throw new Error('Damaged zip');
  const out = [];
  let p = cdOff;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Damaged zip');
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString((flags & 0x800) ? 'utf8' : 'latin1', p + 46, p + 46 + nlen);
    out.push({ name, method, crc, csize, usize, off, flags });
    p += 46 + nlen + elen + clen;
  }
  return out;
}

function safeRel(name) {
  const n = name.replace(/\\/g, '/');
  if (!n || n.startsWith('/') || /^[a-zA-Z]:/.test(n) || n.indexOf('\0') >= 0) throw new Error('Unsafe path in update: ' + name);
  const parts = n.split('/').filter((x) => x !== '' && x !== '.');
  if (parts.some((x) => x === '..')) throw new Error('Unsafe path in update: ' + name);
  return parts.join('/');
}

// Extracts zip file `zipPath` into the (new, empty) folder `dest`. Returns the list of files written.
function extract(zipPath, dest) {
  const buf = fs.readFileSync(zipPath);
  const entries = readEntries(buf);
  const root = path.resolve(dest);
  fs.mkdirSync(root, { recursive: true });
  let total = 0;
  const written = [];
  for (const e of entries) {
    if (e.flags & 1) throw new Error('Encrypted zip entries are not supported');
    const rel = safeRel(e.name);
    if (!rel) continue;
    const target = path.resolve(root, rel);
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error('Unsafe path in update: ' + e.name);
    if (e.name.endsWith('/')) { fs.mkdirSync(target, { recursive: true }); continue; }
    total += e.usize;
    if (total > MAX_TOTAL) throw new Error('The update is larger than allowed');
    if (buf.readUInt32LE(e.off) !== 0x04034b50) throw new Error('Damaged zip');
    const dataStart = e.off + 30 + buf.readUInt16LE(e.off + 26) + buf.readUInt16LE(e.off + 28);
    if (dataStart + e.csize > buf.length) throw new Error('Damaged zip');
    const raw = buf.subarray(dataStart, dataStart + e.csize);
    let data;
    if (e.method === 0) data = Buffer.from(raw);
    else if (e.method === 8) data = zlib.inflateRawSync(raw, { maxOutputLength: Math.max(e.usize, 1) });
    else throw new Error('Unsupported zip compression');
    if (data.length !== e.usize) throw new Error('Damaged zip entry: ' + e.name);
    if (typeof zlib.crc32 === 'function' && zlib.crc32(data) !== e.crc) throw new Error('Checksum error in ' + e.name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    written.push(rel);
  }
  return written;
}

module.exports = { extract, readEntries, safeRel };
