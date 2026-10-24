/**
 * Bond search by distance with a cell list, O(N) in the number of atoms (context.md M6 task 2;
 * the editable rule table and manual bonds come with M6, this is the default rule the renderer
 * needs: bonded when 0.5 A <= d <= 1.15 (r1 + r2) with covalent radii).
 */
export const BOND_TOLERANCE = 1.15;
export const MIN_BOND_LENGTH = 0.5;

export interface BondInput {
  /** Cartesian positions, 3 per atom. */
  cart: ArrayLike<number>;
  count: number;
  /** Species index of each atom, into `maxDistance`/`minDistance`. */
  species: ArrayLike<number>;
  /** nSpecies x nSpecies upper limits in angstrom (0: never bond). Symmetric. */
  maxDistance: Float64Array;
  minDistance: Float64Array;
  nSpecies: number;
}

/** Default pair limits from covalent radii. */
export function defaultBondLimits(covalentRadii: readonly number[]): {
  maxDistance: Float64Array;
  minDistance: Float64Array;
} {
  const n = covalentRadii.length;
  const maxDistance = new Float64Array(n * n);
  const minDistance = new Float64Array(n * n).fill(MIN_BOND_LENGTH);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      maxDistance[i * n + j] = (covalentRadii[i] + covalentRadii[j]) * BOND_TOLERANCE;
  return { maxDistance, minDistance };
}

/** Pairs (i < j) of bonded atoms, two entries per bond. */
export function findBonds(input: BondInput): Uint32Array {
  const { cart, count, species, maxDistance, minDistance, nSpecies } = input;
  if (count < 2) return new Uint32Array(0);

  let cutoff = 0;
  for (let i = 0; i < maxDistance.length; i++) cutoff = Math.max(cutoff, maxDistance[i]);
  if (cutoff <= 0) return new Uint32Array(0);

  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++)
    for (let k = 0; k < 3; k++) {
      const v = cart[3 * i + k];
      if (v < lo[k]) lo[k] = v;
      if (v > hi[k]) hi[k] = v;
    }
  // Bins of one cutoff each, but never more than ~4 million of them (sparse, huge ranges).
  let size = cutoff;
  const dims = (): number[] => [0, 1, 2].map((k) => Math.floor((hi[k] - lo[k]) / size) + 1);
  let d = dims();
  while (d[0] * d[1] * d[2] > 4_000_000) {
    size *= 1.5;
    d = dims();
  }
  const [nx, ny, nz] = d;

  const cellOf = new Int32Array(count);
  const head = new Int32Array(nx * ny * nz).fill(-1);
  const next = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const cx = Math.floor((cart[3 * i] - lo[0]) / size);
    const cy = Math.floor((cart[3 * i + 1] - lo[1]) / size);
    const cz = Math.floor((cart[3 * i + 2] - lo[2]) / size);
    const c = (cx * ny + cy) * nz + cz;
    cellOf[i] = c;
    next[i] = head[c];
    head[c] = i;
  }

  let out = new Uint32Array(Math.max(64, count * 4));
  let n = 0;
  for (let i = 0; i < count; i++) {
    const c = cellOf[i];
    const cz = c % nz;
    const cy = ((c - cz) / nz) % ny;
    const cx = (c - cz - cy * nz) / (ny * nz);
    const xi = cart[3 * i];
    const yi = cart[3 * i + 1];
    const zi = cart[3 * i + 2];
    const si = species[i] * nSpecies;
    for (let x = Math.max(0, cx - 1); x <= Math.min(nx - 1, cx + 1); x++)
      for (let y = Math.max(0, cy - 1); y <= Math.min(ny - 1, cy + 1); y++)
        for (let z = Math.max(0, cz - 1); z <= Math.min(nz - 1, cz + 1); z++) {
          for (let j = head[(x * ny + y) * nz + z]; j >= 0; j = next[j]) {
            if (j <= i) continue;
            const pair = si + species[j];
            const dx = cart[3 * j] - xi;
            const dy = cart[3 * j + 1] - yi;
            const dz = cart[3 * j + 2] - zi;
            const r2 = dx * dx + dy * dy + dz * dz;
            const max = maxDistance[pair];
            const min = minDistance[pair];
            if (r2 > max * max || r2 < min * min) continue;
            if (n + 2 > out.length) {
              const grown = new Uint32Array(out.length * 2);
              grown.set(out);
              out = grown;
            }
            out[n++] = i;
            out[n++] = j;
          }
        }
  }
  return out.slice(0, n);
}
