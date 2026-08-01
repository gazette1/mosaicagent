/**
 * Legacy Word 97-2003 (.doc) Extractor
 *
 * Real deal rooms are full of these. On the Caven Point package the single
 * most authoritative document in the room, the executed Second Amendment that
 * cuts the seller mortgage from $60MM to $40MM and drops the seller to second
 * lien, arrived as a 2003-era binary .doc. Refusing to read it would have left
 * the pipeline reporting a superseded deal with total confidence.
 *
 * .doc is an OLE compound file, not a ZIP. The text lives in the WordDocument
 * stream but is NOT a contiguous byte range: modern Word writes a piece table
 * (CLX) into the table stream describing runs that may be CP1252-compressed or
 * UTF-16, in document order but scattered in the file. Reading fcMin..fcMac
 * naively returns deleted text, fragments, and revision debris.
 *
 * SheetJS bundles CFB for .xls support, so the OLE container costs no new
 * dependency. The piece-table walk below is implemented from [MS-DOC].
 */

import * as fs from 'fs';

/** FibRgFcLcb97 pair index of fcClx, per [MS-DOC] 2.5.5. */
const FC_CLX_PAIR_INDEX = 33;

interface Piece {
  offset: number;
  byteLength: number;
  compressed: boolean;
}

/** Walk the FIB variable-length prefix to reach the rgFcLcb array. */
function locateClx(wd: Buffer): { fc: number; lcb: number; useTable1: boolean } {
  if (wd.readUInt16LE(0) !== 0xa5ec) throw new Error('not a Word binary document (bad wIdent)');

  const flags = wd.readUInt16LE(10);
  const useTable1 = ((flags >> 9) & 1) === 1; // fWhichTblStm

  let p = 32;                       // end of FibBase
  const csw = wd.readUInt16LE(p);   p += 2 + csw * 2;   // rgW97
  const cslw = wd.readUInt16LE(p);  p += 2 + cslw * 4;  // rgLw97
  const cbRgFcLcb = wd.readUInt16LE(p); p += 2;         // rgFcLcb follows

  if (FC_CLX_PAIR_INDEX >= cbRgFcLcb) throw new Error('FIB too short to contain fcClx');
  const at = p + FC_CLX_PAIR_INDEX * 8;
  return { fc: wd.readUInt32LE(at), lcb: wd.readUInt32LE(at + 4), useTable1 };
}

/** Parse the CLX to a piece table. Prc entries precede the Pcdt and are skipped. */
function parsePieceTable(clx: Buffer): { cps: number[]; pieces: Piece[] } {
  let i = 0;
  while (i < clx.length) {
    const kind = clx[i];
    if (kind === 0x01) {                       // Prc: skip its grpprl
      const cb = clx.readInt16LE(i + 1);
      i += 3 + cb;
      continue;
    }
    if (kind === 0x02) {                       // Pcdt: the piece table
      const lcb = clx.readUInt32LE(i + 1);
      const plc = clx.subarray(i + 5, i + 5 + lcb);
      const n = (lcb - 4) / 12;                // 4*(n+1) CPs + 8*n PCDs
      if (!Number.isInteger(n) || n <= 0) throw new Error('malformed piece table');

      const cps: number[] = [];
      for (let k = 0; k <= n; k++) cps.push(plc.readUInt32LE(k * 4));

      const pieces: Piece[] = [];
      const pcdBase = 4 * (n + 1);
      for (let k = 0; k < n; k++) {
        const fc = plc.readUInt32LE(pcdBase + k * 8 + 2);
        const compressed = (fc & 0x40000000) !== 0;
        const chars = cps[k + 1] - cps[k];
        pieces.push({
          offset: compressed ? (fc & 0x3fffffff) >>> 1 : fc,
          byteLength: compressed ? chars : chars * 2,
          compressed,
        });
      }
      return { cps, pieces };
    }
    throw new Error(`unexpected CLX entry 0x${kind.toString(16)}`);
  }
  throw new Error('no Pcdt found in CLX');
}

/**
 * Word control characters. 0x07 ends a table cell and 0x0D ends a paragraph;
 * mapping cells to " | " keeps the amendment tables readable as rows, which is
 * how the term-sheet grids ("Loan Term | Five (5) years...") survive into the
 * claims extractor at all.
 */
function decodeRun(buf: Buffer, compressed: boolean): string {
  const raw = compressed ? buf.toString('latin1') : buf.toString('utf16le');
  let out = '';
  for (const ch of raw) {
    const c = ch.charCodeAt(0);
    if (c === 0x0d || c === 0x0b) out += '\n';
    else if (c === 0x07) out += ' | ';
    else if (c === 0x1e) out += '-';
    else if (c === 0x1f) out += '';
    else if (c === 0x13 || c === 0x14 || c === 0x15) out += '';  // field markers
    else if (c === 0x08 || c === 0x01) out += '';                // drawing anchors
    else if (c >= 0x20 || c === 0x09) out += ch;
  }
  return out;
}

export function extractDocText(filePath: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { CFB } = require('xlsx');
  const cfb = CFB.read(fs.readFileSync(filePath), { type: 'buffer' });

  const grab = (name: string): Buffer | null => {
    const entry = CFB.find(cfb, name);
    return entry && entry.content ? Buffer.from(entry.content) : null;
  };

  const wd = grab('WordDocument');
  if (!wd) throw new Error('WordDocument stream not found (not a .doc?)');

  const { fc, lcb, useTable1 } = locateClx(wd);
  const table = grab(useTable1 ? '1Table' : '0Table') ?? grab('1Table') ?? grab('0Table');
  if (!table) throw new Error('table stream not found');

  const { pieces } = parsePieceTable(table.subarray(fc, fc + lcb));

  let text = '';
  for (const pc of pieces) {
    text += decodeRun(wd.subarray(pc.offset, pc.offset + pc.byteLength), pc.compressed);
  }

  return text
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').replace(/\s*\|\s*$/, '').trim())
    .filter(Boolean)
    .join('\n');
}
