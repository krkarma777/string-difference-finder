import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenize.ts';

test('word mode: splits words, whitespace, punctuation', () => {
  assert.deepEqual(tokenize('hello world', 'word'), ['hello', ' ', 'world']);
  assert.deepEqual(tokenize('a, b', 'word'), ['a', ',', ' ', 'b']);
  assert.deepEqual(tokenize('abc123_x', 'word'), ['abc123_x']);
});

test('word mode: Unicode-aware (Korean words are separate tokens)', () => {
  assert.deepEqual(tokenize('안녕하세요 세계', 'word'), ['안녕하세요', ' ', '세계']);
  assert.deepEqual(tokenize('가나 abc!!', 'word'), ['가나', ' ', 'abc', '!!']);
});

test('char mode: code-point aware (no surrogate splitting)', () => {
  assert.deepEqual(tokenize('ab', 'char'), ['a', 'b']);
  assert.deepEqual(tokenize('a😀b', 'char'), ['a', '😀', 'b']);
});

test('line mode: keeps line terminators attached', () => {
  assert.deepEqual(tokenize('a\nb\nc', 'line'), ['a\n', 'b\n', 'c']);
  assert.deepEqual(tokenize('a\n', 'line'), ['a\n']);
  assert.deepEqual(tokenize('\n\n', 'line'), ['\n', '\n']);
  assert.deepEqual(tokenize('a\r\nb', 'line'), ['a\r\n', 'b']);
});

test('empty string yields no tokens in every mode', () => {
  assert.deepEqual(tokenize('', 'word'), []);
  assert.deepEqual(tokenize('', 'char'), []);
  assert.deepEqual(tokenize('', 'line'), []);
});
