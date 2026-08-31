import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, diffTokens, type DiffEntry } from '../src/index.ts';

function joinSide(entries: DiffEntry[], skip: 'insert' | 'delete'): string {
  let s = '';
  for (const e of entries) if (e.operation !== skip) s += e.text;
  return s;
}

test('ignoreCase: case-only differences become equal, text taken from b', () => {
  assert.deepEqual(diff('The QUICK Fox', 'the quick fox', { ignoreCase: true }), [
    { operation: 'equal', text: 'the quick fox' },
  ]);
  assert.deepEqual(diff('Foo bar', 'foo BAZ', { ignoreCase: true }), [
    { operation: 'equal', text: 'foo ' },
    { operation: 'delete', text: 'bar' },
    { operation: 'insert', text: 'BAZ' },
  ]);
});

test('ignoreCase: works in char mode', () => {
  assert.deepEqual(diff('AbC', 'abc', { mode: 'char', ignoreCase: true }), [
    { operation: 'equal', text: 'abc' },
  ]);
});

test('ignoreWhitespace: whitespace runs compare equal, but presence still matters', () => {
  assert.deepEqual(diff('a  b', 'a b', { ignoreWhitespace: true }), [
    { operation: 'equal', text: 'a b' },
  ]);
  assert.deepEqual(diff('a\t\nb', 'a b', { ignoreWhitespace: true }), [
    { operation: 'equal', text: 'a b' },
  ]);
  // A whitespace token with no counterpart is still an insertion.
  assert.deepEqual(diff('x', 'x ', { ignoreWhitespace: true }), [
    { operation: 'equal', text: 'x' },
    { operation: 'insert', text: ' ' },
  ]);
});

test('ignoreWhitespace: line mode compares trimmed lines', () => {
  assert.deepEqual(diff('  hello  \nworld', 'hello\nworld', { mode: 'line', ignoreWhitespace: true }), [
    { operation: 'equal', text: 'hello\nworld' },
  ]);
});

test('ignoreCase + ignoreWhitespace combine', () => {
  assert.deepEqual(diff('Hello   World', 'hello world', { ignoreCase: true, ignoreWhitespace: true }), [
    { operation: 'equal', text: 'hello world' },
  ]);
});

test('diffTokens: accepts ignore options for custom tokens', () => {
  assert.deepEqual(diffTokens(['A'], ['a'], { ignoreCase: true }), [{ operation: 'equal', text: 'a' }]);
  assert.deepEqual(diffTokens(['\t'], [' '], { ignoreWhitespace: true }), [{ operation: 'equal', text: ' ' }]);
});

test('ignore options: b-side reconstruction always holds', () => {
  let state = 20270202 >>> 0;
  const rng = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const pieces = ['a', 'A', 'Bb', 'bB', ' ', '  ', '\t', '가', '\n', '.'];
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
      for (const opts of [{ ignoreCase: true }, { ignoreWhitespace: true }, { ignoreCase: true, ignoreWhitespace: true }]) {
        const entries = diff(a, b, { mode, ...opts });
        assert.equal(
          joinSide(entries, 'delete'), b,
          `b mismatch mode=${mode} opts=${JSON.stringify(opts)} a=${JSON.stringify(a)} b=${JSON.stringify(b)}`,
        );
      }
    }
  }
});

test('ignore options off: behavior is unchanged (both sides reconstruct)', () => {
  const entries = diff('The Fox', 'the fox');
  assert.equal(joinSide(entries, 'insert'), 'The Fox');
  assert.equal(joinSide(entries, 'delete'), 'the fox');
  assert.ok(entries.some(e => e.operation !== 'equal'));
});
