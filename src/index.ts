import { tokenize, type DiffMode } from './tokenize.ts';
import { myersDiff } from './myers.ts';
import { diffChars } from './chars.ts';
import { diffScanned } from './scan.ts';
import { pushEntry, type DiffEntry, type DiffOperation } from './entries.ts';

export { tokenize, type DiffMode, type DiffEntry, type DiffOperation };

export interface DiffOptions {
  /**
   * Tokenization granularity. Defaults to 'word'. The scanner modes
   * ('word' | 'char' | 'line') are the fastest; 'intl-word' and 'grapheme'
   * use Intl.Segmenter for locale-aware word boundaries (unspaced scripts
   * like Japanese/Chinese/Thai) and cluster-safe characters (ZWJ emoji,
   * combining sequences).
   */
  mode?: DiffMode;
  /** BCP 47 locale(s) for the Intl.Segmenter modes. Defaults to the runtime locale. */
  locale?: string | string[];
  /**
   * Re-diffs each delete/insert pair one granularity finer ('line' pairs by
   * word, 'word' pairs by char), so replacing "quick" with "quicker" reports
   * the shared "quick" as equal instead of replacing the whole word. No
   * effect in 'char' mode. Defaults to false.
   */
  refine?: boolean;
  /**
   * Caps the search cost per subproblem (the git xdiff strategy) so that
   * pathological inputs — two large, almost entirely different strings —
   * stay fast instead of costing O((N+M)·D). The result is always a valid
   * diff but is no longer guaranteed minimal; while the edit distance is
   * under the cap (64+), output is identical to exact mode. Defaults to
   * false (exact, provably minimal).
   */
  heuristic?: boolean;
  /**
   * Compares tokens case-insensitively. When tokens differ only in ways an
   * ignore option masks, the equal entry's text is taken from `b`, so
   * concatenating non-delete texts always reproduces `b` (but not
   * necessarily `a`). Defaults to false.
   */
  ignoreCase?: boolean;
  /**
   * Treats whitespace differences as equal: in 'line' mode lines are
   * compared with leading/trailing whitespace trimmed; in other modes any
   * whitespace-only token matches any other. Presence still matters — a
   * whitespace token with no counterpart remains an insert/delete. Same
   * `b`-side text rule as ignoreCase. Defaults to false.
   */
  ignoreWhitespace?: boolean;
}

export interface DiffTokensOptions {
  /** See {@link DiffOptions.heuristic}. */
  heuristic?: boolean;
  /** See {@link DiffOptions.ignoreCase}. */
  ignoreCase?: boolean;
  /** Whitespace-only tokens compare equal. See {@link DiffOptions.ignoreWhitespace}. */
  ignoreWhitespace?: boolean;
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
  const heuristic = options.heuristic === true;
  const normalize = buildNormalizer(mode, options.ignoreCase === true, options.ignoreWhitespace === true);
  let entries: DiffEntry[];
  if (normalize !== null || mode === 'intl-word' || mode === 'grapheme') {
    // Generic token pipeline: needed for Segmenter tokens and whenever
    // token comparison is normalized.
    entries = diffTokensCore(
      tokenize(a, mode, options.locale), tokenize(b, mode, options.locale), heuristic, normalize,
    );
  } else if (mode === 'char') {
    entries = diffChars(a, b, heuristic);
  } else {
    entries = diffScanned(a, b, mode, heuristic);
  }
  const finer = REFINE_TARGET[mode];
  if (options.refine === true && finer !== undefined) {
    return refineEntries(entries, finer, options);
  }
  return entries;
}

/** Which granularity a refine pass drops to; char/grapheme are already finest. */
const REFINE_TARGET: Partial<Record<DiffMode, DiffMode>> = {
  line: 'word',
  word: 'char',
  'intl-word': 'grapheme',
};

/**
 * A changed region as code-unit offsets into the inputs:
 * a[aStart, aEnd) was replaced by b[bStart, bEnd). Either side (but never
 * both) may be empty, representing a pure insertion or deletion.
 */
export type DiffRange = [aStart: number, aEnd: number, bStart: number, bEnd: number];

/**
 * Computes the changed regions between two strings as offset ranges instead
 * of text entries — convenient for editors, highlighters, and any consumer
 * that wants to slice the originals itself. Equivalent to projecting the
 * entries of diff(a, b, options) onto string offsets.
 */
export function diffRanges(a: string, b: string, options: DiffOptions = {}): DiffRange[] {
  const entries = diff(a, b, options);
  const ranges: DiffRange[] = [];
  let aPos = 0;
  let bPos = 0;
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];
    if (entry.operation === 'equal') {
      aPos += entry.text.length;
      bPos += entry.text.length;
      i++;
      continue;
    }
    const aStart = aPos;
    const bStart = bPos;
    if (entries[i] !== undefined && entries[i].operation === 'delete') {
      aPos += entries[i].text.length;
      i++;
    }
    if (entries[i] !== undefined && entries[i].operation === 'insert') {
      bPos += entries[i].text.length;
      i++;
    }
    ranges.push([aStart, aPos, bStart, bPos]);
  }
  return ranges;
}

/** Re-diffs adjacent delete/insert pairs at a finer granularity. */
function refineEntries(entries: DiffEntry[], finerMode: DiffMode, options: DiffOptions): DiffEntry[] {
  const subOptions: DiffOptions = {
    mode: finerMode,
    heuristic: options.heuristic,
    locale: options.locale,
    ignoreCase: options.ignoreCase,
    ignoreWhitespace: options.ignoreWhitespace,
  };
  const out: DiffEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const next = entries[i + 1];
    if (entry.operation === 'delete' && next !== undefined && next.operation === 'insert') {
      for (const sub of diff(entry.text, next.text, subOptions)) {
        pushEntry(out, sub.operation, sub.text);
      }
      i++;
    } else {
      pushEntry(out, entry.operation, entry.text);
    }
  }
  return out;
}

/** Diffs two pre-tokenized sequences. Tokens are compared by exact string equality. */
export function diffTokens(
  aTokens: readonly string[], bTokens: readonly string[], options: DiffTokensOptions = {},
): DiffEntry[] {
  const normalize = buildNormalizer(null, options.ignoreCase === true, options.ignoreWhitespace === true);
  return diffTokensCore(aTokens, bTokens, options.heuristic === true, normalize);
}

type Normalizer = (token: string) => string;

const WS_ONLY = /^\s+$/;

/**
 * Builds the token normalizer for the ignore options, or null when tokens
 * compare verbatim. 'line' mode compares trimmed lines; other modes (and
 * caller-supplied tokens, mode = null) equate whitespace-only tokens.
 */
function buildNormalizer(mode: DiffMode | null, ignoreCase: boolean, ignoreWhitespace: boolean): Normalizer | null {
  if (!ignoreCase && !ignoreWhitespace) return null;
  return token => {
    let t = token;
    if (ignoreWhitespace) {
      if (mode === 'line') t = t.trim();
      else if (WS_ONLY.test(t)) t = ' ';
    }
    if (ignoreCase) t = t.toLowerCase();
    return t;
  };
}

function diffTokensCore(
  aTokens: readonly string[], bTokens: readonly string[],
  heuristic: boolean, normalize: Normalizer | null,
): DiffEntry[] {
  const n = aTokens.length;
  const m = bTokens.length;
  const minLen = n < m ? n : m;

  // Strip common affixes before interning so the Map only ever sees the
  // changed region — for a localized edit this skips almost all hashing.
  // With a normalizer the ids already encode normalized equality, so the
  // Myers walk handles affixes and the verbatim pre-strip is skipped.
  let prefix = 0;
  let suffix = 0;
  if (normalize === null) {
    while (prefix < minLen && aTokens[prefix] === bTokens[prefix]) prefix++;
    const maxSuffix = minLen - prefix;
    while (suffix < maxSuffix && aTokens[n - 1 - suffix] === bTokens[m - 1 - suffix]) suffix++;
  }

  const ids = new Map<string, number>();
  const ia = internRange(aTokens, prefix, n - suffix, ids, normalize);
  const ib = internRange(bTokens, prefix, m - suffix, ids, normalize);
  const mid = myersDiff(ia, ib, heuristic);

  const changedA = new Uint8Array(n);
  const changedB = new Uint8Array(m);
  changedA.set(mid.changedA, prefix);
  changedB.set(mid.changedB, prefix);
  return buildEntries(aTokens, bTokens, changedA, changedB, normalize !== null);
}

/**
 * Maps tokens[start..end) to dense integer ids so the hot loops compare
 * Int32Array elements instead of hashing/comparing strings.
 */
function internRange(
  tokens: readonly string[], start: number, end: number,
  ids: Map<string, number>, normalize: Normalizer | null,
): Int32Array {
  const out = new Int32Array(end - start);
  for (let i = start; i < end; i++) {
    const token = normalize === null ? tokens[i] : normalize(tokens[i]);
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
  equalFromB: boolean,
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const n = aTokens.length;
  const m = bTokens.length;
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    const eqStartA = i;
    const eqStartB = j;
    while (i < n && j < m && changedA[i] === 0 && changedB[j] === 0) { i++; j++; }
    if (i > eqStartA) {
      // Under an ignore option the paired tokens may differ in masked ways;
      // taking b's text guarantees non-delete concatenation reproduces b.
      const text = equalFromB ? joinRange(bTokens, eqStartB, j) : joinRange(aTokens, eqStartA, i);
      entries.push({ operation: 'equal', text });
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
