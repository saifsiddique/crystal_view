# Testing what has been built (M0 to M6)

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
npm run test:e2e                                        # real Chromium: Core inspector, 3D viewer and panel (25 tests)
npm run build                                           # production build
```

Expected: about 365 unit tests pass with the local COD sample, fewer without it (the COD-sample and own-CIF tests skip themselves when those files are absent). One timing assertion (parsing a 20,000-atom CIF in under a second) failed once under load and did not recur in four reruns; rerun `npm test` if it is the only failure. GitHub runs the same chain on every push (Actions tab of `crystal_view`).

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
| `Si.cif` | *Fd*3̄*m* (No. 227), 192 operations, Z = 8, 8 atoms in 8 positions, density 2.33 g/cm³. Lattice vectors: cubic. In the d-spacing table, (111) is 3.1354 Å at 2θ = 28.44° (Cu Kα₁) and strong, while (100), (110) and (200) say "0 (absent)". |
| `NaCl.cif` | Fm-3m (225), formula `Cl Na`, Z = 4, 8 atoms, density 2.165 g/cm³. |
| `graphite.cif` | P6₃/mmc (194), hexagonal, 4 atoms. In the lattice calculator, [100] against (100) gives **30°**, while [110] against (110) gives **0°** (in a hexagonal cell [110] is the normal of (110), but [100] is not the normal of (100)). |
| `ZrO2_baddeleyite.cif` | monoclinic P2₁/c (14), 12 atoms. [100] against (100): **9.23°** (that is β − 90°). |
| `albite.cif` | declared `C -1`, number 2, 4 operations, 52 atoms. Press **Detect symmetry**: it reports 2 P-1. |
| `olivine_partial.cif` | Pnma (62), 28 positions. The asymmetric unit shows Fe/Mg sites with occupancy 0.537 or 0.463. |

Things to try on any file:
- **Detect symmetry from positions** compares the symmetry found from the atom positions with the CIF's declared group. A mismatch is a warning about your file, not necessarily a bug.
- **Download P1 cell**, then load the downloaded file again. It should give the same formula and atom count, with space group 1, and **Detect symmetry** should recover the original group.
- **Lattice calculator**: enter a direction [uvw] and a plane (hkl). It shows the direction's length, d(hkl), the angle between the direction and the plane normal, and the plane whose normal is closest to the direction.
- **Space group** is typeset: italic letters, screw axes with subscripts (*P*6₃/*mmc*), rotoinversions with a bar (*Fm*3̄*m*). The **Declared** line under it is the CIF's text as written.
- **Lattice vectors** (under the summary): the equations that turn a, b, c, α, β, γ into Cartesian vectors for this crystal's family, the resulting numbers, and a link to the AFLOW page for the family. The convention is a along x and b in the xy-plane. Trigonal crystals show hexagonal or rhombohedral axes depending on the setting. Monoclinic ones show unique axis a, b or c, depending on which angle is not 90°. A unit test checks that each set of equations reproduces the matrix the program uses for every fixture.
- **Radiation** above the d-spacing table: Cu Kα₁ (1.5406 Å) by default, with Mo, Co, Fe, Cr and Ag Kα₁. The table has a 2θ column for it.
- **Scattering factors**: type `Fe3+`, `O2-`, `D` or `Au`. The angle is entered as 2θ with Cu Kα₁ by default, or switch to s = sinθ/λ. The line under the inputs shows the resulting s and d. Expected for `C` at s = 0.5 (switch to s): X-ray 1.683 e, electron 0.413 Å. For `D`, the neutron length is 6.671 fm.
- A file with several `data_` blocks shows a block chooser. A broken file shows an error message instead of a blank page.

## 2a. The 3D viewer

The **Structure viewer** at the top of the page shows whatever CIF is loaded in the Core inspector below it.

- **Mouse:** drag to rotate (free trackball, no gimbal lock), wheel to zoom, right-drag to pan.
- **Style:** ball and stick, space filling (van der Waals radii, no bonds) and stick. Colours are Jmol. **Projection:** orthographic or perspective; the view keeps its size when you switch. **Cell**, **Axes** and **Toon** toggle the cell outline, the a/b/c triad in the corner and flat shading.
- **Bonds** (toolbar checkbox): untick it and no bond is drawn at all (the bonds still exist, and the count in the readout stays). Space filling never draws them.
- **Reset view / Reset zoom / Reset range** (toolbar): *Reset view* goes back to the default orientation and recentres, and the zoom stays as it is; *Reset zoom* returns the magnification to "whole structure fits", and the orientation and pan stay; *Reset range* returns to one cell with its boundary atoms and no slab.
- **Range** (panel, see section 2b) replaces the old "Cells a/b/c" boxes: set the *to* value of a, b and c to 24 for the stress test, 24 × 24 × 24 cells of `NaCl.cif`, about 118,000 atoms and 346,000 bonds. Your orientation, pan and zoom are kept when you change the range; loading a different crystal resets the view. The readout at the bottom right shows the atom and bond counts and the number of frames actually drawn per second. It reads **idle** when nothing is moving, because nothing is redrawn then.
- **View along a / b / c:** looks down that lattice vector. In graphite, **c** shows the honeycomb layer.
- **Hover** an atom for its label, element, fractional coordinates (including the lattice translation) and occupancy. The atom picked is the one you see in front, also where atoms overlap.
- **Click** selects an atom (it turns gold); click it again, or empty space, to deselect. **Measure** limits the selection to 4 and shows labels: two atoms give a distance, three give the angle at the middle atom, four give the torsion. In `NaCl.cif` an Na–Cl bond should read 2.810 Å, and two neighbouring Na atoms 3.974 Å.

Things to look at, and to tell me about if wrong:

1. **Boundary atoms.** `Si.cif` at 1 × 1 × 1 should show atoms on every face and corner of the cell (the "cell with boundary" convention), not only the 8 inside.
2. **Bonds.** NaCl: Na–Cl only, 54 bonds in the closed cell. Graphite: the honeycomb, with no bonds between layers. Silicon: tetrahedral. Rutile: each Ti with six O.
3. **Hexagonal and monoclinic cells.** `graphite.cif` and `ZrO2_baddeleyite.cif` should look like their real cells (angles of 120° and about 99°), not like a cube.
4. **Your own CIFs**, especially the big supercells (`LaTe3_axial`, `ErTe3_rotation_supercell`) and the partial-occupancy files. **Partial occupancy is not drawn differently yet** (not in M6 either): a half-occupied site looks like a full atom, and mixed sites overlap.
5. **Frame rate on a laptop or integrated GPU.** I measured about 90 fps at 118,000 atoms on the RTX A4000 in this PC, but I have not measured an integrated GPU. Please try the 24 × 24 × 24 NaCl on one and tell me the number in the bottom-right corner *while rotating*. Before 2026-10-26 that number counted animation ticks, not drawn frames, so it always said 60.

## 2b. The viewer panel (range, bonds, polyhedra, appearance, visibility)

To the right of the view. Each section opens and closes.

**Range**
- Buttons: **1 cell** (the 8 atoms inside, no boundary duplicates), **1 cell + boundary** (the default; 27 atoms for NaCl) and **2×2×2** (125 for NaCl). Or type any *from* and *to* per axis (negative and fractional values work). **Include boundary atoms** switches the upper bound between inclusive and exclusive.
- **Slab**: tick it, give a plane (hkl), where it starts (Å, measured from the plane through the origin) and its thickness. It cuts the box above, so the box sets how far it extends sideways. NaCl, box 0 to 1, slab (001) of thickness 1 Å: 9 atoms (the z = 0 layer); starting at 2.5 Å: 9 atoms (the z = a/2 layer).

**Bonds**
- **Search bonds beyond the range** shows the atoms just outside the range that are bonded to atoms inside it (they say "outside the range (bonded)" in the tooltip), so no atom at the edge has missing bonds. NaCl, *1 cell*: 8 atoms become 32 with 36 bonds.
- **Complete molecules** keeps adding bonded atoms until each molecule is whole. A framework like NaCl never closes, and you get a note saying so. A molecular crystal (any CIF with discrete molecules; try your `CCPS` and organic files) should show whole molecules across the cell edge.
- **Rule table**: one row per element pair that bonds (NaCl starts with Cl–Na only). Edit the minimum and maximum distance in Å, the stick radius, the colour (the *auto* button goes back to colouring each half by its atom) and whether the pair is shown; **×** deletes the rule. **Add pair** adds any two of the crystal's elements, with the covalent-radius default; **Reset rules** goes back to the defaults. *Metal-metal pairs are left out by default in compounds with O, S, Cl and so on* (Ti–Ti in rutile); add them back here if you want them.
- **Draw bond / Delete that bond**: click exactly two atoms (without Measure) and press the button. A drawn bond is a plain stick with the default radius; deleting an automatic bond keeps it deleted even when you change the range.

**Polyhedra**: tick the elements at the centres (e.g. Ti in rutile). They are drawn translucent with edges, coloured like the centre atom. A polyhedron appears only when all of its atom's bonded neighbours are shown, so with a small range, tick *Search bonds beyond the range*. The line under the checkboxes says how many were drawn and how many skipped. Bonds you hide still define the polyhedra, so you can show polyhedra without sticks.

**Appearance**: radii (automatic = covalent for ball-and-stick and van der Waals for space filling; covalent; ionic from oxidation states in the CIF's type symbols such as `Fe3+`, falling back to covalent; van der Waals; uniform), a scale slider, the background colour and atom labels (element or site label, up to 4,000 atoms).

**Elements, sites and visibility**: per element and per site, a show checkbox, a colour and a radius in Å (empty means automatic). **↺** forgets the element's and its sites' overrides. **Hide N selected** hides the atoms you clicked (individual atoms, not the site), **Show N hidden** brings them back. Hiding an element or site also hides the bonds to it.

Things to check:
1. NaCl: the three range buttons give 8, 27 and 125 atoms; Reset range returns to 27.
2. Silicon, 3 × 3 × 3 cells: hover an atom in the middle; it should have four bonds (look at the sticks).
3. Rutile, range 0 to 2 in a and b, beyond the range ticked, Ti polyhedra: octahedra of six oxygens around each Ti, with no Ti–Ti sticks.
4. A colour change (click the swatch beside an element, move around in the picker) should follow at once. On the 118,000-atom structure it takes about 20 ms per change, so it should still feel immediate.
5. Your own structures: read the bond rules the table starts with. If an expected bond is missing or an unexpected one is drawn, the rule limits are the thing to change, and I want to know which pair and what distance in the CIF.

## 2c. Orientation (M7)

With a structure loaded, the row under the toolbar controls the view direction.

1. Type `1 1 0` in **View along [ ]** and press Go. The readout reads `Looking along [1 1 0] (0.00° off)`.
2. Load graphite. **View along [1 0 0]**, then **View normal to (1 0 0)**: the picture turns by 30°. **View normal to (2 -1 0)** gives the [1 0 0] view again; [1 1 0] and the (1 1 0) normal are the same view.
3. Drag with the mouse and watch the readout follow. It should not flicker between two axes when you stop near the middle of them.
4. Click the viewer (a blue outline appears) and press the arrow keys: each press tilts by the step (5° by default). Shift gives 1°, Ctrl gives 15°, Alt+Left/Right rolls. The ◀ ▶ ▲ ▼ buttons do the same; ⟲ 90° and ⟳ 90° turn the picture about the line of sight.
5. Press **Snap to zone axis** (it says on/off). Rotate with the mouse and let go within 2° of a low-index axis (index up to 3): the view jumps onto it exactly. It never acts while the button is off, and not on the arrow keys.
6. Right-drag: the structure should follow the pointer.
7. The page now uses the whole window width.

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
