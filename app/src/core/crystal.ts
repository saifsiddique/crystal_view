/**
 * Shared crystal data model (context.md 5.4). M1 only needs `Cell`; M3 adds `Site`, `SymOp`,
 * `Atom` and `Crystal` here rather than forking the model elsewhere.
 */

/** Unit-cell parameters: lengths in angstrom, angles in degrees (context.md 5.1). */
export interface Cell {
  a: number;
  b: number;
  c: number;
  alpha: number;
  beta: number;
  gamma: number;
}
