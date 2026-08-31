import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, type DiffEntry } from '../src/index.ts';

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

function editCount(entries: DiffEntry[]): number {
  let count = 0;
  for (const e of entries) if (e.operation !== 'equal') count += e.text.length;
  return count;
}

const PIECES = ['a', 'b', 'cd', '가', '😀', ' ', '\n', '.'];

function randomString(rng: () => number, maxLen: number): string {
  const len = Math.floor(rng() * maxLen);
  let s = '';
  for (let i = 0; i < len; i++) s += PIECES[Math.floor(rng() * PIECES.length)];
  return s;
}

function mutate(rng: () => number, source: string, maxEdits: number): string {
  const chars = [...source];
  const edits = 1 + Math.floor(rng() * maxEdits);
  for (let e = 0; e < edits; e++) {
    const pos = Math.floor(rng() * (chars.length + 1));
    const op = rng();
    if (op < 0.34 && chars.length > 0) chars.splice(Math.min(pos, chars.length - 1), 1);
    else if (op < 0.67) chars.splice(pos, 0, PIECES[Math.floor(rng() * PIECES.length)]);
    else if (chars.length > 0) chars[Math.min(pos, chars.length - 1)] = PIECES[Math.floor(rng() * PIECES.length)];
  }
  return chars.join('');
}

test('heuristic: identical output to exact mode while D is under the cost cap', () => {
  const rng = makeRng(31337);
  for (let iter = 0; iter < 200; iter++) {
    const a = randomString(rng, 80);
    const b = mutate(rng, a, 8); // few edits => D far below the 64 cap
    for (const mode of ['word', 'char', 'line'] as const) {
      assert.deepEqual(
        diff(a, b, { mode, heuristic: true }),
        diff(a, b, { mode }),
        `mode=${mode} a=${JSON.stringify(a)} b=${JSON.stringify(b)}`,
      );
    }
  }
});

test('heuristic fuzz: round-trip invariant holds on wildly different inputs', () => {
  const rng = makeRng(55555);
  for (let iter = 0; iter < 150; iter++) {
    const a = randomString(rng, 300);
    const b = randomString(rng, 300);
    for (const mode of ['word', 'char', 'line'] as const) {
      const entries = diff(a, b, { mode, heuristic: true });
      assert.equal(joinSide(entries, 'insert'), a, `a mismatch mode=${mode}`);
      assert.equal(joinSide(entries, 'delete'), b, `b mismatch mode=${mode}`);
    }
  }
});

test('heuristic: edit script is valid but may be larger than minimal', () => {
  const rng = makeRng(777777);
  let heuristicTotal = 0;
  let exactTotal = 0;
  for (let iter = 0; iter < 30; iter++) {
    const a = randomString(rng, 600);
    const b = randomString(rng, 600);
    const h = diff(a, b, { mode: 'char', heuristic: true });
    const x = diff(a, b, { mode: 'char' });
    assert.equal(joinSide(h, 'insert'), a);
    assert.equal(joinSide(h, 'delete'), b);
    heuristicTotal += editCount(h);
    exactTotal += editCount(x);
    assert.ok(editCount(h) >= editCount(x), 'heuristic cannot beat the minimum');
  }
  // Sanity: the heuristic should stay in the same ballpark, not degenerate
  // to delete-everything/insert-everything on every input.
  assert.ok(heuristicTotal <= exactTotal * 2, `${heuristicTotal} vs exact ${exactTotal}`);
});

test('heuristic: refine sub-diffs inherit the flag without breaking round-trips', () => {
  const rng = makeRng(9999);
  for (let iter = 0; iter < 50; iter++) {
    const a = randomString(rng, 200);
    const b = randomString(rng, 200);
    const entries = diff(a, b, { refine: true, heuristic: true });
    assert.equal(joinSide(entries, 'insert'), a);
    assert.equal(joinSide(entries, 'delete'), b);
  }
});

test('heuristic: trivial cases are unaffected', () => {
  assert.deepEqual(diff('same', 'same', { heuristic: true }), [{ operation: 'equal', text: 'same' }]);
  assert.deepEqual(diff('', '', { heuristic: true }), []);
  assert.deepEqual(diff('', 'x', { heuristic: true }), [{ operation: 'insert', text: 'x' }]);
});
