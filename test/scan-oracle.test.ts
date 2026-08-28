import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, diffTokens, tokenize } from '../src/index.ts';

/**
 * Oracle: whatever pipeline diff() uses internally for word/line modes, its
 * output must be byte-for-byte identical to the reference pipeline built
 * from the public primitives (tokenize + diffTokens), because both must
 * produce the same token boundaries, the same id equivalence classes, and
 * therefore the same Myers flags and the same assembled entries.
 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const ALPHABET = [
  'a', 'b', 'cd', 'word', '가', '나라', '😀', '𝔘', ' ', '  ', '\t', '\n', '\r\n',
  '.', ',,', '?!', '_x1', ' ', '　', '\ud83d', // includes NBSP, ideographic space, lone surrogate
];

function randomString(rng: () => number, maxPieces: number): string {
  const len = Math.floor(rng() * maxPieces);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return s;
}

function mutate(rng: () => number, source: string): string {
  const chars = [...source];
  const edits = 1 + Math.floor(rng() * 6);
  for (let e = 0; e < edits; e++) {
    const pos = Math.floor(rng() * (chars.length + 1));
    const op = rng();
    if (op < 0.34 && chars.length > 0) chars.splice(Math.min(pos, chars.length - 1), 1);
    else if (op < 0.67) chars.splice(pos, 0, ALPHABET[Math.floor(rng() * ALPHABET.length)]);
    else if (chars.length > 0) chars[Math.min(pos, chars.length - 1)] = ALPHABET[Math.floor(rng() * ALPHABET.length)];
  }
  return chars.join('');
}

test('oracle: diff() word/line output is identical to tokenize+diffTokens', () => {
  const rng = makeRng(987654321);
  const modes = ['word', 'line'] as const;
  for (let iter = 0; iter < 400; iter++) {
    const a = randomString(rng, 40);
    const b = iter % 2 === 0 ? mutate(rng, a) : randomString(rng, 40);
    for (const mode of modes) {
      const actual = diff(a, b, { mode });
      const expected = a === b
        ? (a.length === 0 ? [] : [{ operation: 'equal', text: a }])
        : diffTokens(tokenize(a, mode), tokenize(b, mode));
      assert.deepEqual(
        actual, expected,
        `mode=${mode} a=${JSON.stringify(a)} b=${JSON.stringify(b)}`,
      );
    }
  }
});
