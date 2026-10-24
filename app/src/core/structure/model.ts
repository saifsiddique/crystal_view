/**
 * Everything the renderer draws, as flat arrays: the atoms in a range with their Cartesian
 * positions, radii and colours, and the bonds between them. Pure data, no three.js.
 */
import type { Crystal } from '../crystal';
import { fracToCart } from '../lattice';
import { elementInfo } from '../scattering';
import { defaultBondLimits, findBonds } from './bonds';
import { UNIT_CELL_RANGE, placeAtoms, type PlacedAtoms, type Range } from './range';

export type DisplayStyle = 'ballStick' | 'spaceFill' | 'stick';

export interface ModelOptions {
  range?: Range;
  bonds?: boolean;
}

export interface StructureModel {
  count: number;
  /** Cartesian positions in angstrom, 3 per atom. */
  cart: Float64Array;
  /** Distinct elements shown, in first-seen order. */
  elements: string[];
  /** Index into `elements` for every atom. */
  species: Uint16Array;
  /** `Crystal.atoms` index and lattice translation for every atom. */
  placed: PlacedAtoms;
  /** Bonded pairs, two atom indices per bond. */
  bonds: Uint32Array;
  /** Per element: covalent and van der Waals radius, colour. */
  info: { covalent: number; vdw: number; color: string }[];
  /** Axis-aligned bounds of the atom positions. */
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

export function buildModel(crystal: Crystal, options: ModelOptions = {}): StructureModel {
  const placed = placeAtoms(crystal, options.range ?? UNIT_CELL_RANGE);
  const count = placed.count;
  const cart = new Float64Array(3 * count);
  const elements: string[] = [];
  const index = new Map<string, number>();
  const species = new Uint16Array(count);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    const p = fracToCart(crystal.lattice, [
      placed.frac[3 * i],
      placed.frac[3 * i + 1],
      placed.frac[3 * i + 2],
    ]);
    for (let k = 0; k < 3; k++) {
      cart[3 * i + k] = p[k];
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
    const el = crystal.atoms[placed.atom[i]].element;
    let s = index.get(el);
    if (s === undefined) {
      s = elements.length;
      elements.push(el);
      index.set(el, s);
    }
    species[i] = s;
  }
  if (count === 0) {
    min.fill(0);
    max.fill(0);
  }

  const info = elements.map((el) => {
    const e = elementInfo(el);
    return {
      covalent: e.covalentRadius,
      vdw: e.vdwRadius ?? e.covalentRadius * 1.6,
      color: e.color,
    };
  });
  const bonds =
    options.bonds === false
      ? new Uint32Array(0)
      : findBonds({
          cart,
          count,
          species,
          nSpecies: elements.length,
          ...defaultBondLimits(info.map((i) => i.covalent)),
        });
  return { count, cart, elements, species, placed, bonds, info, bounds: { min, max } };
}

/** Radii (angstrom) of the atom spheres and of the bond sticks for a display style. */
export function styleRadii(
  model: StructureModel,
  style: DisplayStyle,
): { atom: Float32Array; bond: number; showBonds: boolean } {
  const bond = 0.12;
  const perElement = model.info.map((i) =>
    style === 'spaceFill' ? i.vdw : style === 'stick' ? bond : i.covalent * 0.45,
  );
  const atom = new Float32Array(model.count);
  for (let i = 0; i < model.count; i++) atom[i] = perElement[model.species[i]];
  return { atom, bond, showBonds: style !== 'spaceFill' };
}
