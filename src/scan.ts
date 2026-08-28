import { myersDiff } from './myers.ts';
import type { DiffEntry, DiffOperation } from './index.ts';

/**
 * Fused scan pipeline for word/line modes: instead of materializing token
 * substrings and interning them through a string-keyed Map, it records
 * token boundary offsets, interns tokens with an open-addressed hash table
 * that reads characters straight out of the original strings (FNV-1a over
 * code units, collisions verified by range comparison), and assembles every
 * output text as a single slice of the input. Token boundaries and id
 * equivalence classes are exactly those of tokenize()+diffTokens(), so the
 * result is identical — this only removes allocation and hashing overhead.
 */
export function diffScanned(a: string, b: string, mode: 'word' | 'line'): DiffEntry[] {
  const scanA = mode === 'word' ? scanWordTokens(a) : scanLineTokens(a);
  const scanB = mode === 'word' ? scanWordTokens(b) : scanLineTokens(b);
  const offA = scanA.offsets;
  const offB = scanB.offsets;
  const hashA = scanA.hashes;
  const hashB = scanB.hashes;
  const countA = offA.length - 1;
  const countB = offB.length - 1;

  // Token-level common affix strip. Hash inequality proves token inequality,
  // so the integer check filters before the character comparison.
  const minCount = countA < countB ? countA : countB;
  let prefix = 0;
  while (
    prefix < minCount &&
    hashA[prefix] === hashB[prefix] &&
    rangesEqual(a, offA[prefix], offA[prefix + 1], b, offB[prefix], offB[prefix + 1])
  ) prefix++;
  let suffix = 0;
  const maxSuffix = minCount - prefix;
  while (
    suffix < maxSuffix &&
    hashA[countA - 1 - suffix] === hashB[countB - 1 - suffix] &&
    rangesEqual(
      a, offA[countA - 1 - suffix], offA[countA - suffix],
      b, offB[countB - 1 - suffix], offB[countB - suffix],
    )
  ) suffix++;

  const { ia, ib } = internRanges(
    a, offA, hashA, prefix, countA - suffix,
    b, offB, hashB, prefix, countB - suffix,
  );
  const { changedA, changedB } = myersDiff(ia, ib);

  const entries: DiffEntry[] = [];
  if (prefix > 0) entries.push({ operation: 'equal', text: a.slice(0, offA[prefix]) });

  const n = ia.length;
  const m = ib.length;
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    const eqStart = i;
    while (i < n && j < m && changedA[i] === 0 && changedB[j] === 0) { i++; j++; }
    if (i > eqStart) {
      pushEntry(entries, 'equal', a.slice(offA[prefix + eqStart], offA[prefix + i]));
    }
    const delStart = i;
    while (i < n && changedA[i] === 1) i++;
    if (i > delStart) {
      pushEntry(entries, 'delete', a.slice(offA[prefix + delStart], offA[prefix + i]));
    }
    const insStart = j;
    while (j < m && changedB[j] === 1) j++;
    if (j > insStart) {
      pushEntry(entries, 'insert', b.slice(offB[prefix + insStart], offB[prefix + j]));
    }
  }

  if (suffix > 0) pushEntry(entries, 'equal', a.slice(offA[countA - suffix]));
  return entries;
}

/** Appends an entry, merging with the previous one when the operation matches. */
function pushEntry(entries: DiffEntry[], operation: DiffOperation, text: string): void {
  const last = entries[entries.length - 1];
  if (last !== undefined && last.operation === operation) last.text += text;
  else entries.push({ operation, text });
}

function rangesEqual(a: string, as: number, ae: number, b: string, bs: number, be: number): boolean {
  if (ae - as !== be - bs) return false;
  for (let i = as, j = bs; i < ae; i++, j++) {
    if (a.charCodeAt(i) !== b.charCodeAt(j)) return false;
  }
  return true;
}

const CLS_WORD = 0;
const CLS_SPACE = 1;
const CLS_OTHER = 2;

// ASCII classification table mirroring the tokenize() regex classes:
// word = [A-Za-z0-9_], space = [\t\n\v\f\r ], other = the rest.
const ASCII_CLASS = new Uint8Array(128).fill(CLS_OTHER);
for (let c = 48; c <= 57; c++) ASCII_CLASS[c] = CLS_WORD;
for (let c = 65; c <= 90; c++) ASCII_CLASS[c] = CLS_WORD;
for (let c = 97; c <= 122; c++) ASCII_CLASS[c] = CLS_WORD;
ASCII_CLASS[95] = CLS_WORD;
for (const c of [9, 10, 11, 12, 13, 32]) ASCII_CLASS[c] = CLS_SPACE;

// Non-ASCII code points are classified by the same predicates the tokenize()
// regex uses, memoized per code point.
const WORD_RE = /[\p{L}\p{M}\p{N}_]/u;
const SPACE_RE = /\s/u;
const classCache = new Map<number, number>();

function classOf(cp: number): number {
  if (cp < 128) return ASCII_CLASS[cp];
  let cls = classCache.get(cp);
  if (cls === undefined) {
    const s = String.fromCodePoint(cp);
    cls = WORD_RE.test(s) ? CLS_WORD : SPACE_RE.test(s) ? CLS_SPACE : CLS_OTHER;
    classCache.set(cp, cls);
  }
  return cls;
}

interface TokenScan {
  /** Token start offsets plus a final end-of-string offset. */
  offsets: number[];
  /** FNV-1a hash (as signed int32, matching internRanges) per token. */
  hashes: number[];
}

const FNV_INIT = 0x811c9dc5 | 0;
const FNV_PRIME = 0x01000193;

/** Maximal class runs, hashed in the same pass that finds the boundaries. */
function scanWordTokens(str: string): TokenScan {
  const n = str.length;
  const offsets: number[] = [];
  const hashes: number[] = [];
  let prevClass = -1;
  let h = FNV_INIT;
  let i = 0;
  while (i < n) {
    const unit = str.charCodeAt(i);
    let cp = unit;
    let size = 1;
    if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < n) {
      const low = str.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        cp = (unit - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
        size = 2;
      }
    }
    const cls = cp < 128 ? ASCII_CLASS[cp] : classOf(cp);
    if (cls !== prevClass) {
      if (prevClass !== -1) hashes.push(h);
      offsets.push(i);
      prevClass = cls;
      h = FNV_INIT;
    }
    h = Math.imul(h ^ unit, FNV_PRIME);
    if (size === 2) h = Math.imul(h ^ str.charCodeAt(i + 1), FNV_PRIME);
    i += size;
  }
  if (prevClass !== -1) hashes.push(h);
  offsets.push(n);
  return { offsets, hashes };
}

/** Lines with terminators attached, hashed in the same boundary pass. */
function scanLineTokens(str: string): TokenScan {
  const n = str.length;
  const offsets: number[] = [];
  const hashes: number[] = [];
  let h = FNV_INIT;
  let open = false;
  for (let i = 0; i < n; i++) {
    const unit = str.charCodeAt(i);
    if (!open) {
      offsets.push(i);
      h = FNV_INIT;
      open = true;
    }
    h = Math.imul(h ^ unit, FNV_PRIME);
    if (unit === 10) {
      hashes.push(h);
      open = false;
    }
  }
  if (open) hashes.push(h);
  offsets.push(n);
  return { offsets, hashes };
}

/**
 * Interns token ranges [aFrom, aTo) of a and [bFrom, bTo) of b into dense
 * integer ids using an open-addressed table (load factor <= 0.5) keyed by
 * the hashes precomputed during scanning; hash collisions fall back to a
 * character-by-character comparison against the canonical occurrence.
 */
function internRanges(
  a: string, offA: number[], hashA: number[], aFrom: number, aTo: number,
  b: string, offB: number[], hashB: number[], bFrom: number, bTo: number,
): { ia: Int32Array; ib: Int32Array } {
  const total = (aTo - aFrom) + (bTo - bFrom);
  let tableSize = 4;
  while (tableSize < total * 2) tableSize <<= 1;
  const table = new Int32Array(tableSize); // 0 = empty, else token id + 1
  const mask = tableSize - 1;
  const canonSrcB = new Uint8Array(total);
  const canonStart = new Int32Array(total);
  const canonEnd = new Int32Array(total);
  let nextId = 0;

  const internOne = (src: string, isB: number, start: number, end: number, hash: number): number => {
    let idx = (hash >>> 0) & mask;
    for (;;) {
      const slot = table[idx];
      if (slot === 0) {
        table[idx] = nextId + 1;
        canonSrcB[nextId] = isB;
        canonStart[nextId] = start;
        canonEnd[nextId] = end;
        return nextId++;
      }
      const cand = slot - 1;
      const cs = canonStart[cand];
      const ce = canonEnd[cand];
      if (ce - cs === end - start) {
        const cstr = canonSrcB[cand] === 1 ? b : a;
        let equal = true;
        for (let i = cs, j = start; i < ce; i++, j++) {
          if (cstr.charCodeAt(i) !== src.charCodeAt(j)) { equal = false; break; }
        }
        if (equal) return cand;
      }
      idx = (idx + 1) & mask;
    }
  };

  const ia = new Int32Array(aTo - aFrom);
  for (let t = aFrom; t < aTo; t++) ia[t - aFrom] = internOne(a, 0, offA[t], offA[t + 1], hashA[t]);
  const ib = new Int32Array(bTo - bFrom);
  for (let t = bFrom; t < bTo; t++) ib[t - bFrom] = internOne(b, 1, offB[t], offB[t + 1], hashB[t]);
  return { ia, ib };
}
