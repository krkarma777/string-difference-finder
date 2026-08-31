// Smoke test for the built ESM entry, runnable on every supported Node major.
import assert from 'node:assert';
import { diff, diffTokens, tokenize } from '../dist/index.js';

const entries = diff('the quick fox', 'the slow fox');
assert.deepStrictEqual(entries, [
  { operation: 'equal', text: 'the ' },
  { operation: 'delete', text: 'quick' },
  { operation: 'insert', text: 'slow' },
  { operation: 'equal', text: ' fox' },
]);

assert.deepStrictEqual(diff('안녕하세요 세계', '안녕하세요 지구')[0], { operation: 'equal', text: '안녕하세요 ' });

for (const mode of ['word', 'char', 'line']) {
  const a = 'alpha beta\ngamma delta 😀';
  const b = 'alpha BETA\ngamma epsilon 😀!';
  const result = diff(a, b, { mode });
  const joinedA = result.filter(e => e.operation !== 'insert').map(e => e.text).join('');
  const joinedB = result.filter(e => e.operation !== 'delete').map(e => e.text).join('');
  assert.strictEqual(joinedA, a, `round-trip a failed in ${mode} mode`);
  assert.strictEqual(joinedB, b, `round-trip b failed in ${mode} mode`);
}

assert.deepStrictEqual(diffTokens(['x', 'y'], ['x', 'z']).length, 3);
assert.deepStrictEqual(tokenize('a b', 'word'), ['a', ' ', 'b']);

console.log(`smoke.mjs OK on node ${process.version}`);
