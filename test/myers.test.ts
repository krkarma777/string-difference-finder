import { test } from 'node:test';
import assert from 'node:assert/strict';
import { myersDiff } from '../src/myers.ts';

function flags(arr: Uint8Array): number[] {
  return Array.from(arr);
}

test('identical arrays: nothing changed', () => {
  const { changedA, changedB } = myersDiff(Int32Array.from([1, 2, 3]), Int32Array.from([1, 2, 3]));
  assert.deepEqual(flags(changedA), [0, 0, 0]);
  assert.deepEqual(flags(changedB), [0, 0, 0]);
});

test('empty vs non-empty: everything inserted', () => {
  const { changedA, changedB } = myersDiff(new Int32Array(0), Int32Array.from([1, 2]));
  assert.deepEqual(flags(changedA), []);
  assert.deepEqual(flags(changedB), [1, 1]);
});

test('single replacement in middle', () => {
  const { changedA, changedB } = myersDiff(
    Int32Array.from([1, 2, 3]),
    Int32Array.from([1, 9, 3]),
  );
  assert.deepEqual(flags(changedA), [0, 1, 0]);
  assert.deepEqual(flags(changedB), [0, 1, 0]);
});

test('classic ABCABBA vs CBABAC produces a shortest script (D=5)', () => {
  // A=1 B=2 C=3
  const a = Int32Array.from([1, 2, 3, 1, 2, 2, 1]);
  const b = Int32Array.from([3, 2, 1, 2, 1, 3]);
  const { changedA, changedB } = myersDiff(a, b);
  const d = flags(changedA).reduce((s, v) => s + v, 0) + flags(changedB).reduce((s, v) => s + v, 0);
  assert.equal(d, 5);
});

test('completely different arrays', () => {
  const { changedA, changedB } = myersDiff(Int32Array.from([1, 2]), Int32Array.from([3, 4, 5]));
  assert.deepEqual(flags(changedA), [1, 1]);
  assert.deepEqual(flags(changedB), [1, 1, 1]);
});

test('pure insertion and pure deletion', () => {
  const ins = myersDiff(Int32Array.from([1, 4]), Int32Array.from([1, 2, 3, 4]));
  assert.deepEqual(flags(ins.changedA), [0, 0]);
  assert.deepEqual(flags(ins.changedB), [0, 1, 1, 0]);

  const del = myersDiff(Int32Array.from([1, 2, 3, 4]), Int32Array.from([1, 4]));
  assert.deepEqual(flags(del.changedA), [0, 1, 1, 0]);
  assert.deepEqual(flags(del.changedB), [0, 0]);
});
