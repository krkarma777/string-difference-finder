// Smoke test for the built CommonJS entry, runnable on every supported Node major.
const assert = require('node:assert');
const { diff } = require('../dist/index.cjs');

const entries = diff('a b c', 'a x c');
assert.deepStrictEqual(entries, [
  { operation: 'equal', text: 'a ' },
  { operation: 'delete', text: 'b' },
  { operation: 'insert', text: 'x' },
  { operation: 'equal', text: ' c' },
]);

const a = 'lorem ipsum dolor';
const b = 'lorem IPSUM dolor sit';
for (const mode of ['word', 'char', 'line']) {
  const result = diff(a, b, { mode });
  const joinedA = result.filter(e => e.operation !== 'insert').map(e => e.text).join('');
  const joinedB = result.filter(e => e.operation !== 'delete').map(e => e.text).join('');
  assert.strictEqual(joinedA, a);
  assert.strictEqual(joinedB, b);
}

console.log(`smoke.cjs OK on node ${process.version}`);
