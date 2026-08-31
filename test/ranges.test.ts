import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffRanges } from '../src/index.ts';

/** Rebuilds b from a by applying the changed ranges left to right. */
function applyRanges(a: string, b: string, ranges: Array<[number, number, number, number]>): string {
  let result = '';
  let cursor = 0;
  for (const [aStart, aEnd, bStart, bEnd] of ranges) {
    result += a.slice(cursor, aStart) + b.slice(bStart, bEnd);
    cursor = aEnd;
  }
  return result + a.slice(cursor);
}

test('diffRanges: known example in code-unit offsets', () => {
  assert.deepEqual(diffRanges('the quick fox', 'the slow fox'), [
    [4, 9, 4, 8], // "quick" -> "slow"
  ]);
});

test('diffRanges: identical and empty inputs produce no ranges', () => {
  assert.deepEqual(diffRanges('same', 'same'), []);
  assert.deepEqual(diffRanges('', ''), []);
});

test('diffRanges: pure insertion and pure deletion', () => {
  assert.deepEqual(diffRanges('', 'abc'), [[0, 0, 0, 3]]);
  assert.deepEqual(diffRanges('abc', ''), [[0, 3, 0, 0]]);
});

test('diffRanges: ranges are ascending, non-overlapping, and rebuild b', () => {
  let state = 20261201 >>> 0;
  const rng = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const pieces = ['a', 'bb', '가나', '😀', ' ', '\n', '.', 'word'];
  const make = () => {
    const len = Math.floor(rng() * 40);
    let s = '';
    for (let i = 0; i < len; i++) s += pieces[Math.floor(rng() * pieces.length)];
    return s;
  };
  for (let iter = 0; iter < 200; iter++) {
    const a = make();
    const b = make();
    for (const mode of ['word', 'char', 'line'] as const) {
      for (const refine of [false, true]) {
        const ranges = diffRanges(a, b, { mode, refine });
        let prevA = 0;
        let prevB = 0;
        for (const [aStart, aEnd, bStart, bEnd] of ranges) {
          assert.ok(aStart >= prevA && aEnd >= aStart, `a-range order: ${JSON.stringify(ranges)}`);
          assert.ok(bStart >= prevB && bEnd >= bStart, `b-range order: ${JSON.stringify(ranges)}`);
          assert.ok(aEnd > aStart || bEnd > bStart, 'no empty-empty ranges');
          prevA = aEnd;
          prevB = bEnd;
        }
        assert.equal(
          applyRanges(a, b, ranges), b,
          `rebuild failed mode=${mode} refine=${refine} a=${JSON.stringify(a)} b=${JSON.stringify(b)}`,
        );
      }
    }
  }
});
