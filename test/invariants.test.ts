import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, diffTokens, type DiffEntry } from '../src/index.ts';

/** Deterministic LCG so failures are reproducible. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function joinSide(entries: DiffEntry[], skip: 'insert' | 'delete'): string {
  let s = '';
  for (const e of entries) if (e.operation !== skip) s += e.text;
  return s;
}

function assertRoundTrip(entries: DiffEntry[], a: string, b: string): void {
  assert.equal(joinSide(entries, 'insert'), a);
  assert.equal(joinSide(entries, 'delete'), b);
}

/** Reference O(N*M) LCS length for optimality checks on small inputs. */
function lcsLength(a: string[], b: string[]): number {
  const m = b.length;
  let prev = new Array<number>(m + 1).fill(0);
  let curr = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= m; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

const ALPHABET = ['a', 'b', 'c', 'd', '가', '나', '😀', ' ', '\n'];

function randomString(rng: () => number, maxLen: number): string {
  const len = Math.floor(rng() * maxLen);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return s;
}

function mutate(rng: () => number, source: string): string {
  const chars = [...source];
  const edits = 1 + Math.floor(rng() * 8);
  for (let e = 0; e < edits; e++) {
    const pos = Math.floor(rng() * (chars.length + 1));
    const op = rng();
    if (op < 0.34 && chars.length > 0) chars.splice(Math.min(pos, chars.length - 1), 1);
    else if (op < 0.67) chars.splice(pos, 0, ALPHABET[Math.floor(rng() * ALPHABET.length)]);
    else if (chars.length > 0) chars[Math.min(pos, chars.length - 1)] = ALPHABET[Math.floor(rng() * ALPHABET.length)];
  }
  return chars.join('');
}

test('fuzz: round-trip invariant holds for random pairs in all modes', () => {
  const rng = makeRng(20260828);
  const modes = ['word', 'char', 'line'] as const;
  for (let iter = 0; iter < 300; iter++) {
    const a = randomString(rng, 60);
    const b = iter % 2 === 0 ? mutate(rng, a) : randomString(rng, 60);
    for (const mode of modes) {
      const entries = diff(a, b, { mode });
      assertRoundTrip(entries, a, b);
    }
  }
});

test('fuzz: diffTokens round-trip with token arrays', () => {
  const rng = makeRng(777);
  for (let iter = 0; iter < 200; iter++) {
    const tokens = () => {
      const len = Math.floor(rng() * 30);
      return Array.from({ length: len }, () => ALPHABET[Math.floor(rng() * ALPHABET.length)]);
    };
    const a = tokens();
    const b = tokens();
    const entries = diffTokens(a, b);
    assertRoundTrip(entries, a.join(''), b.join(''));
  }
});

test('fuzz: edit script is optimal (matches reference DP LCS)', () => {
  const rng = makeRng(424242);
  const ascii = 'abcd';
  for (let iter = 0; iter < 300; iter++) {
    const len = () => Math.floor(rng() * 40);
    const make = (l: number) => Array.from({ length: l }, () => ascii[Math.floor(rng() * ascii.length)]).join('');
    const a = make(len());
    const b = make(len());
    const entries = diff(a, b, { mode: 'char' });
    assertRoundTrip(entries, a, b);
    const l = lcsLength([...a], [...b]);
    let deleted = 0;
    let inserted = 0;
    for (const e of entries) {
      if (e.operation === 'delete') deleted += [...e.text].length;
      if (e.operation === 'insert') inserted += [...e.text].length;
    }
    assert.equal(deleted, a.length - l, `deleted mismatch for a="${a}" b="${b}"`);
    assert.equal(inserted, b.length - l, `inserted mismatch for a="${a}" b="${b}"`);
  }
});
