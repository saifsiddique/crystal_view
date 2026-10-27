// The test hook the viewer puts on `window` (src/ui/Viewer.svelte), shared by all e2e specs.
interface CrystalLensHook {
  atomScreen(i: number): { x: number; y: number };
  stats(): { frames: number; renders: number };
  model(): { count: number; bonds: Uint32Array; elements: string[]; species: Uint16Array };
  pickAt(x: number, y: number): number | null;
  selection(): number[];
  viewState(): { direction: number[]; up: number[]; visibleHeight: number };
  settings(): {
    hiddenAtoms: unknown[];
    appearance: { elements: Record<string, { visible?: boolean; color?: string }> };
    bonds: { manual: { add: unknown[]; remove: unknown[] } };
  };
  bondsDrawn(): boolean;
  appearanceMs(): number;
  buildMs(): number;
  turn(right: number, upward: number, roll: number): void;
  polyhedra(): { count: number; skipped: number };
  legend(): { label: string; color: string }[];
}

// The electron-diffraction tab's hook (src/ui/DiffractionTab.svelte).
interface EDSpot {
  hkl: number[];
  I: number;
  x: number;
  y: number;
  zone: number;
  forbidden: boolean;
}
interface CrystalLensEDHook {
  viewState(): { direction: number[]; up: number[]; visibleHeight: number };
  pattern(): { count: number; zoneAxis: number[]; lambda: number; spots: EDSpot[] } | null;
  reading(): { indices: number[]; angleDeg: number } | null;
  computeMs(): number;
  overlay(): {
    bands: number;
    rings: { n: number; radius: number; cx: number; cy: number; allowed: boolean }[];
    holz: number;
    disc: number | null;
    ms: number;
  };
  drawn(): number;
  labels(): number;
  spotClient(key: string): { x: number; y: number } | null;
  pxPerInvA(): number;
  measurement(): unknown;
  renders(): number;
  dynamic(): {
    solving: number | null;
    shown: boolean;
    warning: boolean;
    note: string;
    beams: number;
    ms: number;
    transmitted: number | null;
    total: number | null;
    spots: { hkl: number[]; I: number; fraction: number; kinematicallyForbidden: boolean }[];
  };
}

// The Powder XRD tab's hook (src/ui/PowderTab.svelte).
interface CrystalLensXRDHook {
  peaks(): { hkl: number[]; m: number; d: number; twoTheta: number; F: number; I: number }[];
  merged(): number;
  lambda(): number;
  ms(): { peaks: number; profile: number };
  view(): { u0: number; u1: number };
  profile(): { n: number; max: number; first: number; last: number } | null;
  labels(): number;
  ticks(): number;
  peakClient(key: string): { x: number; y: number } | null;
  cifB(): number;
}

interface Window {
  __crystallens: CrystalLensHook;
  __crystallensED: CrystalLensEDHook;
  __crystallensXRD: CrystalLensXRDHook;
}
