import { tokenize, type DiffMode } from './tokenize.ts';
import { myersDiff } from './myers.ts';
import { diffChars } from './chars.ts';
import { diffScanned } from './scan.ts';

export { tokenize, type DiffMode };

export type DiffOperation = 'equal' | 'insert' | 'delete';

export interface DiffEntry {
  operation: DiffOperation;
  text: string;
}

export interface DiffOptions {
  /** Tokenization granularity. Defaults to 'word'. */
  mode?: DiffMode;
}

/**
 * Computes a shortest-edit-script diff between two strings.
 *
 * Within a changed region, the delete entry always precedes the insert
 * entry, and adjacent tokens with the same operation are merged into a
 * single entry.
 */
export function diff(a: string, b: string, options: DiffOptions = {}): DiffEntry[] {
  if (a === b) {
    return a.length === 0 ? [] : [{ operation: 'equal', text: a }];
  }
  const mode = options.mode ?? 'word';
  if (mode === 'char') return diffChars(a, b);
  return diffScanned(a, b, mode);
}

/** Diffs two pre-tokenized sequences. Tokens are compared by exact string equality. */
export function diffTokens(aTokens: readonly string[], bTokens: readonly string[]): DiffEntry[] {
  const n = aTokens.length;
  const m = bTokens.length;
  const minLen = n < m ? n : m;

  // Strip common affixes before interning so the Map only ever sees the
  // changed region — for a localized edit this skips almost all hashing.
  let prefix = 0;
  while (prefix < minLen && aTokens[prefix] === bTokens[prefix]) prefix++;
  let suffix = 0;
  const maxSuffix = minLen - prefix;
  while (suffix < maxSuffix && aTokens[n - 1 - suffix] === bTokens[m - 1 - suffix]) suffix++;

  const ids = new Map<string, number>();
  const ia = internRange(aTokens, prefix, n - suffix, ids);
  const ib = internRange(bTokens, prefix, m - suffix, ids);
  const mid = myersDiff(ia, ib);

  const changedA = new Uint8Array(n);
  const changedB = new Uint8Array(m);
  changedA.set(mid.changedA, prefix);
  changedB.set(mid.changedB, prefix);
  return buildEntries(aTokens, bTokens, changedA, changedB);
}

/**
 * Maps tokens[start..end) to dense integer ids so the hot loops compare
 * Int32Array elements instead of hashing/comparing strings.
 */
function internRange(
  tokens: readonly string[], start: number, end: number, ids: Map<string, number>,
): Int32Array {
  const out = new Int32Array(end - start);
  for (let i = start; i < end; i++) {
    const token = tokens[i];
    let id = ids.get(token);
    if (id === undefined) {
      id = ids.size;
      ids.set(token, id);
    }
    out[i - start] = id;
  }
  return out;
}

function buildEntries(
  aTokens: readonly string[], bTokens: readonly string[],
  changedA: Uint8Array, changedB: Uint8Array,
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const n = aTokens.length;
  const m = bTokens.length;
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    const eqStart = i;
    while (i < n && j < m && changedA[i] === 0 && changedB[j] === 0) { i++; j++; }
    if (i > eqStart) {
      entries.push({ operation: 'equal', text: joinRange(aTokens, eqStart, i) });
    }
    const delStart = i;
    while (i < n && changedA[i] === 1) i++;
    if (i > delStart) {
      entries.push({ operation: 'delete', text: joinRange(aTokens, delStart, i) });
    }
    const insStart = j;
    while (j < m && changedB[j] === 1) j++;
    if (j > insStart) {
      entries.push({ operation: 'insert', text: joinRange(bTokens, insStart, j) });
    }
  }
  return entries;
}

function joinRange(tokens: readonly string[], start: number, end: number): string {
  if (end - start === 1) return tokens[start];
  let s = '';
  for (let i = start; i < end; i++) s += tokens[i];
  return s;
}
