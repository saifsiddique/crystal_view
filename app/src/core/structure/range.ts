/**
 * Which lattice images of the unit-cell atoms fall inside a fractional box (context.md M6 task 1;
 * the presets and the slab come with M6, the box itself is what the renderer needs).
 *
 * The box is closed: an atom exactly on a bound is included, so the default [0, 1]^3 is the cell
 * *with* its boundary atoms (the NaCl corner atom shows up at all eight corners).
 */
import type { Crystal } from '../crystal';
import type { Vec3 } from '../math/vec3';

export interface Range {
  min: Vec3;
  max: Vec3;
}

/** Bounds are widened by this much (fractional) so atoms on a bound survive rounding. */
export const RANGE_EPSILON = 1e-4;

export const UNIT_CELL_RANGE: Range = { min: [0, 0, 0], max: [1, 1, 1] };

/** Struct-of-arrays list of placed atoms, cheap to hold for 10^5 atoms. */
export interface PlacedAtoms {
  count: number;
  /** Index into `Crystal.atoms`. */
  atom: Uint32Array;
  /** Integer lattice translation of each image, 3 per atom. */
  cell: Int16Array;
  /** Fractional position including the translation, 3 per atom. */
  frac: Float64Array;
}

/** Hard cap so a typo in a range cannot ask the browser for a billion atoms. */
export const MAX_PLACED_ATOMS = 2_000_000;

export class RangeError extends Error {}

export function placeAtoms(crystal: Crystal, range: Range = UNIT_CELL_RANGE): PlacedAtoms {
  const { min, max } = range;
  for (let k = 0; k < 3; k++) {
    if (!(Number.isFinite(min[k]) && Number.isFinite(max[k])) || max[k] < min[k]) {
      throw new RangeError(`Invalid range on axis ${'abc'[k]}: ${min[k]} to ${max[k]}.`);
    }
  }
  const span = [0, 1, 2].map((k) => Math.floor(max[k] + RANGE_EPSILON) - Math.ceil(min[k] - 1) + 2);
  if (span[0] * span[1] * span[2] * crystal.atoms.length > MAX_PLACED_ATOMS * 8) {
    throw new RangeError('The requested range is far too large to display.');
  }

  const atoms: number[] = [];
  const cells: number[] = [];
  const fracs: number[] = [];
  const lo = [0, 0, 0];
  const hi = [0, 0, 0];
  for (let ai = 0; ai < crystal.atoms.length; ai++) {
    const f = crystal.atoms[ai].frac;
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.ceil(min[k] - f[k] - RANGE_EPSILON);
      hi[k] = Math.floor(max[k] - f[k] + RANGE_EPSILON);
    }
    for (let i = lo[0]; i <= hi[0]; i++)
      for (let j = lo[1]; j <= hi[1]; j++)
        for (let k = lo[2]; k <= hi[2]; k++) {
          atoms.push(ai);
          cells.push(i, j, k);
          fracs.push(f[0] + i, f[1] + j, f[2] + k);
          if (atoms.length > MAX_PLACED_ATOMS) {
            throw new RangeError(
              `More than ${MAX_PLACED_ATOMS.toLocaleString('en')} atoms in range; reduce the range.`,
            );
          }
        }
  }
  return {
    count: atoms.length,
    atom: Uint32Array.from(atoms),
    cell: Int16Array.from(cells),
    frac: Float64Array.from(fracs),
  };
}
