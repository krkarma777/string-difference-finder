// The pre-rewrite Hirschberg LCS implementation, ported verbatim from
// src/main/resources/static/js/diff.js (git history: 089867b) so the
// benchmark compares against exactly what this repo used to ship.
export function splitIntoTokens(str) {
  return str.match(/(\w+|\s+|[^\s\w]+)/g) || [];
}

async function hirschbergLCS(a, b) {
  if (a.length === 0) return [];
  if (a.length === 1) return b.includes(a[0]) ? [a[0]] : [];
  if (b.length === 1) return a.includes(b[0]) ? [b[0]] : [];
  const mid = Math.floor(a.length / 2);
  const [l1, l2] = await Promise.all([
    lcsLengths(a.slice(0, mid), b),
    lcsLengths(reverseArray(a.slice(mid)), reverseArray(b)),
  ]);
  const partition = findPartition(l1, l2);
  const [leftLCS, rightLCS] = await Promise.all([
    hirschbergLCS(a.slice(0, mid), b.slice(0, partition)),
    hirschbergLCS(a.slice(mid), b.slice(partition)),
  ]);
  return leftLCS.concat(rightLCS);
}

async function lcsLengths(a, b) {
  const n = b.length;
  let current = new Array(n + 1).fill(0);
  let previous = new Array(n + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        current[j] = previous[j - 1] + 1;
      } else {
        current[j] = Math.max(previous[j], current[j - 1]);
      }
    }
    [previous, current] = [current, previous];
  }
  return previous;
}

const reverseArray = arr => [...arr].reverse();

function findPartition(l1, l2) {
  const l2Reversed = [...l2].reverse();
  let max = -1;
  let index = 0;
  for (let i = 0; i < l1.length; i++) {
    if (l1[i] + l2Reversed[i] > max) {
      max = l1[i] + l2Reversed[i];
      index = i;
    }
  }
  return index;
}

function commonPrefix(a, b) {
  let i = 0;
  const minLen = Math.min(a.length, b.length);
  while (i < minLen && a[i] === b[i]) i++;
  return i;
}

function commonSuffix(a, b) {
  let i = 0;
  const minLen = Math.min(a.length, b.length);
  while (i < minLen && a[a.length - i - 1] === b[b.length - i - 1]) i++;
  return i;
}

export async function legacyDiff(a, b) {
  const diffs = [];
  const prefixLength = commonPrefix(a, b);
  if (prefixLength > 0) {
    diffs.push({ operation: 'equal', text: a.slice(0, prefixLength).join('') });
    a = a.slice(prefixLength);
    b = b.slice(prefixLength);
  }
  const suffixLength = commonSuffix(a, b);
  let suffix = '';
  if (suffixLength > 0) {
    suffix = a.slice(a.length - suffixLength).join('');
    a = a.slice(0, a.length - suffixLength);
    b = b.slice(0, b.length - suffixLength);
  }
  const lcs = await hirschbergLCS(a, b);
  let i = 0, j = 0, k = 0;
  while (i < a.length || j < b.length) {
    if (k < lcs.length && a[i] === lcs[k] && b[j] === lcs[k]) {
      diffs.push({ operation: 'equal', text: lcs[k] });
      i++; j++; k++;
    } else {
      if (i < a.length && (k >= lcs.length || a[i] !== lcs[k])) {
        diffs.push({ operation: 'delete', text: a[i] });
        i++;
      }
      if (j < b.length && (k >= lcs.length || b[j] !== lcs[k])) {
        diffs.push({ operation: 'insert', text: b[j] });
        j++;
      }
    }
  }
  if (suffixLength > 0) diffs.push({ operation: 'equal', text: suffix });
  return diffs;
}
