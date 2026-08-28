import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, diffTokens } from '../src/index.ts';

test('identical strings: single equal entry', () => {
  assert.deepEqual(diff('same text', 'same text'), [{ operation: 'equal', text: 'same text' }]);
});

test('both empty: empty result', () => {
  assert.deepEqual(diff('', ''), []);
});

test('insert into empty / delete to empty', () => {
  assert.deepEqual(diff('', 'abc'), [{ operation: 'insert', text: 'abc' }]);
  assert.deepEqual(diff('abc', ''), [{ operation: 'delete', text: 'abc' }]);
});

test('word replacement: delete comes before insert, neighbors merged', () => {
  assert.deepEqual(diff('the quick fox', 'the slow fox'), [
    { operation: 'equal', text: 'the ' },
    { operation: 'delete', text: 'quick' },
    { operation: 'insert', text: 'slow' },
    { operation: 'equal', text: ' fox' },
  ]);
});

test('Korean word diff (broken in the legacy ASCII \\w tokenizer)', () => {
  assert.deepEqual(diff('안녕하세요 세계', '안녕하세요 지구'), [
    { operation: 'equal', text: '안녕하세요 ' },
    { operation: 'delete', text: '세계' },
    { operation: 'insert', text: '지구' },
  ]);
});

test('char mode round-trips', () => {
  const result = diff('kitten', 'sitting', { mode: 'char' });
  const joinedA = result.filter(e => e.operation !== 'insert').map(e => e.text).join('');
  const joinedB = result.filter(e => e.operation !== 'delete').map(e => e.text).join('');
  assert.equal(joinedA, 'kitten');
  assert.equal(joinedB, 'sitting');
});

test('line mode', () => {
  assert.deepEqual(diff('a\nb\nc', 'a\nx\nc', { mode: 'line' }), [
    { operation: 'equal', text: 'a\n' },
    { operation: 'delete', text: 'b\n' },
    { operation: 'insert', text: 'x\n' },
    { operation: 'equal', text: 'c' },
  ]);
});

test('diffTokens with custom tokens', () => {
  assert.deepEqual(diffTokens(['x', 'y'], ['x', 'z']), [
    { operation: 'equal', text: 'x' },
    { operation: 'delete', text: 'y' },
    { operation: 'insert', text: 'z' },
  ]);
});

test('adjacent same-op runs are merged into one entry', () => {
  // No token is shared between the two strings, so every token of a is
  // one delete run and every token of b is one insert run.
  assert.deepEqual(diff('aaa bbb', 'xxx,yyy'), [
    { operation: 'delete', text: 'aaa bbb' },
    { operation: 'insert', text: 'xxx,yyy' },
  ]);
});

test('common whitespace tokens stay equal between changed words', () => {
  assert.deepEqual(diff('one two', 'four five'), [
    { operation: 'delete', text: 'one' },
    { operation: 'insert', text: 'four' },
    { operation: 'equal', text: ' ' },
    { operation: 'delete', text: 'two' },
    { operation: 'insert', text: 'five' },
  ]);
});
