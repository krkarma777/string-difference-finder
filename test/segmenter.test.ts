import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, tokenize, type DiffEntry } from '../src/index.ts';

function joinSide(entries: DiffEntry[], skip: 'insert' | 'delete'): string {
  let s = '';
  for (const e of entries) if (e.operation !== skip) s += e.text;
  return s;
}

test('tokenize: intl-word segments unspaced Japanese into words', () => {
  assert.deepEqual(
    tokenize('私は猫が好きです', 'intl-word', 'ja'),
    ['私', 'は', '猫', 'が', '好き', 'です'],
  );
});

test('tokenize: grapheme keeps ZWJ emoji and combining sequences whole', () => {
  assert.deepEqual(tokenize('a👨‍👩‍👧b', 'grapheme'), ['a', '👨‍👩‍👧', 'b']);
  assert.deepEqual(tokenize('', 'grapheme'), []);
  assert.deepEqual(tokenize('', 'intl-word'), []);
});

test('intl-word: Japanese diff isolates the changed word (regular word mode cannot)', () => {
  // Regular word mode sees one opaque letter-run, so everything changes.
  const coarse = diff('私は猫が好きです', '私は犬が好きです');
  assert.deepEqual(coarse, [
    { operation: 'delete', text: '私は猫が好きです' },
    { operation: 'insert', text: '私は犬が好きです' },
  ]);
  // intl-word isolates 猫 -> 犬.
  assert.deepEqual(diff('私は猫が好きです', '私は犬が好きです', { mode: 'intl-word', locale: 'ja' }), [
    { operation: 'equal', text: '私は' },
    { operation: 'delete', text: '猫' },
    { operation: 'insert', text: '犬' },
    { operation: 'equal', text: 'が好きです' },
  ]);
});

test('grapheme: ZWJ emoji replaced as one cluster (char mode splits code points)', () => {
  const a = 'x👨‍👩‍👧y';
  const b = 'x👨‍👩‍👦y';
  assert.deepEqual(diff(a, b, { mode: 'grapheme' }), [
    { operation: 'equal', text: 'x' },
    { operation: 'delete', text: '👨‍👩‍👧' },
    { operation: 'insert', text: '👨‍👩‍👦' },
    { operation: 'equal', text: 'y' },
  ]);
});

test('intl-word: refine drops to grapheme granularity', () => {
  const entries = diff('color', 'colour', { mode: 'intl-word', refine: true });
  assert.deepEqual(entries, [
    { operation: 'equal', text: 'colo' },
    { operation: 'insert', text: 'u' },
    { operation: 'equal', text: 'r' },
  ]);
});

test('segmenter modes: round-trip fuzz with mixed scripts', () => {
  let state = 20270101 >>> 0;
  const rng = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const pieces = ['猫', '好き', 'a', ' ', '👨‍👩‍👧', '한글', '\n', '.', 'देवनागरी'];
  const make = () => {
    const len = Math.floor(rng() * 25);
    let s = '';
    for (let i = 0; i < len; i++) s += pieces[Math.floor(rng() * pieces.length)];
    return s;
  };
  for (let iter = 0; iter < 100; iter++) {
    const a = make();
    const b = make();
    for (const mode of ['intl-word', 'grapheme'] as const) {
      const entries = diff(a, b, { mode });
      assert.equal(joinSide(entries, 'insert'), a, `a mismatch mode=${mode}`);
      assert.equal(joinSide(entries, 'delete'), b, `b mismatch mode=${mode}`);
    }
  }
});

test('segmenter modes: heuristic flag composes', () => {
  const a = '猫'.repeat(200) + '好き'.repeat(200);
  const b = '犬'.repeat(180) + '嫌い'.repeat(180);
  const entries = diff(a, b, { mode: 'grapheme', heuristic: true });
  assert.equal(joinSide(entries, 'insert'), a);
  assert.equal(joinSide(entries, 'delete'), b);
});
