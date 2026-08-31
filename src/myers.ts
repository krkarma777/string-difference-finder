export interface MyersResult {
  changedA: Uint8Array;
  changedB: Uint8Array;
}

/**
 * Myers' O(ND) shortest-edit-script diff with the linear-space
 * divide-and-conquer refinement (middle snake), operating on interned
 * token ids. Scratch buffers are allocated once and reused across the
 * whole recursion.
 *
 * With `heuristic` enabled, each subproblem's search is capped at
 * max(64, sqrt(N+M)) phases (the git xdiff approach): past the cap it
 * splits at the furthest-reaching point found so far instead of the true
 * middle snake. The result is always a valid edit script, but no longer
 * guaranteed minimal; pathological inputs go from O((N+M)·D) to roughly
 * O((N+M)^1.5).
 */
export function myersDiff(a: Int32Array, b: Int32Array, heuristic = false): MyersResult {
  const n = a.length;
  const m = b.length;
  const changedA = new Uint8Array(n);
  const changedB = new Uint8Array(m);
  if (n === 0 || m === 0) {
    changedA.fill(1);
    changedB.fill(1);
    return { changedA, changedB };
  }
  const offset = n + m;
  const vf = new Int32Array(2 * (n + m) + 3);
  const vb = new Int32Array(2 * (n + m) + 3);

  walk(a, 0, n, b, 0, m, changedA, changedB, vf, vb, offset, heuristic);
  return { changedA, changedB };
}

function walk(
  a: Int32Array, a0: number, a1: number,
  b: Int32Array, b0: number, b1: number,
  changedA: Uint8Array, changedB: Uint8Array,
  vf: Int32Array, vb: Int32Array, offset: number,
  heuristic: boolean,
): void {
  while (a0 < a1 && b0 < b1 && a[a0] === b[b0]) { a0++; b0++; }
  while (a1 > a0 && b1 > b0 && a[a1 - 1] === b[b1 - 1]) { a1--; b1--; }

  if (a0 === a1) {
    changedB.fill(1, b0, b1);
    return;
  }
  if (b0 === b1) {
    changedA.fill(1, a0, a1);
    return;
  }

  const [sx, sy, ex, ey] = middleSnake(a, a0, a1, b, b0, b1, vf, vb, offset, heuristic);
  walk(a, a0, a0 + sx, b, b0, b0 + sy, changedA, changedB, vf, vb, offset, heuristic);
  walk(a, a0 + ex, a1, b, b0 + ey, b1, changedA, changedB, vf, vb, offset, heuristic);
}

/**
 * Finds a snake lying on some shortest edit path, in local coordinates
 * relative to (a0, b0). Returns [startX, startY, endX, endY].
 *
 * vf[k] holds the furthest x reached on diagonal k (k = x - y) walking
 * forward from (0,0); vb[k] holds the smallest x reached on diagonal k
 * walking backward from (N,M) — both in forward coordinates. Each phase
 * only reads cells written by the previous phase (or the seeds), so the
 * shared scratch buffers never need clearing between subproblems.
 *
 * Preconditions: both ranges non-empty, no common prefix/suffix (hence
 * the true edit distance D is at least 2, which guarantees the d=0 phase
 * can never report an overlap and every returned split makes progress).
 */
function middleSnake(
  a: Int32Array, a0: number, a1: number,
  b: Int32Array, b0: number, b1: number,
  vf: Int32Array, vb: Int32Array, offset: number,
  heuristic: boolean,
): [number, number, number, number] {
  const n = a1 - a0;
  const m = b1 - b0;
  const delta = n - m;
  const deltaOdd = (delta & 1) !== 0;
  const dMax = Math.ceil((n + m) / 2);
  const maxCost = heuristic ? Math.max(64, Math.floor(Math.sqrt(n + m))) : 0;

  vf[offset + 1] = 0;
  vb[offset + delta + 1] = n + 1;

  for (let d = 0; d <= dMax; d++) {
    if (maxCost !== 0 && d > maxCost) {
      const split = bestEffortSplit(vf, vb, offset, d - 1, n, m, delta);
      if (split !== null) return split;
      // Both candidates were degenerate corners; fall through and keep
      // searching exactly — the overlap must be imminent.
    }
    // Forward pass for phase d.
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && vf[offset + k - 1] < vf[offset + k + 1])) {
        x = vf[offset + k + 1];
      } else {
        x = vf[offset + k - 1] + 1;
      }
      let y = x - k;
      const sx = x;
      const sy = y;
      while (x < n && y < m && a[a0 + x] === b[b0 + y]) { x++; y++; }
      vf[offset + k] = x;
      if (deltaOdd && k - delta >= -(d - 1) && k - delta <= d - 1 && x >= vb[offset + k]) {
        return [sx, sy, x, y];
      }
    }
    // Backward pass for phase d.
    for (let k = delta - d; k <= delta + d; k += 2) {
      let x: number;
      if (k === delta - d || (k !== delta + d && vb[offset + k + 1] - 1 < vb[offset + k - 1])) {
        x = vb[offset + k + 1] - 1;
      } else {
        x = vb[offset + k - 1];
      }
      let y = x - k;
      const ex = x;
      const ey = y;
      while (x > 0 && y > 0 && a[a0 + x - 1] === b[b0 + y - 1]) { x--; y--; }
      vb[offset + k] = x;
      if (!deltaOdd && k >= -d && k <= d && x <= vf[offset + k]) {
        return [x, y, ex, ey];
      }
    }
  }
  throw new Error('middleSnake: no overlap found (invariant violated)');
}

/**
 * Heuristic bailout: picks the furthest-reaching point recorded in phase
 * `d` of either direction and splits there. Any point on a furthest
 * forward/backward path is a valid (if not necessarily optimal) split, and
 * its distance from the corner is at least `d`, so both children shrink.
 */
function bestEffortSplit(
  vf: Int32Array, vb: Int32Array, offset: number,
  d: number, n: number, m: number, delta: number,
): [number, number, number, number] | null {
  let fx = -1;
  let fy = -1;
  let fSum = -1;
  for (let k = -d; k <= d; k += 2) {
    const x = vf[offset + k];
    const y = x - k;
    if (x >= 0 && y >= 0 && x <= n && y <= m && x + y > fSum) {
      fSum = x + y;
      fx = x;
      fy = y;
    }
  }
  let bx = -1;
  let by = -1;
  let bSum = -1;
  for (let k = delta - d; k <= delta + d; k += 2) {
    const x = vb[offset + k];
    const y = x - k;
    if (x >= 0 && y >= 0 && x <= n && y <= m && (n - x) + (m - y) > bSum) {
      bSum = (n - x) + (m - y);
      bx = x;
      by = y;
    }
  }
  const forwardUsable = fSum >= 0 && !(fx === n && fy === m);
  const backwardUsable = bSum >= 0 && !(bx === 0 && by === 0);
  if (forwardUsable && (!backwardUsable || fSum >= bSum)) return [fx, fy, fx, fy];
  if (backwardUsable) return [bx, by, bx, by];
  return null;
}
