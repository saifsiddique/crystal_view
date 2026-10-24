# context.md: CrystalLens (working name)

> A faster, more convenient CrystalMaker-style tool. It shows crystal structures in 3D and simulates
> electron diffraction (kinematic and dynamical, with Kikuchi and HOLZ) and powder X-ray diffraction
> (PXRD), all in the browser.
>
> **How to use this file:** each implementation session works on **one module** (M0–M15). Read §1–§6
> (shared context), the module's section in §7 and §10 (dev environment: how to run things), and
> nothing else. When a module is done, update the status table in §0 and record anything the next
> modules must know under that module's "status" block (as M0 does).
> Session prompt template: *"Read context.md §1–§6, §7.Mx and §10 (dev environment). Implement module Mx. Meet its
> acceptance criteria and update §0."*

---

## 0. Status tracker

| Module | Title | Depends on | Status |
|---|---|---|---|
| M0 | Foundation & tooling | – | ✅ done 2026-10-23 (see §7.M0 and §10) |
| M1 | Lattice & linear-algebra core | M0 | ✅ done 2026-10-23 (see §7.M1) |
| M2 | CIF parser & writer | M0 | ✅ done 2026-10-23 (see §7.M2) |
| M3 | Symmetry & Crystal model | M1, M2 | ✅ done 2026-10-24 (see §7.M3) |
| M4 | Scattering-factor tables | M0 | ☐ |
| M5 | 3D structure renderer | M3 | ☐ |
| M6 | View range, bonds, styles & colours | M5 | ☐ |
| M7 | Orientation control (mouse ↔ [uvw]/(hkl)) | M5, M1 | ☐ |
| M8 | Kinematic electron diffraction (indexed) | M3, M4, M7 | ☐ |
| M9 | Powder XRD | M3, M4 | ☐ |
| M10 | Kikuchi lines & HOLZ (geometric) | M8 | ☐ |
| M11 | Dynamical diffraction (Bloch wave, WASM) | M8, M10 | ☐ |
| M12 | Export (PNG / SVG / CSV / CIF / session) | M6, M8, M9 | ☐ |
| M13 | COD search + CORS proxy | M2 | ☐ |
| M14 | App shell, menus, panels, PWA | M0 (grows with all) | ☐ |
| M15 | Performance audit & desktop escape hatch | all | ☐ |

Suggested order: M0 → M1 → M2 → M3 → M4 → M14 (skeleton) → M5 → M6 → M7 → M8 → M9 → M12 → M13 → M10 → M11 → M15.
You have a usable "better v6" after M8.

---

## 1. Product scope

### In scope
- **Load structures** from a local CIF (file picker or drag-and-drop) or by searching the **Crystallography Open Database (COD)**.
- **3D viewer:**
  - Ball-and-stick, space-filling and stick styles.
  - Unit-cell outline and axes triad.
  - Orthographic or perspective projection.
  - Mouse rotation, pan and zoom.
- **Orientation:**
  - View along a direction [uvw] or normal to a plane (hkl), typed in.
  - Live readout of the nearest zone axis while rotating with the mouse.
- **Display range:** fractional min/max on each axis, with boundary atoms included.
- **Bonds:** automatic by distance, editable rules per element pair (min/max Å), and manual add/remove.
- **Appearance:**
  - Per-element (and per-site) colour and radius.
  - Show/hide for each element, site, and bond pair.
  - Background colour.
- **Electron diffraction (ED):**
  - Kinematic, indexed spot patterns for any zone axis, with tilt, accelerating voltage, thickness and camera length.
  - Measuring tools.
- **Dynamical diffraction:**
  - Kikuchi line maps, HOLZ rings and HOLZ lines (geometric).
  - Bloch-wave dynamical spot intensities against thickness.
  - CBED discs with HOLZ line contrast.
- **PXRD:**
  - X-ray and neutron.
  - Kα1/Kα2 radiation, peak profiles and an indexed peak table.
  - Overlay of experimental data and multi-phase mixtures.
- **Export:**
  - PNG (high resolution) and **SVG (true vector)** for the 3D view, ED, Kikuchi/CBED and PXRD.
  - CSV peak and spot lists, CIF, and session JSON.

### Out of scope (point users to other tools)
- Structure building and editing beyond bonds and visibility.
- Rietveld refinement (GSAS-II, FullProf).
- Full multislice image simulation (abTEM).
- Magnetic, modulated and incommensurate structures.
- Isosurfaces.

---

## 2. Platform decision: web app only

**Decision: everything ships as one static web app** (installable as a PWA). There is no desktop app
unless the trigger in M15 fires.

Reasons:
- **Cheap in TypeScript:** the viewer, bonds, range, kinematic ED, PXRD, geometric Kikuchi/HOLZ and export each take milliseconds to about 200 ms.
  - Three.js `InstancedMesh` handles 10⁵ atoms at 60 fps.
- **Dynamical diffraction is the only heavy part.** It runs as a **Rust kernel compiled to WASM** (SIMD) and is parallelised across Web Workers.
  - Zone-axis Bloch wave (≤ 300 beams): about 0.1–1 s.
  - CBED with 64×64 incident directions: a few seconds, with a progress bar.
- **Escape hatch:** the same Rust crate compiles natively. If M15 benchmarks miss their budget, wrap the same front end in **Tauri v2** and call the native kernel. That's a thin wrapper, not a rewrite.
  - The only feature expected to need it is full dynamical Kikuchi master patterns (EMsoft-style), which is a stretch goal.

**Server-side:** none, except a ~40-line **Cloudflare Worker CORS proxy** for COD (M13).
COD's CIF, search and OPTIMADE endpoints send no `Access-Control-Allow-Origin` header (verified 2026-10), so
browsers can't call them directly.

---

## 3. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript 6 (strict) | `core/` has no DOM access; enforced by `tsconfig.core.json` + ESLint (§5.3) |
| Build | Vite 8 | Static output for GitHub Pages, `base: './'`. Needs Node ≥ 22.12 (§10) |
| UI | Svelte 5 | Runes; components in `src/ui/` |
| 3D | Three.js | `InstancedMesh` for atoms and bonds; `OrthographicCamera` by default |
| 2D plots | Custom SVG for ED, Kikuchi and CBED; Plotly.js (MIT) for PXRD | SVG export is native |
| Heavy compute | Rust → `wasm-pack` (crate `kernels/`) | Bloch wave and Hermitian eigen-solver (`nalgebra`) |
| Parallelism | Web Workers via `comlink` | One pool, sized to `navigator.hardwareConcurrency - 1` |
| Symmetry | `moyo` (Rust, WASM) or an spglib WASM build | Check availability in M3; fall back to bundled symop tables |
| Storage | IndexedDB via `idb-keyval` | Recent files, COD cache, preferences |
| Tests | Vitest 4 (unit), Playwright (e2e, Chromium), `cargo test` (Rust) | Fixtures generated once with pymatgen (§7.M0) |
| Lint/format | ESLint 9 (flat config), Prettier 3 | `npm run lint`, `npm run format:check` run in CI |
| Proxy | Cloudflare Worker | `proxy/` |

Do **not** use CanvasJS (commercial licence) or mathjs (unnecessary; use our own 3×3 helpers).

---

## 4. Repository layout

```
strFac_app/
  context.md               ← this file
  legacy/v1 … v6/          ← old prototypes (read-only reference; see §6; there is no v4)
  .github/workflows/ci.yml ← lint, typecheck, unit + Rust + e2e tests, build, Pages deploy
  app/
    index.html
    package.json, vite.config.ts, eslint.config.js, playwright.config.ts
    tsconfig.{app,core,node,test}.json   (core = ES2023 only, no DOM; see §5.3)
    src/wasm/              ← GENERATED by `npm run build:wasm` (gitignored); imported by the worker
    src/
      core/                ← pure TS, deterministic, unit-tested; NO DOM, NO three.js
        math/              (vec3, mat3, gcd, rational approx)                      M1
        lattice.ts         (cell ↔ matrices, metric tensor, d, angles, uvw↔hkl)  M1
        cif/               (tokenizer.ts, parse.ts, write.ts)                     M2
        symmetry/          (symop.ts, expand.ts, spacegroup.ts, tables/)          M3
        crystal.ts         (Crystal model + builders)                            M3
        scattering/        (xray.ts, electron.ts, neutron.ts, data/*.json)       M4
        structure/         (range.ts, bonds.ts, styles.ts, polyhedra.ts)          M6
        diffraction/
          structureFactor.ts                                                     M8/M9
          electron.ts      (kinematic ED)                                        M8
          powder.ts        (PXRD)                                                M9
          kikuchi.ts, holz.ts                                                    M10
          dynamical.ts     (TS wrapper around WASM kernel)                       M11
      render/              ← three.js scene, picking, camera ↔ orientation     M5–M7
      plots/               ← SVG ED/Kikuchi/CBED renderers, Plotly PXRD          M8–M11
      export/              ← png.ts, svg3d.ts, csv.ts, session.ts                 M12
      io/                  ← fileOpen.ts, cod.ts                                  M13
      workers/             ← compute.worker.ts (comlink)                         M8+
      state/               ← Svelte stores: crystal, view, settings              M14
      ui/                  ← components, menus, dialogs                          M14
    tests/
      fixtures/cifs/       ← 7 real COD CIFs (committed)
      fixtures/json/       ← pymatgen-generated references, one per CIF (committed; schema in §7.M0)
      unit/  e2e/
    scripts/
      make_fixtures.py     ← pymatgen fixture generator (run offline; §10)
      ensure-wasm.mjs      ← `predev`/`prebuild` guard: fails with instructions if src/wasm is missing
      cod_robustness.ts    ← (M2) parse N random COD CIFs, report failures
  kernels/                 ← Rust crate → WASM (and native, if M15 triggers); .cargo/config.toml enables simd128
  proxy/                   ← Cloudflare Worker (COD CORS proxy)
```

---

## 5. Conventions (every module must follow these)

### 5.1 Units
- Lengths are in **Å**; angles are stored in **degrees** and converted to radians only inside math functions.
- Reciprocal space uses the **crystallographic convention, without 2π**: |g| = 1/d (Å⁻¹).
- s = sinθ/λ = |g|/2. Check every scattering-factor parameterisation for whether it uses s, g or q = 4πs.
- Accelerating voltage is in kV, λ in Å, camera length in mm, thickness in Å.

### 5.2 Coordinate frames
- **Cartesian (standard):** **a ∥ x**, **b in the xy-plane**, c completes the right-handed set (c* ∥ z).
- `M` = 3×3 matrix with columns **a, b, c**, so that r_cart = M · r_frac.
- `B` = (M⁻¹)ᵀ, whose columns are a*, b*, c*, so that g_cart = B · (h,k,l)ᵀ.
- Metric tensor `G` = MᵀM; reciprocal metric G* = G⁻¹.
- **Direction [uvw]:** cartesian = M·uvw. **Plane normal (hkl):** cartesian = B·hkl.
- Conversions: **hkl ∥ G·uvw**, **uvw ∥ G*·hkl**. They coincide numerically in cubic cells, and for special directions elsewhere (hexagonal [110] ∥ the normal of (110), but [100] is **not** the normal of (100): it is the normal of (2 −1 0)), so a test that happens to pass for one pair proves nothing; never mix them up (this was v6 bug #4).
- Weiss zone law: (hkl) belongs to zone [uvw] ⇔ hu + kv + lw = 0, an exact integer test. More generally, hu + kv + lw = n gives Laue zone n.
- Fractional coordinates are wrapped to [0, 1) with tolerance ε = 1e-4 when stored in the asymmetric unit or expanded cell.

### 5.3 Code style
- `core/` functions are pure: inputs in, outputs out. No globals, no DOM, no Three.js.
- Long work (> 16 ms) runs in a worker. The UI stays responsive, and inputs are debounced to 150 ms.
- Every public `core/` function gets a unit test, and physics functions are tested against fixtures.
- Indices are integer arrays `[h,k,l]`. Spot or peak keys are the string `"h k l"`.
- Errors: `core/` throws typed errors (`CifParseError` and others); the UI catches them and shows a toast. Never fail silently with only `console.warn`.

### 5.4 Shared data model (in `core/crystal.ts`; extend it, don't fork it)

```ts
export interface Cell { a: number; b: number; c: number; alpha: number; beta: number; gamma: number; }

export interface Site {                 // asymmetric-unit site
  label: string;                       // "Fe1"
  element: string;                     // "Fe" (oxidation state stripped)
  oxidation?: number;                  // +3 if given (e.g. type_symbol "Fe3+")
  frac: [number, number, number];
  occupancy: number;                   // default 1
  Uiso?: number;                       // Å²; B = 8π²U
  Uaniso?: [number, number, number, number, number, number]; // U11 U22 U33 U12 U13 U23
}

export interface SymOp { R: number[][]; t: [number, number, number]; xyz: string; } // x' = R x + t

export interface Atom {                // symmetry-expanded, one unit cell, de-duplicated
  siteIndex: number;                   // → Site
  frac: [number, number, number];      // in [0,1)
}

export interface Crystal {
  id: string;                          // file name or "COD-9008565"
  title: string; formula: string;
  cell: Cell;
  spaceGroup: { hm: string; hall?: string; number?: number };
  symops: SymOp[];
  sites: Site[];
  atoms: Atom[];                       // full unit cell content
  source: { kind: 'file' | 'cod'; ref: string; rawCif: string };
  warnings: string[];
}

export interface ViewState {           // M5–M7 (serialised in session)
  range: { min: [number, number, number]; max: [number, number, number] }; // fractional
  style: 'ballStick' | 'spaceFill' | 'stick' | 'wire';
  projection: 'ortho' | 'persp';
  orientation: { quaternion: [number, number, number, number] };
  elementStyle: Record<string, { color: string; radius: number; visible: boolean }>;
  siteVisible: Record<string, boolean>;               // by site label
  bondRules: BondRule[];
  manualBonds: { add: [AtomRef, AtomRef][]; remove: [AtomRef, AtomRef][] };
  showCell: boolean; showAxes: boolean; background: string;
}
export interface BondRule { a: string; b: string; min: number; max: number; visible: boolean; color?: string; radius: number; }
export interface AtomRef { atom: number; cell: [number, number, number]; } // atom index + lattice translation
```

Diffraction settings live in `state/settings.ts`, one interface per module (`EDSettings`, `PXRDSettings`,
`DynSettings`). Each module defines its own interface and adds it to the session schema (M12).

### 5.5 Shared physics formulas
- Relativistic electron wavelength: λ = h / √(2 m₀ e E (1 + eE / 2m₀c²)). For example, 200 kV gives λ ≈ 0.025079 Å and 300 kV gives λ ≈ 0.019687 Å.
- Relativistic factor: γ = 1 + eE / m₀c².
- Debye–Waller factor: T = exp(−B s²), with B = 8π²U.
  - Anisotropic: T = exp(−2π² (hᵀ B* U B* h)) in the standard Uij convention.
- Structure factor (kinematic): F(hkl) = Σⱼ occⱼ · fⱼ(s) · Tⱼ(s) · exp(2πi (h xⱼ + k yⱼ + l zⱼ)), summed over the **de-duplicated** unit-cell atoms.
- Bragg's law: λ = 2d sinθ, and d = 1/|B·hkl|.

---

## 6. Legacy prototype v6: reuse and pitfalls

v6 is the reference prototype (`legacy/v6/main.js`, `parseCIF.js`, `performCrystallographicAnalysis.js`).
It's a CIF-to-Plotly 3D view with a live zone-axis projection of |F|², drawn with CanvasJS.

**Reuse (port, don't copy-paste):**
- `crossProduct`, `dotProduct`, `normalizeVector`, `matrixInverse3x3` → `core/math`.
- The idea of a projection basis (normal plus two in-plane vectors) → M8.
- The debounced camera-change → index update loop → M7.

**Known bugs (each needs a regression test):**
1. In `getDirectLatticeVectors`, `Math.sin(gamma)` takes degrees; it must use `gammaRad`. It only corrupts `c_y = c (cos α − cos β cos γ) / sin γ`, so it is **harmless whenever the numerator vanishes** (cubic, tetragonal, hexagonal, and monoclinic with unique axis b: M1 verified v6 gives the correct matrix for Si, NaCl, rutile, graphite and ZrO₂) and **wrong for triclinic cells** (albite: up to ~0.15 Å in the matrix). An earlier version of this file wrongly said all non-orthogonal cells were affected.
2. Symmetry expansion doesn't de-duplicate, so atoms on special positions are counted several times.
3. F uses unit weights: there's no f(s), occupancy or Debye–Waller factor.
4. The [uvw] direction and the (hkl) plane normal are confused, both in the input label and in `getMillerIndicesFromCamera`.
5. The parser takes the first `_atom_site_` loop (which may be the aniso loop), ignores quoted and multi-line values, `_atom_site_type_symbol`, occupancy and multiple data blocks, and defaults to `x,y,z` even when an H-M symbol is present.
6. There are no boundary atoms, no bonds, and Plotly marker sizes are in pixels rather than Å.
7. CanvasJS has a licensing problem.

---

## 7. Modules

Each module lists **Goal · Inputs/Outputs · Tasks · Acceptance criteria · Effort** (full-time days).

---

### M0: Foundation & tooling  *(2–3 d)*
**Goal:** a project scaffold that builds, tests and deploys.

**Tasks:**
1. Run `git init` at `strFac_app/` with a `.gitignore` (node_modules, dist, target, pkg).
2. Create `app/` with Vite + Svelte 5 + TypeScript (strict), ESLint and Prettier, Vitest and Playwright.
3. Create `kernels/`, a Rust crate with `wasm-pack` and a hello-world `#[wasm_bindgen] fn version()`, called from a worker. This proves the WASM-in-worker pipeline early.
4. Write `scripts/make_fixtures.py`. It uses pymatgen to output JSON for each fixture CIF:
   - Lattice matrix, volume, d-spacings for |h|,|k|,|l| ≤ 3, and the space-group number.
   - PXRD peaks (Cu Kα) and TEM spots for [001] and [110].
   - Fixtures: **Si, NaCl, rutile TiO₂, graphite (hexagonal), monoclinic ZrO₂, a triclinic structure (e.g., albite), and a structure with partial occupancy**.
5. Set up a GitHub Actions workflow that runs lint, tests and builds, and deploys `app/dist` to GitHub Pages.

**Accept when:** `npm run dev` shows the app shell; `npm test` passes; the WASM `version()` result shows up in the UI through a worker; fixtures are committed.

#### M0 status: ✅ done 2026-10-23

**Acceptance results (all verified, not assumed):**
- `npm run dev` shows the shell, and a real Chromium run against the dev server reads `kernel v0.1.0` through the worker with no console errors. The same holds against the production bundle (`vite preview`, Playwright e2e).
- `npm test`: 59 tests pass; `npm run test:rust`: 2 pass; `npm run lint`, `npm run format:check`, `npm run check` (svelte-check + 3 × `tsc`) are clean; `npm audit`: 0 vulnerabilities.
- The fixture tests were mutation-checked: corrupting a fixture value or a CIF byte makes them fail.
- The `core/` purity guard was checked: a throwaway file importing `three` and using `document` is rejected by both `tsc -p tsconfig.core.json` and ESLint.

**What exists now:**
- `app/`: Vite 8 + Svelte 5 + TS shell (`App.svelte` shows the pipeline check), `src/core/meta.ts` (the only `core` file so far), `src/workers/{compute.worker,client}.ts` (Comlink; exposes `wasmVersion()`, `sumF64(Float64Array)`, `cores()`), Vitest, Playwright, ESLint, Prettier.
- `kernels/`: Rust crate `kernels` 0.1.0 with `version()` and `sum_f64()`, built by `npm run build:wasm` into `app/src/wasm/` with SIMD on and `wasm-opt`. There is no `license` field because none has been chosen yet.
- `.github/workflows/ci.yml`: written and YAML-validated but **never run** (there is no remote yet; see §10). Its deploy job only runs on pushes to `main` of a repository with Pages set to "GitHub Actions".
- Git: local repository on branch `main`; commits snapshot v1–v6, move them to `legacy/`, then add M0.

**Fixtures** (`app/tests/fixtures/`; regenerate with `scripts/make_fixtures.py`, see §10). CIFs are real COD entries:

| Name | COD id | Exercises |
|---|---|---|
| `Si` | 9008565 | cubic diamond, Fd-3m **origin choice 1** (`:1`), AMCSD-style tags |
| `NaCl` | 1000041 | cubic Fm-3m, older ICSD-style tags |
| `rutile` | 9004141 | tetragonal P4₂/mnm, special positions |
| `graphite` | 9011577 | hexagonal P6₃/mmc, γ = 120°; [110] ∥ (110) normal but [100] ∦ (100) |
| `ZrO2_baddeleyite` | 9007485 | monoclinic P2₁/c, β ≠ 90° |
| `albite` | 9000525 | triclinic, declared in the centred setting `C -1`; the **only** fixture where v6's `sin(gamma)` bug changes the matrix |
| `olivine_partial` | 9006875 | orthorhombic Pbnm, Mg/Fe mixed occupancy (~0.54/0.46) |

Each `json/<name>.json` holds: `source` (COD id, CIF path, SHA-256), `cell`, `volume`, `metric` G and `recip_metric` G*, `matrix_standard` / `recip_matrix_standard` (columns = a,b,c / a*,b*,c* in the §5.2 frame), `space_group` (`declared_number`, `declared_hm`, `detected_number`, `detected_symbol`, `crystal_system`, `n_operations`), `unit_cell` (`n_sites`, `counts`, `atoms[{species:{El:occ}, frac}]`), `reflections` (`rows` of `[h,k,l,d,F2]` for |h|,|k|,|l| ≤ 3, 342 rows), `zones` (Weiss lists for [001], [110], [111]), `tem` (200 kV: λ plus ZOLZ rows `[h,k,l,d,I]` for [001] and [110]), and `pxrd` (Cu Kα, 10–90° 2θ, peaks with `two_theta`, `intensity`, `d`, `hkls[{hkl,m}]`).

**Things M0 found that later modules must know:**
1. **pymatgen's Cartesian frame is not ours.** It puts c ∥ z; §5.2 puts a ∥ x. So fixtures store frame-independent quantities (G, G*, d, F², counts) plus `matrix_standard` computed independently in numpy for the §5.2 frame. Never compare Cartesian vectors directly with pymatgen output. TEM spot *positions* were deliberately left out of the fixtures for the same reason.
2. **`F2` uses pymatgen's X-ray scattering table**, which is a 4-Gaussian electron-parameter set converted with a Mott–Bethe-type relation (`f = Z − 41.78214·s²·Σaᵢe^(−bᵢs²)`, read from pymatgen's `XRDCalculator` source). It differs from Waasmaier–Kirfel (M4) by roughly 1%, so structure-factor comparisons need a **~2% tolerance, not 1e-3**. Forbidden reflections must still be ~0 exactly. The TEM `I` column uses pymatgen's own electron factors and is normalised to its maximum over the zone; M8 should compare normalised intensities and set the tolerance after the first comparison.
3. **`detected_symbol` is always the standard setting**: albite is declared `C -1` but detected as `P-1` (same number, 2). `n_operations` counts the centring translations too (albite: 2 point ops × 2 = 4). Compare space groups by *number*.
4. **PXRD multiplicities follow pymatgen's merging**: pymatgen merges peaks at the same 2θ, and `m` counts every ± hkl member merged into that peak. Wavelength is pymatgen's `CuKa` = 1.54184 Å (the weighted Kα average), stored as `pxrd.wavelength`.
5. **`TEMCalculator` is a valid kinematic reference.** Its `zone_axis_filter` applies the Weiss law with the beam direction. For Si [110], (002) comes out as ~6e-33 (forbidden) and (1,−1,1) is the strongest spot (1.0).
6. `wavelength_rel()` confirms the §5.5 values: 200 kV → 0.0250793 Å, 300 kV → 0.0196875 Å.
7. **Line endings (Windows):** with `core.autocrlf=true`, a fresh clone used to get CRLF files, which broke the fixture SHA-256 test and Prettier's `format:check`. `.gitattributes` now pins `* text=auto eol=lf` and marks `app/tests/fixtures/**` as `-text` (never converted, because the tests hash those bytes). Found by cloning into a scratch folder and following §10; re-do that check after changing git or CI setup.
8. **Svelte/TS notes:** `tsconfig.core.json` has `types: []` and `lib: ["ES2023"]`; keep new `core/` files inside `src/core/` so the guard applies. The eslint `no-restricted-*` rules for `core/` list `three`, `svelte`, `node:*`, `render/`, `ui/` and DOM globals; extend them if `core/` ever needs another boundary.

---

### M1: Lattice & linear-algebra core  *(2–3 d)*
**Goal:** correct cell math for all seven crystal systems.

**Outputs (`core/math`, `core/lattice.ts`):**
- vec3 and mat3 operations (multiply, inverse, transpose, determinant).
- `cellToMatrix(cell) → M`, `reciprocal(M) → B`, `metric(M) → G`, `volume`.
- `dSpacing(hkl)`, `angleBetweenPlanes`, `angleBetweenDirections`.
- `uvwToHkl`, `hklToUvw`.
- `cartesianToNearestUvw(v, maxIndex)` and `cartesianToNearestHkl(v, maxIndex)`. These return the indices plus the angular deviation, by searching all integer indices up to maxIndex (not by GCD-rounding as v6 did).
- `fracToCart`, `cartToFrac`.
- Utilities `reduceIndices` (divide by the GCD) and `canonicalSign`.

**Accept when:**
- For every fixture, `cellToMatrix` matches `matrix_standard`, `reciprocal` matches `recip_matrix_standard`, and `metric`/`volume`/`dSpacing` match `metric`, `volume` and `reflections` to 1e-6, including hexagonal graphite (v6 bug 1). Do not compare Cartesian vectors against pymatgen directly (§7.M0, finding 1).
- Round trips `uvw → cart → nearestUvw` are exact for indices ≤ 6.
- In hexagonal graphite, [100] and the normal of (100) are 30° apart, [100] is parallel to the normal of (2 −1 0), and [110] **is** parallel to the normal of (110). (An earlier version of this line said [110] and (110) are not parallel; that was wrong, see the status block.)

#### M1 status: ✅ done 2026-10-23

**Acceptance results:** 148 unit tests pass (76 in `lattice.test.ts`, 13 in `math.test.ts`, 59 M0 fixture-integrity tests). For all 7 fixtures: `M`, `B`, `G`, `G*`, `volume` match the fixture to 1e-7 or better, all 342 d-spacings match, the Weiss zone lists are reproduced exactly, and every coprime triple with |index| ≤ 6 (about 1,800) round-trips through `cartesianToNearestUvw` / `cartesianToNearestHkl` with the right sign and an angular deviation below 1e-9°. Mutation checks: reintroducing v6's `sin(gamma)` bug fails only the albite tests; swapping `B` for `M` in `hklToCart`, or `G` for `G*` in `uvwToHkl`, fails 20 and 8 tests respectively.

**API (all pure; import from `core/lattice` unless noted):**
- `buildLattice(cell: Cell): Lattice` computes everything once: `{cell, M, Minv, B, G, Gstar, volume}`. **Pass the `Lattice` around**; every function below takes it first. Primitives `cellToMatrix(cell)`, `reciprocal(M)`, `metric(M)`, `volume(M)` also exist. `Cell` lives in `core/crystal.ts` (M3 extends that file).
- Coordinates: `fracToCart`, `cartToFrac`, `uvwToCart` (= M·uvw, length in Å), `hklToCart` (= B·hkl, |g| = 1/d).
- Conversions (real-valued, not normalised, not integer): `uvwToHkl` (= G·uvw), `hklToUvw` (= G*·hkl).
- Measurements: `dSpacing(lat, hkl)`, `directionLength(lat, uvw)`, `angleBetweenDirections`, `angleBetweenPlanes`, `angleDirectionToPlaneNormal(lat, uvw, hkl)` (0 = [uvw] is the normal of (hkl)), `zoneNumber(uvw, hkl)` = hu+kv+lw (exact; 0 = ZOLZ, n = n-th Laue zone).
- Live readout: `cartesianToNearestUvw(lat, v, maxIndex = 6)` / `cartesianToNearestHkl(...)` → `{indices, angleDeg}`. **Exhaustive** over coprime triples, **signed** (looking down −[100] gives [−1 0 0]; apply `canonicalSign` if sign does not matter), lowest indices win exact ties. The candidate list is cached per `Lattice` object, so repeated calls during camera rotation cost about one dot product per candidate (maxIndex 6 ≈ 1,800 candidates).
- Utilities: `reduceIndices`, `canonicalSign` (re-exported from `core/math/integers`; they never return −0), `gcd`; `core/math/{vec3,mat3,trig}` with `cosDeg`/`sinDeg` that are exact at 0/30/60/90/120/180° so cubic and hexagonal matrices contain true zeros; `core/errors.ts` with `CrystalLensError`, `LatticeError` (bad cell, zero vector), `SingularMatrixError`.
- Validation: `buildLattice` throws `LatticeError` for non-finite or non-positive lengths, angles outside (0°, 180°) and angle triples that cannot close a parallelepiped (coplanar or sum ≥ 360°).

**Things M1 found that later modules must know:**
1. **Correction to M1/M7 as originally written.** In a hexagonal cell with γ = 120°, G·[110] ∝ (1,1,0), so [110] **is** parallel to the (110) normal; the pair that differs is [100] vs (100) (30°), and [100] ∥ (2 −1 0). I had claimed the opposite from memory and verified it numerically before writing any code. M7 acceptance was corrected too. Test index conversions with [100]/(100), not [110]/(110).
2. **v6 bug 1 is narrower than stated** (see §6): wrong only for triclinic cells. Hexagonal and monoclinic-b cells were fine.
3. **`acos` is the wrong tool for angles near 0° and 180°**: one ulp of rounding in the cosine becomes ~1e-6° (this made "exactly parallel" read 8.5e-7° in a first version). `angleBetween` uses `atan2(|a×b|, a·b)`; use it, not `acos(dot/…)`, anywhere a zone-axis readout or "is it parallel?" decision is made (M7, M10).
4. **`nearest*` returns the true angular deviation** between the query and the exact direction, so M7 can implement "snap when < 2°" by comparing `angleDeg` directly.
5. `Lattice` objects are keys of the candidate cache (a `WeakMap`); create one per structure and reuse it rather than calling `buildLattice` per frame.

---

### M2: CIF parser & writer  *(5–8 d)*
**Goal:** parse more than 98% of real COD CIFs correctly.

**Tasks:**
1. `tokenizer.ts` follows the STAR/CIF 1.1 grammar (with CIF2 basics):
   - `data_`, `loop_`, tags, and unquoted, `'…'`, `"…"` and `;`-delimited text values.
   - `#` comments, and `?` / `.` for unknown or not-applicable values.
   - Values with uncertainties such as `1.234(5)`: store the value and its uncertainty.
2. `parse.ts` produces a `CifBlock[]` (tag → value, and loops as tables), then maps a block to a raw Crystal input:
   - Cell parameters.
   - Space group, from `_space_group_name_H-M_alt` or `_symmetry_space_group_name_H-M`, from `_space_group_name_Hall` or `_symmetry_space_group_name_Hall`, and from `_space_group_IT_number` or `_symmetry_Int_Tables_number`.
   - Symops, from `_space_group_symop_operation_xyz` or `_symmetry_equiv_pos_as_xyz`.
   - The `_atom_site_*` loop. Choose the loop containing `fract_x`, not the aniso loop.
   - Element from `type_symbol` first, otherwise from the label. Strip charges (`O2-` → O) and handle `D` → H.
   - Occupancy, and `U_iso_or_equiv` or `B_iso_or_equiv` (convert B to U).
   - The `_atom_site_aniso_*` loop, joined by label.
   - Title and formula.
3. **Multiple data blocks:** return them all; the UI (M14) asks the user to choose.
4. `write.ts` exports a Crystal back to a valid CIF (P1-expanded, or the asymmetric unit with symops).
5. Robustness run (as built): `scripts/fetch_cod_sample.py` downloads N random COD CIFs into the gitignored `tests/cod_sample/`; `npm run test:cod` parses them and writes `_report.txt` (failures and warnings by category); `scripts/check_cod_sample.py` cross-checks our output against pymatgen. (The original plan of a `cod_robustness.ts` script was replaced by this: Node cannot run the extension-less TS imports directly, and a vitest test is simpler.)

**Accept when:**
- Unit tests cover each grammar feature, and all fixtures parse.
- Parse → write → parse round trips to the same Crystal.
- The COD robustness run over at least 500 files passes at least 98%.

#### M2 status: ✅ done 2026-10-23

**Acceptance results:** 41 grammar/mapping tests (`cif.test.ts`) and 19 corpus tests (`cif-corpus.test.ts`). All 7 fixture CIFs parse to the cell, declared space-group number and operation count that pymatgen/spglib report, and round-trip. The 18 CIFs in `Documents/git/simulation/cifs` (ICSD exports, CrystalMaker and VESTA output, pymatgen output, hand-edited files) all parse and round-trip (run with `CRYSTALLENS_EXTRA_CIFS=<dir>`). **COD random sample: 599/600 parsed (99.83%)**, every success round-trips exactly; the one failure (COD 2217640) is a real entry whose atom loop contains only `. . .` placeholders, i.e. correctly rejected. Cross-check against pymatgen's low-level CIF reader on the same 600 files: cell, atom count, coordinates and element agree everywhere (596 files compared, 3 unreadable by pymatgen); the single disagreement (8104996, symop count) is pymatgen picking the wrong one of two symop loops. Mutation-checked: breaking the quote rule, the B to U conversion, label case handling and loop selection each fail tests. Truncation fuzzing (2,000+ cut-up real files) only ever raises `CifError`; 20,000 atoms parse in well under a second.

**API (`core/cif`, pure):**
- `parseCif(text): BlockOutcome[]` returns one `{name, structure?, error?, warnings}` per data block (M14 shows a chooser when more than one has a structure). `parseFirstStructure(text)` returns the first block that maps. Both throw `CifError` only if there is no `data_` block / no usable block.
- `CifStructure` = `{name, title?, formula?, cell: Cell, spaceGroup: {hm?, hall?, number?}, symops: string[], atoms: CifAtom[], ids: {cod?, icsd?}}`. `CifAtom` = `{label, element, isotope?, typeSymbol?, x, y, z, occupancy, uiso?, adpType?, aniso?: {U11..U23}, disorderGroup?}`. Symops are the strings as written (`'-x+1/2, y, z'`); **M3 parses them**. Nothing is expanded or de-duplicated here.
- `writeCif(structure)` writes exactly what the structure holds (full-precision numbers; quoting only where needed; no symop loop if there are none). For a P1 export M3 passes a structure whose symops are `['x, y, z']`. Parse, write, parse is exact.
- Lower layers: `tokenize`, `parseCifDocument` (blocks of items and loops), `parseNumeric('0.9344(13)') = {value, su}`, `elementFromSymbol`.
- New: `core/elements.ts` (`ELEMENT_SYMBOLS`, `isElementSymbol`, `atomicNumber`; M4 attaches the data) and `CifError` in `core/errors.ts`.

**Things M2 found that later modules must know:**
1. **Quote rule matters.** CIF 1.1 ends a quoted string only at a matching quote followed by whitespace; The hand-edited VESTA file writes `'P6/mm'm''`. The H-M string for that file reads `P6/mm'm'`, i.e. **do not trust `spaceGroup.hm` blindly in M3: fall back to the symops, and use the IT number when the H-M symbol is not recognised.**
2. **Duplicate symops occur** (the pymatgen-written SrTiO3 CIF lists each operation twice; `symops.length` is 96 for 48 distinct operations). M3 must de-duplicate operations before counting them.
3. **Some CIFs have several symop or atom loops** (e.g. COD 8104996); we take the first. Disordered structures keep `disorderGroup` and all partial occupancies; M3/M6 decide how to show them.
4. **Element detection:** `type_symbol` first (case-insensitive: `Fe3+`, `O2-`, `CU`), else the label with a lower-case-second-letter rule (`Co1` = Co, `CO1` = C, `Site1` = S as a last resort); `D`/`T` become H with `isotope`. `typeSymbol` is stored only when it differs from the element (so `Fe3+` keeps its oxidation state for M6 ionic radii). Atoms with `calc_flag dum` are dropped; unreadable atoms are skipped with a warning.
5. Uncertainties like `0.9344(13)` are parsed but dropped from the structure (coordinates are plain numbers); `-0.000` becomes `0`. B_iso and B_ij are converted to U (divide by 8 pi^2). Cartesian-only CIFs are converted assuming a || x, c* || z (the same frame as ours) and give a warning.
6. Not supported (reported, not fatal): CIF2 lists/tables/triple quotes, text-field line folding, magnetic and modulated CIFs (their extra loops are ignored).
7. The default `npm test` also runs the COD-sample and user-CIF tests when `tests/cod_sample/` or `CRYSTALLENS_EXTRA_CIFS` exist; on CI neither does, so only the fixtures run there. ICSD files are not committed (licence).

---

### M3: Symmetry & Crystal model  *(4–6 d)*
**Goal:** a correct, de-duplicated unit cell and a reliable space-group identity.

**Tasks:**
1. `symop.ts` parses `"-x+1/2, y, z+1/4"` (and forms like `x-y`, `1/2+x`, `+x`) into `{R, t}` with exact rationals. Don't use `eval` or mathjs.
2. `spacegroup.ts` (as built):
   - If the CIF has no symops, generate them from the Hall symbol, the H-M symbol or the IT number: a Hall-symbol interpreter plus a table of the 530 settings generated from spglib.
   - Detection uses `@spglib/moyo-wasm` in `src/symmetry/detect.ts` (outside `core/`).
   - Detect the space group of the expanded structure (tolerance 1e-3) and warn on mismatch.
3. `expand.ts` applies the symops, wraps to [0, 1), and **de-duplicates** using the minimum-image Cartesian distance < 0.01 Å. It records multiplicity per site and warns if two different sites coincide (e.g., disorder).
4. `crystal.ts` provides `buildCrystal(cifBlock) → Crystal`, plus a summary (formula from the expanded content, Z, density, volume).
5. Expose the point-group rotations (for M9 multiplicities) and lattice centring (for systematic-absence labelling).

**Accept when:**
- The unit-cell content matches each fixture's `unit_cell` (`n_sites`, per-element weighted `counts`, and the `atoms` list including partial occupancies): Si = 8, NaCl = 8, rutile = 6, graphite = 4, ZrO₂ = 12, albite = 52, olivine = 28 sites.
- The detected space-group **number** matches `detected_number` (compare numbers, not symbols: albite is declared `C -1` but pymatgen reports the standard `P-1`; `n_operations` includes centring, so albite = 4).
- A CIF with only an H-M symbol and no symops expands correctly.

#### M3 status: ✅ done 2026-10-24

**Acceptance results:** 48 tests in `crystal.test.ts`, the Hall-symbol test over all 530 settings, 9 detection tests, and corpus tests. For all 7 fixtures: unit-cell positions (Si 8, NaCl 8, rutile 6, graphite 4, ZrO₂ 12, albite 52, olivine 28), per-element weighted counts, the space-group number, the operation count (albite 4) and every pymatgen atom (species, occupancy, position within 0.01 Å) agree. Rebuilding each cell from the H-M symbol alone, with the CIF's operations removed, gives the same cell for every fixture except albite (see below). **COD sample: 599/599 parsed files build; the result agrees with pymatgen on positions, element counts and space-group number for 590 of 595 comparable files** (the 5 differences: pymatgen's own duplicate sites in disordered structures, and 2 files whose positions have lower symmetry than declared). Mutation-checked (no de-duplication, no wrap tolerance, no group completion, Hall shift sign, Hall default axes).

**API:**
- `core/crystal.ts`: `buildCrystal(structure: CifStructure) → {crystal, warnings}`. `Crystal = {name, title?, ids, cell, lattice, spaceGroup, ops, rotations, sites, atoms, positions, summary}`.
  - `sites`: the asymmetric-unit atoms as listed, each with `multiplicity` (number of distinct cell positions it generates), `typeSymbol` (keeps `Fe3+`), `uiso`, `aniso`.
  - `atoms`: the unit-cell content, one per element per symmetry copy, `frac` in [0, 1), `site` index back to `sites`.
  - `positions`: distinct places in the cell; more than one atom in a position is a mixed-occupancy site (Fe/Mg, Si/Al). **This is the "site" count pymatgen and the fixtures use.** M6 draws one sphere per atom (or a pie for mixed sites) at each position; M8/M9 sum over `atoms`.
  - `spaceGroup`: `{number?, symbol?, crystalSystem?, declared, order, centring[], centrosymmetric, source}`; `source` is `cif-symops`, `space-group-table` or `p1-assumed`.
  - `ops`: the full operation list (R integer, t in [0, 1)); `rotations`: distinct R (point group; M9 multiplicities); `spaceGroup.centring`: lattice centring vectors (M9/M8 absence labelling).
  - `summary`: `{counts, formula (Hill order, per formula unit), Z?, volume}`.
- `core/symmetry`: `parseSymop`/`formatSymop`/`composeOps`/`closure`/`uniqueOps` (`symop.ts`); `hallToOps` (`hall.ts`); space-group table lookups `findSpaceGroupsByHM`, `findSpaceGroupByHall`, `standardSetting`, `spaceGroupsByNumber`, `groupOrders`, `crystalSystemOf`, `pointGroupRotations`, `centringVectors` (`spacegroup.ts`); `orbit`, `PeriodicIndex`, `periodicDistance`, `wrapFrac` (`expand.ts`).
- **Outside `core/`:** `src/symmetry/detect.ts` has `loadMoyo()` and `detectSpaceGroup(crystal, symprec = 1e-3)` using `@spglib/moyo-wasm` (moyo, a Rust re-implementation of spglib; MIT/Apache). It is async and loads WASM, so it is not in `core/`. In the browser `loadMoyo()` fetches the bundled wasm; in tests pass the bytes. Returns `{number, hmSymbol, hallNumber, pearsonSymbol, nOperations, wyckoffs}`. M14 should run it in the worker after loading a CIF and show a warning when `number` differs from `crystal.spaceGroup.number`.
- `scripts/make_spacegroup_table.py` generates `core/symmetry/data/spacegroups.ts` (530 Hall settings with H-M names, from spglib) and `tests/fixtures/spacegroup_ops.json` (operation count and hash per setting).

**Things M3 found that later modules must know:**
1. **The Hall interpreter is exact:** it reproduces the operation set of all 530 spglib settings. So a CIF with no symops, but any Hall symbol, H-M symbol (with or without `:1`/`:2`/`:H` choice) or IT number, expands correctly. Without a choice suffix the symbol can be ambiguous (e.g. Fd-3m origin 1 or 2); the first setting is used and a warning says so.
2. **Declared symmetry is trusted, then checked.** Listed operations are de-duplicated (pymatgen CIFs list each operation twice), completed to a group if they are only generators (with a warning), and compared with the allowed group orders of the declared IT number. An unreadable operation falls back to the symbol. **A centred cell of a primitive group is legitimate** (albite `C -1`, 4 operations, number 2) and gives no warning; its symbol cannot be found in the table, so such a CIF needs its operations.
3. **True symmetry detection needs the WASM step.** 590 of 598 COD files have detected = declared at 1e-3 Å; the other 8 (e.g. 148 declared, 1 detected) are structures whose positions are rounded or disordered so that the declared symmetry holds only approximately. The UI should offer "use detected symmetry" rather than silently changing it.
4. **Dedupe rules:** images of one atom within 0.01 Å (minimum image) merge; different atoms at the same spot are kept as one position and warned about only if their total occupancy exceeds 1.02. Coordinates within 1e-6 of 1 wrap to 0 (never −0).
5. **Anisotropic U_ij are kept per site, not rotated onto symmetry copies.** M6 (ellipsoids, if ever) must rotate them with `ops[k].R` in the Cartesian frame.
6. **Density is not computed here** (needs atomic masses, M4): `summary` has no density; M4 adds `density(crystal)`.
7. pymatgen's own merging leaves near-duplicate sites in some disordered structures (e.g. COD 1536186), so a pymatgen site count is not an infallible reference for disordered files.

---

### M4: Scattering-factor tables  *(2–3 d)*
**Goal:** element-specific scattering for X-rays, electrons and neutrons.

**Tasks** (data as JSON in `scattering/data/`, cite each source in a header comment):
- **X-ray:** Waasmaier–Kirfel 5-Gaussian + c, including ions where available, giving f(s) for s ≤ 6 Å⁻¹. Optionally add anomalous f′ and f″ for common anodes from the Henke/Sasaki tables.
- **Electron:** the Lobato–Van Dyck (2014) parameterisation, with Peng (1996) as a fallback. **Check the argument convention** (g vs s) and units (Å).
- **Neutron:** Sears (1992) coherent scattering lengths b (fm), including isotopes for H/D.
- Also include atomic masses, covalent and van der Waals radii, and Jmol/CPK colours (used by M6).

**API:** `fx(element, s)`, `fe(element, s)`, `bn(element)`, `elementInfo(el)`.

**Accept when:** spot values match the International Tables for Crystallography (ITC) Vol. C or the original papers to within 1% at s = 0, 0.5 and 1.0, for H, C, O, Si, Fe and Au. Also confirm that the fixture `F2` values (pymatgen's table) agree with M4's X-ray factors to ~2%, which is the tolerance M8/M9 will rely on (§7.M0, finding 2).

---

### M5: 3D structure renderer  *(5–7 d)*
**Goal:** a fast, attractive 3D view of the current Crystal + ViewState.

**Tasks:**
1. Three.js scene in `render/scene.ts`:
   - Atoms as `InstancedMesh` spheres, one mesh per element, with per-instance colour.
   - Bonds as instanced cylinders, either two-colour (split at the midpoint) or a single colour.
   - Unit-cell outline (`LineSegments`) and an axes triad (a, b, c, labelled) in a corner overlay.
2. Cameras: `OrthographicCamera` by default, with a perspective toggle. Use TrackballControls (free rotation, no gimbal lock), plus pan and zoom.
3. Lighting: hemisphere light plus a directional light attached to the camera. Use MeshStandardMaterial, with an optional outline/toon mode for print.
4. Picking: hovering shows the label, element, fractional coordinates and occupancy; clicking selects. This is used by M6 (hide, add bond) and the measuring tools.
5. Measuring tools: distance (2 atoms), angle (3) and torsion (4), drawn as overlay labels.
6. Rebuild instance buffers only when the Crystal or range changes. Colour and visibility changes update attributes in place.

**Accept when:** 100,000 atoms rotate at ≥ 50 fps on an integrated GPU; picking is exact; there are no allocations per frame.

---

### M6: View range, bonds, styles & colours  *(5–7 d)*
**Goal:** the CrystalMaker-style controls for what is shown and how it looks.

**Tasks (`core/structure/` is pure; the UI is in M14 panels):**
1. **Range** (`range.ts`): fractional min/max per axis. Generate atoms for all lattice translations in range, including boundary atoms (frac within ε of an integer bound).
   - Presets: 1×1×1 cell; 2×2×2; "cell + boundary"; and a "slab" defined by an (hkl) plane and a thickness in Å.
2. **Bonds** (`bonds.ts`):
   - Cell-list neighbour search, so it scales as O(N).
   - Default rules from covalent radii: max = (r₁ + r₂) × 1.15 and min = 0.5 Å.
   - An editable rule table (add or remove pairs, min/max, visibility, colour, radius).
   - Manual add/remove bonds between picked atoms (stored as `AtomRef` pairs).
   - Options: "Search bonds beyond the range" (extend to the bonded atoms outside it) and "Complete molecules".
3. **Polyhedra** (`polyhedra.ts`): coordination polyhedra (convex hull of bonded neighbours) for chosen centre elements, with translucent faces and edges.
4. **Styles** (`styles.ts`):
   - Per-element colour (colour picker) and radius, with the radius scheme selectable (covalent, ionic, van der Waals, uniform).
   - Per-site overrides.
   - Background colour and atom-label toggles.
5. **Visibility:** show/hide per element, per site, per bond pair, plus "hide selected atoms". Use a tree-panel data model.

**Accept when:**
- The NaCl 1×1×1 view with boundary atoms shows 27 atoms.
- The Si bond count per atom is 4 inside the cell.
- Changing a colour updates in < 16 ms.
- All settings survive a session round trip (M12).

---

### M7: Orientation control  *(3–4 d)*
**Goal:** a two-way link between the mouse orientation and the crystallographic direction.

**Tasks:**
1. "View along [uvw]" and "View normal to (hkl)" inputs. Each sets the camera direction to M·uvw or B·hkl, with an optional "up" vector (default: project c, or b if c is parallel to the view).
2. Quick buttons: a, b, c, a*, b*, c*, and rotate ±90° about the view axis.
3. Live readout while rotating:
   - The nearest [uvw] and (hkl) with |index| ≤ 6, plus the angular deviation.
   - Optionally snap to the nearest zone axis when the deviation is < 2°.
4. Rotation by angle: tilt about the screen x and y axes in degree steps (like a goniometer).
5. Publish `orientation` to the store; M8, M10 and M11 subscribe with a 150 ms debounce.

**Accept when:**
- In graphite (hexagonal), "view along [100]" and "view normal to (100)" give **different** views (30° apart), while "view along [110]" and "view normal to (110)" give the **same** view; "view along [100]" equals "view normal to (2 −1 0)" (v6 bug 4 regression; see M1 status). In monoclinic ZrO₂, [100] and the (100) normal differ by β − 90° = 9.23°.
- The readout is stable (no flicker) at a zone axis.
- Typing an index and reading it back round trips.

---

### M8: Kinematic electron diffraction, indexed  *(5–7 d)*
**Goal:** replace v6's projection plot with a physically correct ED simulation.

**Settings (`EDSettings`):**
- Voltage (kV, default 200) and zone axis [uvw] (or follow the M7 view).
- Tilt (θx, θy, in mrad or °) and thickness t (Å, default 500).
- g_max (Å⁻¹), camera length (mm), and the intensity scale (linear, log, √).
- Label mode (none, low index, all) and a "show forbidden" toggle.

**Algorithm (`core/diffraction/electron.ts`, run in a worker):**
1. k₀ = 1/λ along the beam (zone axis plus tilt).
2. Enumerate all g with |g| ≤ g_max, including **all Laue zones** (not only hu + kv + lw = 0).
3. Excitation error: s_g = (k₀² − |k₀ + g|²) / (2 |k₀ + g|), or the small-angle form.
4. Intensity: I_g = |F_e(g)|² · sinc²(π t s_g), where F_e uses the electron f_e(s) from M4. Keep spots above a threshold.
5. Project onto the detector plane: basis x̂, ŷ ⊥ beam, with x̂ = projected a* (or the user's rotation).
6. Mark **kinematically forbidden** reflections (|F| ≈ 0 from symmetry or centring) separately. These can appear through double diffraction; draw them as open circles when "show forbidden" is on.

**Plot (`plots/edPlot.ts`, SVG):**
- Spot area ∝ intensity (with the selected scale) and a central-beam marker.
- hkl labels, with overlap avoidance.
- Scale bar in Å⁻¹ (and mm at the given camera length).
- Hover shows hkl, d (Å), |g|, |F|, I and s_g.
- **Measuring tool:** click two spots to get |g₁|, |g₂|, the ratio and the angle. Compare with the theoretical values to help index experimental patterns.
- Optional **experimental image overlay** (PNG/TIFF/JPG) with centre, scale and rotation handles, plus an opacity slider.

**Accept when:**
- For every fixture and for [001] and [110], the zero-order Laue zone (ZOLZ) spot **set** equals `tem.zones[axis]` exactly, and d matches to 1e-6. Compare normalised intensities against `tem.zones[axis]`'s `I` column, and set the tolerance after the first comparison (the electron-factor tables differ). Do not compare screen positions: pymatgen's in-plane frame is arbitrary (§7.M0, finding 1).
- Si [110] shows (002) as forbidden (fixture value ~6e-33) and (1,−1,1) as the strongest spot.
- Tilting by a few mrad visibly changes spot intensities.
- Recompute takes < 50 ms for g_max = 2 Å⁻¹.

---

### M9: Powder XRD  *(5–7 d)*
**Goal:** a CrystalDiffract-level powder pattern.

**Settings (`PXRDSettings`):**
- Radiation: Cu, Co, Mo, Cr, Fe or Ag Kα (Kα1 and Kα2 with their ratio), a custom λ, or **neutron** (constant wavelength).
- 2θ range and step size.
- Profile: pseudo-Voigt with Caglioti U, V, W plus mixing η, or a Scherrer crystallite size (nm) plus microstrain.
- Zero shift, monochromator angle (polarisation), preferred orientation (March–Dollase: hkl and r), and a global B override.

**Algorithm (`core/diffraction/powder.ts`, run in a worker):**
1. Enumerate hkl with d ≥ λ/2 (or the 2θ maximum).
2. **Merge symmetry equivalents** using the point-group rotations from M3, plus Friedel pairs, to get the multiplicity m. *This is the step most often done wrong; test it.*
3. F from M4 X-ray f (or neutron b), with occupancy and Debye–Waller (isotropic or anisotropic).
4. Intensity: I = m · |F|² · LP(θ) · PO. Here LP = (1 + cos²2θ · cos²2θ_m) / (sin²θ · cosθ · (1 + cos²2θ_m)).
5. Profile: FWHM² = U tan²θ + V tanθ + W, plus a Scherrer term Kλ / (L cosθ). Sum a pseudo-Voigt per peak, with Kα2 at 0.5× intensity.

**Plot (Plotly):**
- Pattern, with stick markers labelled hkl, and an axis toggle between 2θ, d and Q.
- Peak table (hkl, d, 2θ, m, |F|, I_rel), sortable and exportable.
- **Overlay experimental data** (`.xy`, `.xye`, `.csv`, `.dat`), with a scale factor and simple background subtraction (polynomial or rolling ball).
- **Multi-phase:** add several Crystals with weight fractions, scaled by I ∝ w / (ρ V²); each phase gets a colour.

**Accept when:** using the fixture's `pxrd.wavelength` (1.54184 Å, pymatgen's `CuKa`) and without Kα2 or Debye–Waller, peak positions match the fixture's `pxrd.peaks` to 0.01° 2θ, relative intensities are within 3% (different f-table), and the multiplicities are exact after merging peaks at the same 2θ the way pymatgen does (`m` = number of ± hkl members merged into the peak; §7.M0, finding 4).

---

### M10: Kikuchi lines & HOLZ (geometric)  *(4–6 d)*
**Goal:** the geometric "dynamical-looking" features. They're fast enough for live updates.

**Kikuchi map** (`kikuchi.ts`, SVG):
- For each plane (hkl) with |g| ≤ g_max and |F| above a threshold, draw a line pair (excess and deficient) perpendicular to g.
- The pair sits at ±|g|/2 from the plane trace, which passes through the projected beam position. Both lines move with tilt.
- Options: line weight ∝ |F_e|, the label at the band centre, and a field of view in mrad or Å⁻¹.
- **Tilt navigation:** drag the pattern to tilt the crystal, with the zone-axis readout synced with M7. This is the "Kikuchi map" workflow for planning TEM tilts.
- Optional overlay of the M8 spot pattern.

**HOLZ** (`holz.ts`):
- Laue-zone spacing H = 1/|r_uvw| (account for centring), and **FOLZ/SOLZ ring radii** G_n ≈ √(2nH/λ).
- Overlay the rings on the ED pattern, with the theoretical radius shown.
- **HOLZ lines in the central CBED disc:** for each HOLZ reflection g, the deficient line is the locus of incident-beam tilts satisfying |k + g| = |k|. Linearised, that's a straight line in the tilt plane. Draw these lines within the disc (convergence semi-angle α, in mrad).
- Voltage, and a "lattice-parameter strain" tweak (scale a, b, c by ±%), to show HOLZ-line sensitivity to strain.

**Accept when:**
- Kikuchi band widths equal 2θ_B for low-index planes.
- The Si [111] FOLZ radius matches the analytic value.
- The HOLZ-line pattern in Si [111] at 200 kV has the correct 3-fold symmetry. Compare against a literature figure.
- Updates take < 50 ms while dragging.

---

### M11: Dynamical diffraction (Bloch wave, WASM)  *(10–15 d)*
**Goal:** dynamical intensities that are good enough for teaching and qualitative comparison.

**Kernel (`kernels/`, Rust → WASM, SIMD on):**
- Bloch-wave method for zone-axis (or slightly tilted) incidence, with beams g selected by |g| ≤ g_max and |s_g| ≤ s_max (100–400 beams).
- Structure matrix A: diagonal 2K s_g, off-diagonal U_{g−h}. Here U_g = (γ / (π V_cell)) Σⱼ occⱼ f_e,ⱼ(s) Tⱼ(s) exp(−2πi g·rⱼ), with f_e in Å.
- Solve the **Hermitian** eigenproblem (`nalgebra` complex Hermitian eigen-decomposition).
- **Absorption:** first-order perturbation, with U′_g = κ · U_g (κ ≈ 0.05–0.1, user-settable). This avoids a non-Hermitian solver.
- Intensities: I_g(t) = |Σᵢ C₀⁽ⁱ⁾* C_g⁽ⁱ⁾ exp(2πi γ⁽ⁱ⁾ t)|², with the excitations giving exp(−2π q⁽ⁱ⁾ t) decay.
- Exports `solve(params) → eigen data` (reuse it across thicknesses) and `intensities(eigen, t[]) → Float32Array`.

**Features (UI and plots):**
1. **Dynamical spot pattern:** same display as M8, using dynamical intensities, with a thickness slider that animates in real time (re-evaluating only the exponentials).
2. **Thickness series (pendellösung):** plot I_g(t) for selected beams, 0–2000 Å.
3. **CBED:**
   - Convergence semi-angle α. Sample N×N incident directions within the disc (default 48×48, max 128×128), spread across the worker pool with a progress bar and cancellation.
   - Show the discs for 000 and the chosen g's: the central disc carries the dynamical HOLZ lines, and the outer discs show rocking curves.
   - Overlay the M10 geometric HOLZ lines for comparison.
4. **Stretch goal, likely desktop-only:** a dynamical Kikuchi/EBSD master pattern. It needs Bloch waves on a stereographic grid of 10⁴–10⁵ directions, so leave it behind the M15 trigger.

**Accept when:**
- Two-beam limit: matches the analytic pendellösung within 1%. The extinction distance is ξ_g = 1/(λ|U_g|), with U_g in Å⁻² as defined above (De Graef convention).
- Si [110] at 200 kV: the thickness-dependent (002) intensity is non-zero (from double diffraction).
- Si [110] CBED is qualitatively consistent with a published figure or JEMS output.
- Zone-axis solve (200 beams) takes < 1 s; 48×48 CBED with 150 beams takes < 20 s on an 8-core laptop.

---

### M12: Export  *(3–5 d)*
**Goal:** publication-quality output from every view.

- **PNG:**
  - 3D view: render offscreen at 1–8× scale (e.g., 4000 px wide), with a transparent-background option.
  - 2D views: rasterise the SVG at a chosen DPI.
- **SVG, true vector:**
  - **3D view:** Three.js SVGRenderer output is poor, so write our own `export/svg3d.ts`. In orthographic projection, depth-sort atoms and bonds (painter's algorithm) and draw atoms as circles with radial-gradient shading. Draw bonds as line segments (or two half-segments in two colours), clipped at the atom radii. Add the cell edges and axis labels. The output should be clean, editable vector art, like CrystalMaker's.
  - **ED, Kikuchi and CBED overlays:** already SVG; serialise with embedded fonts and styles. CBED intensity rasters are embedded as PNG `<image>` elements.
  - **PXRD:** export Plotly SVG, or our own SVG for consistent styling.
- **Data:** CSV spot list (M8/M11), CSV peak table and profile (M9), CIF (M2 writer), and XYZ/POSCAR (optional).
- **Session:** `.crystallens.json`, containing the Crystal (with the raw CIF), ViewState and every settings object, with a schema version and migration hook.
- Copy-to-clipboard (PNG) for each view.

**Accept when:**
- The SVGs open correctly in Inkscape and Illustrator, and the 3D SVG matches the screen view.
- A session reload reproduces every view exactly.

---

### M13: COD search + CORS proxy  *(3–5 d)*
**Goal:** find and load structures without leaving the app.

**Proxy (`proxy/`, Cloudflare Worker):**
- Forward GET requests only to the allow-list `https://www.crystallography.net/cod/` (`result`, `*.cif`, `optimade/v1/*`).
- Add `Access-Control-Allow-Origin` (the app origin plus localhost).
- Cache CIFs for 30 days and search results for 1 day; rate-limit by IP; set an 8 MB size cap.
- The proxy URL is configurable in settings, so users can self-host.

**Client (`io/cod.ts` + a search dialog):**
- **Search fields:**
  - Elements with "contains all" or "only these"; there's a periodic-table picker.
  - Formula, mineral or compound name, COD ID, space group, cell-volume or lattice-parameter ranges, and the number of distinct elements.
- **Backend:** COD's `result?...&format=json` (or OPTIMADE `filter=`). The results table shows ID, formula, mineral name, space group, cell, year and journal, with a 3D thumbnail on hover (optional).
- Load a result by fetching `<id>.cif` → M2 → M3.
- Cache in IndexedDB; keep a favourites list and recent searches.

**Accept when:**
- Searching "Si O, only" returns quartz polymorphs, and clicking one loads it within 2 s.
- Search still works offline for cached favourites.
- The proxy refuses non-COD URLs.

---

### M14: App shell, menus, panels, PWA  *(ongoing; initial skeleton 4–6 d)*
**Goal:** a desktop-application feel in the browser.

- **Layout:**
  - Top menu bar: File, Edit, View, Structure, Diffraction, Tools, Help.
  - Left panel with tabs: Structure tree (visibility), Style, Bonds, Range.
  - Central 3D view.
  - Right dockable panel with tabs: ED, Kikuchi/HOLZ, Dynamical, PXRD.
  - Bottom status bar: cell, space group, orientation readout and progress.
  - Panels can be resized and detached into a split view (structure and pattern side by side, as in v6).
- **Menu → command bus** (`ui/commands.ts`): every action is a named command with a keyboard shortcut and is reachable from a command palette (Ctrl/Cmd+K). This also makes a future Tauri native menu trivial.
- **Dialogs:** open CIF (with a data-block chooser), COD search, view along [uvw]/(hkl), bond rules, export, preferences (theme, default radii scheme, proxy URL, worker count).
- **Undo/redo** for view and style changes (a command history over the store).
- **PWA:** manifest and service worker, offline use after the first visit, `.cif` file handling through the `file_handlers` manifest entry (Chromium), and drag-and-drop anywhere.
- Light and dark themes, plus a crystal-structure overview card (formula, Z, density, space group and its crystal system).
- **Multiple structures:** a tabbed document interface, one Crystal per tab.

**Accept when:** every feature is reachable from the menu and command palette; the app installs as a PWA and opens a `.cif` that's double-clicked (Chromium); the layout works at 1280×720.

---

### M15: Performance audit & desktop escape hatch  *(3–5 d, plus conditional work)*

**Budgets.** The reference machine is a mid-range laptop (8 threads, integrated GPU) running Chrome:

| Operation | Budget |
|---|---|
| CIF load → first render (≤ 200 atoms/cell) | < 500 ms |
| 3D rotate, 10⁵ atoms | ≥ 50 fps |
| Range/bond recompute, 10⁴ atoms | < 150 ms |
| Kinematic ED update | < 50 ms |
| PXRD update | < 200 ms |
| Kikuchi/HOLZ drag update | < 50 ms |
| Bloch zone-axis solve (200 beams) | < 1 s |
| CBED 48×48 (150 beams) | < 20 s |

**Tasks:** add a Playwright benchmark suite that records these numbers in CI, then profile and optimise (typed arrays, `SharedArrayBuffer` with COOP/COEP headers, WASM SIMD).

**Desktop trigger:** build the Tauri v2 wrapper only if one of these is true:
- (a) CBED or dynamical features miss their budget by more than 3× after optimisation;
- (b) the stretch-goal dynamical Kikuchi master patterns are wanted;
- (c) native file-system integration becomes a hard requirement.

The wrapper reuses `app/` unchanged and calls the `kernels/` crate natively, with multi-threading through `rayon`. Expect 1–2 weeks for it.

---

## 8. Effort summary (full-time equivalent; multiply by about 2.5 for part-time)

| Block | Modules | Estimate |
|---|---|---|
| Core and correctness | M0–M4 | 3–4 weeks |
| Viewer | M5–M7 | 3–4 weeks |
| Kinematic ED and PXRD | M8, M9 | 2–3 weeks |
| Export, COD and shell | M12–M14 | 2–3 weeks |
| Kikuchi/HOLZ (geometric) | M10 | 1 week |
| Dynamical (Bloch wave, CBED) | M11 | 2–3 weeks |
| Performance and polish | M15 | 1 week, plus ongoing |
| **Total** | | **~4–5 months full-time** |

The highest-risk modules are M2 (real-world CIF variety), M3 (symmetry edge cases) and M11 (dynamical
physics conventions). Budget extra time there and test against external references.

---

## 9. External references
- International Tables for Crystallography, Vol. A (symmetry) and Vol. C (scattering factors, LP corrections).
- Waasmaier & Kirfel (1995), *Acta Cryst. A51*, 416 (X-ray f).
- Lobato & Van Dyck (2014), *Acta Cryst. A70*, 636; Peng et al. (1996), *Acta Cryst. A52*, 257 (electron f).
- Sears (1992), *Neutron News* 3, 26 (neutron b).
- De Graef, *Introduction to Conventional TEM* (2003): Bloch waves, Kikuchi, HOLZ, CBED.
- Williams & Carter, *Transmission Electron Microscopy*: ED, Kikuchi maps and HOLZ geometry.
- COD: https://www.crystallography.net/cod/ (REST `result`, `/cod/optimade/v1/`).
- Cross-check tools: pymatgen (`XRDCalculator`, `TEMCalculator`), VESTA, JEMS, abTEM, CrystalMaker/SingleCrystal.

---

## 10. Dev environment (Windows; verified during M0)

### Conda environments
| Env | Purpose | Contents |
|---|---|---|
| `crystallens` | **All app work** (npm, Vite, Rust, WASM) | Node 24.22, npm 11.19, rustc/cargo 1.99 (host `x86_64-pc-windows-msvc`), `rust-std-wasm32-unknown-unknown`, wasm-pack 0.15 |
| `s-em` | **Fixture generation only** (Python) | Python 3.11, pymatgen 2024.10.3, spglib 2.5.0, numpy 1.26 |

Created with:
`conda create -n crystallens -c conda-forge --override-channels nodejs=24 rust rust-std-wasm32-unknown-unknown wasm-pack`

Why not `s-em` for Node: it ships Node 22.9 and npm 10.8.3. Vite 8 needs Node ≥ 22.12 (it crashes on 22.9), and npm 10.8.3 fails on current dependency trees with `Cannot read properties of null (reading 'edgesOut')`. `app/package.json` declares `engines.node >= 22.12`.

### Running commands
In Git Bash (what the coding sessions use), put the env on `PATH` once per command:
```bash
E="/c/Users/cha_lab/.conda/envs/crystallens"; export PATH="$E:$E/Scripts:$E/Library/bin:$PATH"
cd /c/Users/cha_lab/Documents/git/strFac_app/app
```
In an Anaconda Prompt / PowerShell, `conda activate crystallens` does the same.

First-time setup on a fresh clone: `npm ci`, then `npm run build:wasm` (creates the gitignored `src/wasm/`), then `npx playwright install chromium` for e2e.

### npm scripts (run in `app/`)
| Script | What it does |
|---|---|
| `dev` / `build` / `preview` | Vite. `predev`/`prebuild` stop with instructions if `src/wasm/` is missing |
| `build:wasm` | `wasm-pack build ../kernels --target web --release` → `src/wasm/` (SIMD on). Re-run after editing `kernels/` |
| `check` | `svelte-check` + `tsc` for the app, `core` (no DOM), node-side configs, and tests |
| `lint` / `format` / `format:check` | ESLint (incl. the `core/` purity rules) / Prettier |
| `test` / `test:watch` | Vitest unit tests (`tests/unit/**`) |
| `test:rust` | `cargo test` for `kernels/` (native) |
| `test:e2e` | Playwright against `vite preview` of a fresh production build |

Everything above must be green before a module is considered done (CI runs the same chain).

### Regenerating fixtures
```bash
cd app
"/c/Users/cha_lab/.conda/envs/s-em/python.exe" -I scripts/make_fixtures.py          # JSON from committed CIFs
"/c/Users/cha_lab/.conda/envs/s-em/python.exe" -I scripts/make_fixtures.py --fetch  # also download missing CIFs from COD
```
`-I` keeps the working directory off `sys.path` because the CIFs are downloaded (untrusted) data. Outputs are rounded to 10 significant digits so reruns do not churn. A new fixture = one line in `FIXTURES` plus a `--fetch` run; the unit test `fixture set` then needs its expected name list updated.

### Git and remote
- `strFac_app/` is a **local** repository on branch `main` (history: snapshot of v1–v6, move to `legacy/`, M0). It has **no remote and nothing has been pushed.**
- The earlier GitHub copy of v6 lives inside the user's Pages site repo `saifsiddique/saifsiddique.github.io` (folder `strFac_app/`, branch `main`), not in a repo of its own. That repo is the whole personal website, so this project was initialised separately rather than cloned from it.
- **Open decision (user):** publish as its own repository (recommended; then enable Pages → "GitHub Actions" and `ci.yml`'s deploy job works as written, serving at `https://saifsiddique.github.io/<repo-name>/`), or copy `app/dist` into the website repo's `strFac_app/` folder (which would replace the live v6 page). Until a remote exists, `ci.yml` is untested.

### Commit conventions used so far
Local commits only; messages end with the `Co-Authored-By:` line given by the session's attribution reminder. Do not push without the user asking.
