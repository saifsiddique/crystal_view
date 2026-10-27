/**
 * Eigen-decomposition of a complex Hermitian matrix (context.md M11), in plain TypeScript.
 *
 * H = Re + i Im (Re symmetric, Im antisymmetric) is solved through the real symmetric matrix of
 * twice the size
 *   M = [ Re  -Im ]
 *       [ Im   Re ],
 * whose eigenvalues are those of H, each twice: [x; y] is an eigenvector of M exactly when
 * x + i y is one of H (and [-y; x] belongs to i (x + i y), the same complex direction). M is
 * reduced to tridiagonal form by Householder reflections and diagonalised by the implicit QL
 * method (the EISPACK tred2/tql2 pair, as in JAMA). The eigenvectors of each group of equal
 * eigenvalues are then turned into an orthonormal set of complex vectors by Gram-Schmidt, which
 * keeps one of every (v, i v) pair and works for degenerate eigenvalues too.
 *
 * Matrices are dense, row-major Float64Arrays of n × n (separate real and imaginary parts).
 */

export interface HermitianEigen {
  n: number;
  /** Eigenvalues, ascending. */
  values: Float64Array;
  /** Eigenvectors as columns: element (row r, vector j) at r * n + j. */
  re: Float64Array;
  im: Float64Array;
}

/**
 * Eigenvalues and eigenvectors of a real symmetric matrix. `V` holds the matrix (column-major,
 * which is the same as row-major for a symmetric matrix) and is overwritten by the eigenvectors
 * as columns (V[c * n + r] = component r of vector c). Returns the eigenvalues (unsorted).
 */
export function symmetricEigen(V: Float64Array, n: number): Float64Array {
  const d = new Float64Array(n);
  const e = new Float64Array(n);
  if (n === 0) return d;
  tred2(V, n, d, e);
  tql2(V, n, d, e);
  return d;
}

// V[col * n + row]; the inner loops of both routines run down a column, so they are contiguous.
function tred2(V: Float64Array, n: number, d: Float64Array, e: Float64Array): void {
  for (let j = 0; j < n; j++) d[j] = V[j * n + n - 1];
  for (let i = n - 1; i > 0; i--) {
    let scale = 0;
    let h = 0;
    for (let k = 0; k < i; k++) scale += Math.abs(d[k]);
    if (scale === 0) {
      e[i] = d[i - 1];
      for (let j = 0; j < i; j++) {
        d[j] = V[j * n + i - 1];
        V[j * n + i] = 0;
        V[i * n + j] = 0;
      }
    } else {
      for (let k = 0; k < i; k++) {
        d[k] /= scale;
        h += d[k] * d[k];
      }
      let f = d[i - 1];
      let g = Math.sqrt(h);
      if (f > 0) g = -g;
      e[i] = scale * g;
      h -= f * g;
      d[i - 1] = f - g;
      for (let j = 0; j < i; j++) e[j] = 0;
      for (let j = 0; j < i; j++) {
        f = d[j];
        V[i * n + j] = f;
        const cj = j * n;
        g = e[j] + V[cj + j] * f;
        for (let k = j + 1; k <= i - 1; k++) {
          g += V[cj + k] * d[k];
          e[k] += V[cj + k] * f;
        }
        e[j] = g;
      }
      f = 0;
      for (let j = 0; j < i; j++) {
        e[j] /= h;
        f += e[j] * d[j];
      }
      const hh = f / (h + h);
      for (let j = 0; j < i; j++) e[j] -= hh * d[j];
      for (let j = 0; j < i; j++) {
        f = d[j];
        g = e[j];
        const cj = j * n;
        for (let k = j; k <= i - 1; k++) V[cj + k] -= f * e[k] + g * d[k];
        d[j] = V[cj + i - 1];
        V[cj + i] = 0;
      }
    }
    d[i] = h;
  }
  // accumulate the transformations
  for (let i = 0; i < n - 1; i++) {
    V[i * n + n - 1] = V[i * n + i];
    V[i * n + i] = 1;
    const h = d[i + 1];
    const ci1 = (i + 1) * n;
    if (h !== 0) {
      for (let k = 0; k <= i; k++) d[k] = V[ci1 + k] / h;
      for (let j = 0; j <= i; j++) {
        const cj = j * n;
        let g = 0;
        for (let k = 0; k <= i; k++) g += V[ci1 + k] * V[cj + k];
        for (let k = 0; k <= i; k++) V[cj + k] -= g * d[k];
      }
    }
    for (let k = 0; k <= i; k++) V[ci1 + k] = 0;
  }
  for (let j = 0; j < n; j++) {
    d[j] = V[j * n + n - 1];
    V[j * n + n - 1] = 0;
  }
  V[(n - 1) * n + n - 1] = 1;
  e[0] = 0;
}

function tql2(V: Float64Array, n: number, d: Float64Array, e: Float64Array): void {
  for (let i = 1; i < n; i++) e[i - 1] = e[i];
  e[n - 1] = 0;
  let f = 0;
  let tst1 = 0;
  const eps = 2 ** -52;
  for (let l = 0; l < n; l++) {
    tst1 = Math.max(tst1, Math.abs(d[l]) + Math.abs(e[l]));
    let m = l;
    while (m < n) {
      if (Math.abs(e[m]) <= eps * tst1) break;
      m++;
    }
    if (m > l) {
      let iter = 0;
      do {
        if (++iter > 60) throw new Error('The eigenvalue iteration did not converge.');
        let g = d[l];
        let p = (d[l + 1] - g) / (2 * e[l]);
        let r = Math.sqrt(p * p + 1);
        if (p < 0) r = -r;
        d[l] = e[l] / (p + r);
        d[l + 1] = e[l] * (p + r);
        const dl1 = d[l + 1];
        let h = g - d[l];
        for (let i = l + 2; i < n; i++) d[i] -= h;
        f += h;
        p = d[m];
        let c = 1;
        let c2 = c;
        let c3 = c;
        const el1 = e[l + 1];
        let s = 0;
        let s2 = 0;
        for (let i = m - 1; i >= l; i--) {
          c3 = c2;
          c2 = c;
          s2 = s;
          g = c * e[i];
          h = c * p;
          r = Math.sqrt(p * p + e[i] * e[i]);
          e[i + 1] = s * r;
          s = e[i] / r;
          c = p / r;
          p = c * d[i] - s * g;
          d[i + 1] = h + s * (c * g + s * d[i]);
          const ci = i * n;
          const ci1 = ci + n;
          for (let k = 0; k < n; k++) {
            h = V[ci1 + k];
            V[ci1 + k] = s * V[ci + k] + c * h;
            V[ci + k] = c * V[ci + k] - s * h;
          }
        }
        p = (-s * s2 * c3 * el1 * e[l]) / dl1;
        e[l] = s * p;
        d[l] = c * p;
      } while (Math.abs(e[l]) > eps * tst1);
    }
    d[l] += f;
    e[l] = 0;
  }
}

/**
 * Eigenvalues (ascending) and orthonormal eigenvectors of the Hermitian matrix re + i·im.
 * Only the lower triangle is read; the matrix is assumed Hermitian.
 */
export function hermitianEigen(re: Float64Array, im: Float64Array, n: number): HermitianEigen {
  const N = 2 * n;
  const M = new Float64Array(N * N);
  for (let r = 0; r < n; r++)
    for (let c = 0; c <= r; c++) {
      const a = re[r * n + c];
      const b = r === c ? 0 : im[r * n + c];
      // H[r][c] = a + ib, H[c][r] = a - ib
      M[r * N + c] = M[c * N + r] = a;
      M[(r + n) * N + c + n] = M[(c + n) * N + r + n] = a;
      // lower-left block Im, upper-right -Im (and symmetric)
      M[(r + n) * N + c] = M[c * N + r + n] = b;
      M[(c + n) * N + r] = M[r * N + c + n] = -b;
    }
  const d = symmetricEigen(M, N);
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => d[a] - d[b]);

  const values = new Float64Array(n);
  const vre = new Float64Array(n * n);
  const vim = new Float64Array(n * n);
  let scale = 0;
  for (let i = 0; i < N; i++) scale = Math.max(scale, Math.abs(d[i]));
  const tol = 1e-9 * Math.max(scale, 1e-300);

  // candidate complex vectors of one group of (numerically) equal eigenvalues
  const xr = new Float64Array(n);
  const xi = new Float64Array(n);
  let kept = 0;
  let start = 0;
  while (start < N) {
    let end = start + 1;
    while (end < N && d[order[end]] - d[order[end - 1]] <= tol) end++;
    const groupStart = kept;
    for (let g = start; g < end && kept < n; g++) {
      const col = order[g] * N;
      for (let r = 0; r < n; r++) {
        xr[r] = M[col + r];
        xi[r] = M[col + r + n];
      }
      // two passes of Gram-Schmidt against the vectors kept from this group
      for (let pass = 0; pass < 2; pass++)
        for (let j = groupStart; j < kept; j++) {
          // projection coefficient b†x
          let pr = 0;
          let pi = 0;
          for (let r = 0; r < n; r++) {
            const br = vre[r * n + j];
            const bi = vim[r * n + j];
            pr += br * xr[r] + bi * xi[r];
            pi += br * xi[r] - bi * xr[r];
          }
          for (let r = 0; r < n; r++) {
            const br = vre[r * n + j];
            const bi = vim[r * n + j];
            xr[r] -= pr * br - pi * bi;
            xi[r] -= pr * bi + pi * br;
          }
        }
      let norm2 = 0;
      for (let r = 0; r < n; r++) norm2 += xr[r] * xr[r] + xi[r] * xi[r];
      if (norm2 < 0.25) continue; // the partner (i times a vector already kept)
      const inv = 1 / Math.sqrt(norm2);
      let sum = 0;
      for (let g2 = start; g2 < end; g2++) sum += d[order[g2]];
      values[kept] = sum / (end - start);
      for (let r = 0; r < n; r++) {
        vre[r * n + kept] = xr[r] * inv;
        vim[r * n + kept] = xi[r] * inv;
      }
      kept++;
    }
    start = end;
  }
  if (kept !== n)
    throw new Error(`The Hermitian eigen-decomposition found ${kept} of ${n} vectors.`);
  return { n, values, re: vre, im: vim };
}
