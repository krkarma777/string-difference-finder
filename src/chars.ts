import { myersDiff } from './myers.ts';
import { pushEntry, type DiffEntry } from './entries.ts';

/**
 * Char-mode diff that never materializes per-character token strings.
 *
 * The strings are scanned once into Int32Array code points (the code point
 * value doubles as the interned id) plus a code-unit offset table, so the
 * search runs on typed arrays and every output text is a single slice of
 * the original input. Common prefix/suffix are stripped at the code-unit
 * level first, so untouched regions skip the scan entirely.
 */
export function diffChars(a: string, b: string): DiffEntry[] {
  const aLen = a.length;
  const bLen = b.length;
  const minLen = aLen < bLen ? aLen : bLen;

  let prefix = 0;
  while (prefix < minLen && a.charCodeAt(prefix) === b.charCodeAt(prefix)) prefix++;
  // Never cut between a high surrogate and what follows it; backing off is
  // always safe because the search re-strips any complete common pair.
  if (prefix > 0 && isHighSurrogate(a.charCodeAt(prefix - 1))) prefix--;

  let suffix = 0;
  const maxSuffix = minLen - prefix;
  while (suffix < maxSuffix && a.charCodeAt(aLen - 1 - suffix) === b.charCodeAt(bLen - 1 - suffix)) suffix++;
  if (suffix > 0 && isLowSurrogate(a.charCodeAt(aLen - suffix))) suffix--;

  const aMid = scanCodePoints(a, prefix, aLen - suffix);
  const bMid = scanCodePoints(b, prefix, bLen - suffix);
  const { changedA, changedB } = myersDiff(aMid.points, bMid.points);

  const entries: DiffEntry[] = [];
  if (prefix > 0) entries.push({ operation: 'equal', text: a.slice(0, prefix) });

  const n = aMid.count;
  const m = bMid.count;
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    const eqStart = i;
    while (i < n && j < m && changedA[i] === 0 && changedB[j] === 0) { i++; j++; }
    if (i > eqStart) pushEntry(entries, 'equal', a.slice(aMid.offsets[eqStart], aMid.offsets[i]));
    const delStart = i;
    while (i < n && changedA[i] === 1) i++;
    if (i > delStart) pushEntry(entries, 'delete', a.slice(aMid.offsets[delStart], aMid.offsets[i]));
    const insStart = j;
    while (j < m && changedB[j] === 1) j++;
    if (j > insStart) pushEntry(entries, 'insert', b.slice(bMid.offsets[insStart], bMid.offsets[j]));
  }

  if (suffix > 0) pushEntry(entries, 'equal', a.slice(aLen - suffix));
  return entries;
}

interface CodePointScan {
  points: Int32Array;
  /** Code-unit start offset of each point; offsets[count] is the range end. */
  offsets: Int32Array;
  count: number;
}

function scanCodePoints(str: string, from: number, to: number): CodePointScan {
  const size = to - from;
  const points = new Int32Array(size);
  const offsets = new Int32Array(size + 1);
  let count = 0;
  let i = from;
  while (i < to) {
    const cp = str.codePointAt(i) as number;
    points[count] = cp;
    offsets[count] = i;
    count++;
    i += cp > 0xffff ? 2 : 1;
  }
  offsets[count] = to;
  return { points: count === size ? points : points.subarray(0, count), offsets, count };
}

function isHighSurrogate(unit: number): boolean {
  return unit >= 0xd800 && unit <= 0xdbff;
}

function isLowSurrogate(unit: number): boolean {
  return unit >= 0xdc00 && unit <= 0xdfff;
}
