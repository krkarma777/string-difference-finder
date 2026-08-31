import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, type DiffEntry } from '../src/index.ts';

function joinSide(entries: DiffEntry[], skip: 'insert' | 'delete'): string {
  let s = '';
  for (const e of entries) if (e.operation !== skip) s += e.text;
  return s;
}

test('refine: word-mode pairs are re-diffed at char level', () => {
  assert.deepEqual(diff('the quick fox', 'the quicker fox', { refine: true }), [
    { operation: 'equal', text: 'the quick' },
    { operation: 'insert', text: 'er' },
    { operation: 'equal', text: ' fox' },
  ]);
});

test('refine: line-mode pairs are re-diffed at word level', () => {
  assert.deepEqual(diff('alpha beta\ngamma\n', 'alpha zeta\ngamma\n', { mode: 'line', refine: true }), [
    { operation: 'equal', text: 'alpha ' },
    { operation: 'delete', text: 'beta' },
    { operation: 'insert', text: 'zeta' },
    { operation: 'equal', text: '\ngamma\n' },
  ]);
});

test('refine: char mode is unaffected (already finest granularity)', () => {
  const a = 'kitten';
  const b = 'sitting';
  assert.deepEqual(diff(a, b, { mode: 'char', refine: true }), diff(a, b, { mode: 'char' }));
});

test('refine: solo deletes and inserts pass through unchanged', () => {
  assert.deepEqual(diff('keep removed keep', 'keep keep', { refine: true }), diff('keep removed keep', 'keep keep'));
  assert.deepEqual(diff('', 'abc', { refine: true }), [{ operation: 'insert', text: 'abc' }]);
});

test('refine: entries stay merged and ordered after splicing', () => {
  const entries = diff('aaa bbb ccc', 'aaa bXb ccc', { refine: true });
  // No two adjacent entries share an operation.
  for (let i = 1; i < entries.length; i++) {
    assert.notEqual(entries[i].operation, entries[i - 1].operation, JSON.stringify(entries));
  }
  // Within the changed region, delete still precedes insert.
  const delIdx = entries.findIndex(e => e.operation === 'delete');
  const insIdx = entries.findIndex(e => e.operation === 'insert');
  assert.ok(delIdx < insIdx);
});

test('refine fuzz: round-trip invariant holds in every mode', () => {
  let state = 20261101 >>> 0;
  const rng = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const pieces = ['a', 'bb', '가나', '😀', ' ', '\n', '.', 'word'];
  const make = () => {
    const len = Math.floor(rng() * 30);
    let s = '';
    for (let i = 0; i < len; i++) s += pieces[Math.floor(rng() * pieces.length)];
    return s;
  };
  for (let iter = 0; iter < 200; iter++) {
    const a = make();
    const b = make();
    for (const mode of ['word', 'char', 'line'] as const) {
      const entries = diff(a, b, { mode, refine: true });
      assert.equal(joinSide(entries, 'insert'), a, `a mismatch mode=${mode} a=${JSON.stringify(a)} b=${JSON.stringify(b)}`);
      assert.equal(joinSide(entries, 'delete'), b, `b mismatch mode=${mode} a=${JSON.stringify(a)} b=${JSON.stringify(b)}`);
    }
  }
});
