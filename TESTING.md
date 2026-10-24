# Testing what has been built (M0 to M5)

There is no real user interface yet. What exists is the numerical core (lattice maths, CIF parser and writer, symmetry, unit-cell expansion, scattering factors, density) plus a temporary page, the **Core inspector**, for trying it by hand. The 3D viewer (M5) sits above it.

## 0. One-time setup (Git Bash)

```bash
E="/c/Users/cha_lab/.conda/envs/crystallens"; export PATH="$E:$E/Scripts:$E/Library/bin:$PATH"
cd /c/Users/cha_lab/Documents/git/strFac_app/app
npm ci                 # only needed after a fresh clone
npm run build:wasm     # builds the Rust kernel; only needed after a fresh clone or kernel changes
```

Every later command is run from `app/` with that `PATH` line active.

## 1. Automated checks

```bash
npm run format:check && npm run lint && npm run check   # style, lint, type-check: all should print no errors
npm test                                                # unit tests
npm run test:rust                                       # Rust kernel tests (2)
npm run test:e2e                                        # real Chromium: Core inspector and 3D viewer (6 tests)
npm run build                                           # production build
```

Expected: about 309 unit tests pass (about 286 without the local COD sample and your own CIF folder). One timing assertion (parsing a 20,000-atom CIF in under a second) failed once under load and did not recur in four reruns; rerun `npm test` if it is the only failure. GitHub runs the same chain on every push (Actions tab of `crystal_view`).

Extra checks against real-world files (these skip themselves when the files are absent):

```bash
# 600 random COD files (downloads about 600 CIFs, a few minutes; the folder is git-ignored)
"/c/Users/cha_lab/.conda/envs/s-em/python.exe" -I scripts/fetch_cod_sample.py 600
CRYSTALLENS_EXTRA_CIFS="C:/Users/cha_lab/Documents/git/simulation/cifs" npm run test:cod
# then read the reports in tests/cod_sample/:  _report.txt  _crystal_report.txt  _detect_report.txt
# and compare with pymatgen/spglib:
"/c/Users/cha_lab/.conda/envs/s-em/python.exe" -I scripts/check_cod_sample.py
"/c/Users/cha_lab/.conda/envs/s-em/python.exe" -I scripts/check_cod_crystal.py
```

Last results: 599/600 files parse (the one failure has no atoms), all 599 build a unit cell, and 590 of 595 match pymatgen on site count, element counts and space-group number.

## 2. Trying it by hand: the Core inspector

```bash
npm run dev            # open http://localhost:5173
```

Click **Choose file** and load a CIF. Good ones to start with are in `app/tests/fixtures/cifs/`, then your own files. For each, check these against what you know:

| File | What the page should show |
|---|---|
| `Si.cif` | Fd-3m (227), 192 operations, Z = 8, 8 atoms in 8 positions, density 2.33 g/cm³. In the d-spacing table, (111) is 3.1354 Å and strong, while (100), (110) and (200) say "0 (absent)". |
| `NaCl.cif` | Fm-3m (225), formula `Cl Na`, Z = 4, 8 atoms, density 2.165 g/cm³. |
| `graphite.cif` | P6₃/mmc (194), hexagonal, 4 atoms. In the lattice calculator, [100] against (100) gives **30°**, while [110] against (110) gives **0°** (in a hexagonal cell [110] is the normal of (110), but [100] is not the normal of (100)). |
| `ZrO2_baddeleyite.cif` | monoclinic P2₁/c (14), 12 atoms. [100] against (100): **9.23°** (that is β − 90°). |
| `albite.cif` | declared `C -1`, number 2, 4 operations, 52 atoms. Press **Detect symmetry**: it reports 2 P-1. |
| `olivine_partial.cif` | Pnma (62), 28 positions. The asymmetric unit shows Fe/Mg sites with occupancy 0.537 or 0.463. |

Things to try on any file:
- **Detect symmetry from positions** compares the symmetry found from the atom positions with the CIF's declared group. A mismatch is a warning about your file, not necessarily a bug.
- **Download P1 cell**, then load the downloaded file again. It should give the same formula and atom count, with space group 1, and **Detect symmetry** should recover the original group.
- **Lattice calculator**: enter a direction [uvw] and a plane (hkl). It shows the direction's length, d(hkl), the angle between the direction and the plane normal, and the plane whose normal is closest to the direction.
- **Scattering factors**: type `Fe3+`, `O2-`, `D` or `Au` with an s value (s = sinθ/λ = 1/2d). Expected for `C` at s = 0.5: X-ray 1.683 e, electron 0.413 Å. For `D`, the neutron length is 6.671 fm.
- A file with several `data_` blocks shows a block chooser. A broken file shows an error message instead of a blank page.

## 2a. The 3D viewer

The **Structure viewer** at the top of the page shows whatever CIF is loaded in the Core inspector below it.

- **Mouse:** drag to rotate (free trackball, no gimbal lock), wheel to zoom, right-drag to pan.
- **Style:** ball and stick, space filling (van der Waals radii, no bonds) and stick. Colours are Jmol. **Projection:** orthographic or perspective; the view keeps its size when you switch. **Cell**, **Axes** and **Toon** toggle the cell outline, the a/b/c triad in the corner and flat shading.
- **Cells a/b/c:** repeats the cell (1 to 30 per axis). 24 × 24 × 24 cells of `NaCl.cif` is about 118,000 atoms and 346,000 bonds, which is the stress test; the readout at the bottom right shows the atom and bond counts and the frame rate.
- **View along a / b / c:** looks down that lattice vector. In graphite, **c** shows the honeycomb layer.
- **Hover** an atom for its label, element, fractional coordinates (including the lattice translation) and occupancy. The atom picked is the one you see in front, also where atoms overlap.
- **Click** selects an atom (it turns gold); click it again, or empty space, to deselect. **Measure** limits the selection to 4 and shows labels: two atoms give a distance, three give the angle at the middle atom, four give the torsion. In `NaCl.cif` an Na–Cl bond should read 2.810 Å, and two neighbouring Na atoms 3.974 Å.

Things to look at, and to tell me about if wrong:

1. **Boundary atoms.** `Si.cif` at 1 × 1 × 1 should show atoms on every face and corner of the cell (the "cell with boundary" convention), not only the 8 inside.
2. **Bonds.** NaCl: Na–Cl only, 54 bonds in the closed cell. Graphite: the honeycomb, with no bonds between layers. Silicon: tetrahedral. Rutile: each Ti with six O.
3. **Hexagonal and monoclinic cells.** `graphite.cif` and `ZrO2_baddeleyite.cif` should look like their real cells (angles of 120° and about 99°), not like a cube.
4. **Your own CIFs**, especially the big supercells (`LaTe3_axial`, `ErTe3_rotation_supercell`) and the partial-occupancy files. **Partial occupancy is not drawn differently yet**: a half-occupied site looks like a full atom, and mixed sites overlap. That comes with M6.
5. **Frame rate on a laptop or integrated GPU.** I measured about 90 fps at 118,000 atoms on the RTX A4000 in this PC, but I have not measured an integrated GPU. Please try the 24 × 24 × 24 NaCl on one and tell me the number in the bottom-right corner while rotating.

## 3. Your own CIFs

Load each file in `simulation/cifs`. This is what the code currently reports for them; check it against the source (ICSD entry, VESTA, CrystalMaker) and tell me wherever it is wrong:

| File | Space group (ops) | Sites → atoms | Formula, Z | Notes |
|---|---|---|---|---|
| `1T-TaS2`, `TiSe2`, `TiSe2_pristine` | P-3m1 (12) | 2 → 3 | `S2 Ta` / `Se2 Ti`, Z = 1 | |
| `2H-TaS2` | P6₃/mmc (24) | 2 → 6 | `S2 Ta`, Z = 2 | |
| `CCPS` | Pc (2) | 20 → 40 | `Cr Cu P2 S6`, Z = 4 | density 3.15 g/cm³ matches the ICSD header |
| `CoxTaS2` | P6₃22 (12) | 6 → 24 | `Co1.74 S12 Ta6` | **warning: 2 positions with total occupancy above 1** (partly occupied Co sites that overlap; check the CIF) |
| `ErTe3`, `GdTe3`, `LaTe3` | Cmcm (16) | 4 → 16 | `Er Te3`, Z = 4 | |
| `ErTe3_noGlide` | P1 (1) | 16 → 16 | Z = 4 | |
| `ErTe3_rotation_supercell` | P1 | 64 → 64 | Z = 16 | |
| `LaTe3_axial` | P1 | 144 → 144 | Z = 36 | |
| `LaTe3_distorted` | declared `C 2 c m` (40), 4 operations listed | 60 → 232 | Z = 58 | **warning: space group 40 has 8 operations but the CIF lists 4.** The file declares C centring but lists no centring operation, so the expansion follows the operations as listed. Either the file is inconsistent or its atom list already contains the centred partners |
| `FeGe85K_edited` | P6/mmm (24), from number 191 | 10 → 50 | `Fe Ge` | The H-M string `P6/mm'm'` is not a valid symbol; the operations and number are used instead. Partly occupied Ge sites |
| `h-FeGe` | P6/mmm (24) | 3 → 6 | `Fe Ge`, Z = 3 | |
| `SrTiO3` | Pm-3m (48) | 3 → 5 | `O3 Sr Ti`, Z = 1 | the file lists every operation twice; this is handled |
| `Te_sheet` | P1 | 1 → 1 | `Te` | single atom |
| `TiSe2_distorted` | P-3c1 (12) | 4 → 24 | Z = 8 | |

Also load them in the page and press **Detect symmetry**: for the P1 supercells and the distorted structures it tells you whether they secretly have more symmetry than the file declares.

## 4. How to report a problem

Send me the CIF (or its first 40 lines), what the page showed, and what you expected. The warning list under the summary and the browser console (F12) are the most useful evidence. Anything that fails on a real file becomes a regression test.
