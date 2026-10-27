<script lang="ts">
  // Electron-diffraction tab (context.md M8): a simplified structure view on the left (rotate,
  // zoom, pan, range) and, in the middle, the kinematic pattern for the beam along its line of
  // sight; the beam, pattern and Kikuchi settings are in the sidebar on the right. The pattern follows the view on every drawn frame; typing a zone axis turns both.
  // "Calculate dynamical diffraction" (M11) replaces the intensities by Bloch-wave ones for the
  // current orientation; the orientation is then locked (moving asks first and goes back to
  // kinematic), while the thickness re-evaluates the dynamical intensities live.
  import { onMount, untrack } from 'svelte';
  import type { Crystal } from '../core/crystal';
  import {
    beamIntensities,
    blochProblem,
    dynamicalPattern,
    type BlochProblem,
    type BlochSolution,
  } from '../core/diffraction/dynamical';
  import {
    electronWavelength,
    kinematicPattern,
    type Pattern,
    type Thermal,
  } from '../core/diffraction/electron';
  import {
    discRadius,
    holzLines,
    kikuchiBands,
    laueRings,
    defaultKikuchiParams,
    type HolzLine,
    type KikuchiBand,
    type LaueRing,
  } from '../core/diffraction/kikuchi';
  import { uvwToCart } from '../core/lattice';
  import { angleBetween, type Vec3 } from '../core/math/vec3';
  import {
    defaultUp,
    directionNormalToHkl,
    readOrientation,
    rotateView,
    type ReadoutMemory,
  } from '../core/orientation';
  import {
    buildModel,
    presetRange,
    resolveAppearance,
    type RangePreset,
    type ViewSettings,
  } from '../core/structure';
  import { downloadText, safeName, svgSize } from '../export/browser';
  import { spotsToCsv } from '../export/csv';
  import { structureImageRows, svgImageRows, type ExportSection } from '../export/rows';
  import { StructureView } from '../render/structureView';
  import {
    defaultEDSettings,
    MAX_ABSORPTION,
    MAX_DYN_BEAMS,
    type EDSettings,
  } from '../state/settings';
  import EDPanel, { ED_TABS, type EDTab } from './EDPanel.svelte';
  import EDPattern, { type Overlay, type PatternView } from './EDPattern.svelte';
  import ExportMenu from './ExportMenu.svelte';
  import Logo from './Logo.svelte';
  import SidePanel from './SidePanel.svelte';
  import { orientation } from './orientation.svelte';
  import { getCompute } from '../workers/client';

  let {
    crystal,
    viewSettings,
    fileName = '',
  }: {
    crystal: Crystal | null;
    /** Name of the loaded file: the stem of the exported files' names. */
    fileName?: string;
    /** The Structure Viewer's settings: colours, sizes, bond rules and display toggles are shared. */
    viewSettings: ViewSettings;
  } = $props();

  let settings = $state<EDSettings>(defaultEDSettings());
  let stage = $state<HTMLDivElement>();
  let canvas: HTMLCanvasElement;
  let view: StructureView | null = null;
  let ready = $state(false);
  let error = $state('');

  let pattern = $state.raw<Pattern | null>(null);
  let computeMs = $state(0);
  let patternView = $state<PatternView>({ cx: 0, cy: 0, half: 2 * 1.08 });
  let patternPanel = $state<ReturnType<typeof EDPattern>>();
  let measuring = $state(false);
  let selected = $state<string[]>([]);

  const lambda = $derived.by(() => {
    try {
      return electronWavelength(settings.voltage);
    } catch {
      return NaN;
    }
  });
  const fmt = (x: number, d = 4) => x.toFixed(d);

  // Debye-Waller factor: off, the CIF's own values, or one B typed by the user (in the sidebar).
  const thermal = $derived<Thermal>(settings.debyeWaller ? (settings.debyeWallerB ?? true) : false);

  // ---- orientation of the left view ---------------------------------------------------------------

  /** Line of sight and screen-up of the last drawn frame. */
  let frame = $state.raw<{ direction: Vec3; up: Vec3 } | null>(null);
  const memory: ReadoutMemory = {};
  let readLattice: unknown = null;
  /** The zone axis typed last (it may have indices above READ_INDEX). */
  let typedAxis: Vec3 | null = null;
  /**
   * Laue zones are counted from the nearest zone axis with indices up to this (or the typed axis,
   * when that is nearer). With index 6, a crystal tilted a few degrees off [001] would be "on"
   * [-1 0 6], whose zero-order zone holds almost none of the spots a microscope would show.
   */
  const READ_INDEX = 3;

  const reading = $derived.by(() => {
    if (!frame || !crystal) return null;
    const lat = crystal.lattice;
    if (lat !== readLattice) {
      delete memory.uvw;
      delete memory.hkl;
      readLattice = lat;
    }
    const near = readOrientation(lat, frame.direction, memory, READ_INDEX).uvw;
    if (typedAxis) {
      const angleDeg = angleBetween(frame.direction, uvwToCart(lat, typedAxis));
      if (angleDeg <= near.angleDeg) return { indices: typedAxis, angleDeg };
    }
    return near;
  });

  function onRendered() {
    if (!view || !crystal) return;
    const s = view.viewState();
    const f = frame;
    if (
      f &&
      Math.abs(f.direction[0] - s.direction[0]) +
        Math.abs(f.direction[1] - s.direction[1]) +
        Math.abs(f.direction[2] - s.direction[2]) +
        Math.abs(f.up[0] - s.up[0]) +
        Math.abs(f.up[1] - s.up[1]) +
        Math.abs(f.up[2] - s.up[2]) <
        1e-12
    )
      return;
    frame = { direction: s.direction, up: s.up };
  }

  // ---- the pattern: recomputed when the frame or any setting changes -----------------------------

  /** |g| out to which spots are computed: the farthest corner of the pattern panel. */
  const reach = $derived(
    Math.min(
      8,
      Math.hypot(
        Math.abs(patternView.cx) + patternView.half,
        Math.abs(patternView.cy) + patternView.half,
      ),
    ),
  );

  $effect(() => {
    const c = crystal;
    const f = frame;
    const zone = reading?.indices;
    const g = {
      voltage: settings.voltage,
      thickness: settings.thickness,
      profile: settings.profile,
      debyeWaller: thermal,
      maxZone: settings.maxZone,
      includeForbidden: settings.showForbidden,
      gMax: reach,
      // well below the faintest drawable spot (relative 1e-4 at exposure 1)
      minIntensity: Math.max(1e-10, 1e-5 / settings.exposure),
    };
    if (!c || !f || !zone) {
      pattern = null;
      return;
    }
    untrack(() => {
      try {
        const t0 = performance.now();
        pattern = kinematicPattern(c, {
          direction: f.direction,
          up: f.up,
          zoneAxis: zone,
          ...g,
        });
        computeMs = performance.now() - t0;
        error = '';
      } catch (e) {
        pattern = null;
        error = e instanceof Error ? e.message : String(e);
      }
    });
  });

  // ---- Kikuchi bands, HOLZ rings and lines (M10): cheap geometry on top of the pattern -----------

  const strain = $derived(
    settings.strain.map((p) => (Number.isFinite(p) ? p / 100 : 0)) as [number, number, number],
  );
  const alphaRad = $derived(
    Number.isFinite(settings.alpha) && settings.alpha > 0 ? settings.alpha / 1000 : 0,
  );

  let overlayMs = $state(0);
  let overlay = $state.raw<Overlay>({ bands: [], rings: [], holz: [], disc: null });

  $effect(() => {
    const c = crystal;
    const p = pattern;
    const wantK = settings.kikuchi;
    const nBands = settings.kikuchiBands;
    const wantR = settings.holzRings;
    const wantC = settings.cbed;
    const common = {
      voltage: settings.voltage,
      debyeWaller: thermal,
      strain,
    };
    const alpha = alphaRad;
    const offset = Math.min(
      12,
      1.5 * Math.hypot(Math.abs(patternView.cx), Math.abs(patternView.cy)) + 3 * patternView.half,
    );
    if (!c || !p || !(wantK || wantR || wantC)) {
      overlay = { bands: [], rings: [], holz: [], disc: null };
      overlayMs = 0;
      return;
    }
    untrack(() => {
      try {
        const t0 = performance.now();
        const frame = { beam: p.beam, right: p.right, up: p.up };
        let bands: KikuchiBand[] = [];
        let rings: LaueRing[] = [];
        let holz: HolzLine[] = [];
        if (wantK)
          bands = kikuchiBands(c, frame, {
            ...defaultKikuchiParams(),
            ...common,
            maxOffset: offset,
            maxBands: Number.isInteger(nBands) && nBands > 0 ? nBands : 20,
            minIntensity: 5e-3,
          });
        if (wantR) rings = laueRings(c, frame, { ...common, zoneAxis: p.zoneAxis, nMax: 3 });
        if (wantC && alpha > 0)
          holz = holzLines(c, frame, {
            ...common,
            zoneAxis: p.zoneAxis,
            alpha,
            maxZone: 2,
            minIntensity: 3e-4,
          });
        overlay = {
          bands,
          rings,
          holz,
          disc: wantC && alpha > 0 ? discRadius(alpha, settings.voltage) : null,
        };
        overlayMs = performance.now() - t0;
      } catch (e) {
        overlay = { bands: [], rings: [], holz: [], disc: null };
        error = e instanceof Error ? e.message : String(e);
      }
    });
  });

  // ---- dynamical intensities (M11): solved on request for the current orientation -----------------

  interface DynamicResult {
    crystal: Crystal;
    /** `dynKey` and the frame the solve was made for: if either changes, the result is stale. */
    key: string;
    frame: { direction: Vec3; up: Vec3 };
    problem: BlochProblem;
    solution: BlochSolution;
    ms: number;
  }

  let dynamic = $state.raw<DynamicResult | null>(null);
  /** Beams of the solve that is running, or null. */
  let solving = $state<number | null>(null);
  let solveTicket = 0;
  /** Why the dynamical pattern was dropped or not shown (cleared by the next calculation). */
  let dynNote = $state('');
  /** The "moving switches back to kinematic" question, and what to do on "switch". */
  let warning = $state(false);
  let pendingMove: (() => void) | null = null;
  let switchButton = $state<HTMLButtonElement>();

  /** Everything except the orientation and the thickness that the Bloch-wave solution depends on. */
  const dynKey = $derived(
    JSON.stringify([
      settings.voltage,
      thermal,
      settings.maxZone,
      settings.dynBeams,
      settings.absorption,
    ]),
  );

  type Frame = { direction: Vec3; up: Vec3 } | null;
  const sameFrame = (a: Frame, b: Frame) =>
    !!a &&
    !!b &&
    [0, 1, 2].every(
      (i) => Math.abs(a.direction[i] - b.direction[i]) < 1e-9 && Math.abs(a.up[i] - b.up[i]) < 1e-9,
    );

  // A stale solution is dropped: another crystal, a changed setting, or a frame that moved anyway.
  $effect(() => {
    const d = dynamic;
    if (!d) return;
    if (d.crystal !== crystal || d.key !== dynKey) {
      dynamic = null;
      dynNote =
        'A setting changed, so the kinematic pattern is back. Calculate again to update it.';
    } else if (!sameFrame(d.frame, frame)) {
      dynamic = null;
      dynNote = 'The crystal moved, so the kinematic pattern is back.';
    }
  });

  /** The dynamical pattern at the current thickness (exponentials only: instant). */
  const dynView = $derived(
    dynamic
      ? dynamicalPattern(dynamic.problem, beamIntensities(dynamic.solution, settings.thickness))
      : null,
  );
  const shownPattern = $derived(dynView ? dynView.pattern : pattern);

  const beamsValid = $derived(
    Number.isInteger(settings.dynBeams) &&
      settings.dynBeams >= 2 &&
      settings.dynBeams <= MAX_DYN_BEAMS &&
      Number.isFinite(settings.absorption) &&
      settings.absorption >= 0 &&
      settings.absorption <= MAX_ABSORPTION,
  );

  async function calculateDynamical() {
    const c = crystal;
    const f = frame;
    const zone = reading?.indices;
    if (!c || !f || !zone || solving !== null || !beamsValid) return;
    const key = dynKey;
    dynNote = '';
    let problem: BlochProblem;
    try {
      problem = blochProblem(c, {
        direction: f.direction,
        up: f.up,
        zoneAxis: zone,
        voltage: settings.voltage,
        debyeWaller: thermal,
        maxZone: settings.maxZone,
        beams: settings.dynBeams,
        absorption: settings.absorption,
      });
    } catch (e) {
      dynNote = e instanceof Error ? e.message : String(e);
      return;
    }
    const ticket = ++solveTicket;
    solving = problem.n;
    const t0 = performance.now();
    try {
      const { n, K, aRe, aIm, pRe, pIm } = problem;
      const solution = await getCompute().bloch({ n, K, aRe, aIm, pRe, pIm });
      if (ticket !== solveTicket) return;
      if (crystal !== c || dynKey !== key || !sameFrame(frame, f)) {
        dynNote =
          'The crystal or a setting changed during the calculation; its result was dropped.';
        return;
      }
      dynamic = { crystal: c, key, frame: f, problem, solution, ms: performance.now() - t0 };
    } catch (e) {
      if (ticket === solveTicket)
        dynNote = `The dynamical calculation failed: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      if (ticket === solveTicket) solving = null;
    }
  }

  function backToKinematic() {
    dynamic = null;
    dynNote = '';
  }

  /**
   * Every orientation change goes through here. With a dynamical pattern shown it asks first;
   * "Switch to kinematic" then drops the dynamical intensities and makes the move. (A drag that was
   * stopped is not replayed: the next drag moves.)
   */
  function guardMove(move: (() => void) | null) {
    if (!dynamic) {
      move?.();
      return;
    }
    pendingMove = move;
    if (!warning) {
      warning = true;
      queueMicrotask(() => switchButton?.focus());
    }
  }

  function confirmMove() {
    warning = false;
    dynamic = null;
    dynNote = '';
    const move = pendingMove;
    pendingMove = null;
    move?.();
  }

  function cancelMove() {
    warning = false;
    pendingMove = null;
    stage?.focus({ preventScroll: true });
  }

  /** Left button (rotate) on the structure while locked: stop the trackball, ask instead. */
  function onStagePointerCapture(e: PointerEvent) {
    if (!dynamic || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    guardMove(null);
  }

  // ---- the structure on the left ------------------------------------------------------------------

  onMount(() => {
    view = new StructureView(canvas, { onRender: onRendered });
    view.setPicking(false);
    view.setProjection('ortho');
    const observer = new ResizeObserver(() => {
      view?.resize();
      view?.requestRender();
    });
    observer.observe(stage!);
    (window as unknown as Record<string, unknown>).__crystallensED = {
      viewState: () => view!.viewState(),
      pattern: () =>
        pattern && {
          count: pattern.spots.length,
          zoneAxis: pattern.zoneAxis,
          lambda: pattern.lambda,
          spots: pattern.spots.map((s) => ({
            hkl: s.hkl,
            I: s.I,
            x: s.x,
            y: s.y,
            zone: s.zone,
            forbidden: s.forbidden,
          })),
        },
      reading: () => reading && { indices: [...reading.indices], angleDeg: reading.angleDeg },
      overlay: () => ({
        bands: overlay.bands.length,
        rings: overlay.rings.map((r) => ({
          n: r.n,
          radius: r.radius,
          cx: r.cx,
          cy: r.cy,
          allowed: r.allowed,
        })),
        holz: overlay.holz.length,
        disc: overlay.disc,
        ms: overlayMs,
      }),
      computeMs: () => computeMs,
      drawn: () => patternPanel?.drawnCount() ?? 0,
      labels: () => patternPanel?.labelCount() ?? 0,
      spotClient: (key: string) => patternPanel?.spotClient(key) ?? null,
      pxPerInvA: () => patternPanel?.pxPerInvA() ?? 0,
      measurement: () => patternPanel?.measurement() ?? null,
      renders: () => view!.stats.renders,
      dynamic: () => ({
        solving,
        shown: dynView !== null,
        warning,
        note: dynNote,
        beams: dynamic?.problem.n ?? 0,
        ms: dynamic?.ms ?? 0,
        transmitted: dynView?.transmitted ?? null,
        total: dynView?.total ?? null,
        spots:
          dynView?.pattern.spots.map((s) => ({
            hkl: s.hkl,
            I: s.I,
            fraction: s.fraction ?? 0,
            kinematicallyForbidden: s.kinematicallyForbidden ?? false,
          })) ?? [],
      }),
    };
    ready = true;
    return () => {
      observer.disconnect();
      view?.dispose();
      view = null;
    };
  });

  /** Look along [uvw] with the default up direction. */
  function lookAlongUvw(uvw: Vec3) {
    if (!crystal || !view) return;
    const d = uvwToCart(crystal.lattice, uvw);
    typedAxis = uvw;
    view.lookAlong(d, defaultUp(crystal.lattice, d));
  }

  // A new crystal: fresh range and the default zone axis.
  let shownCrystal: Crystal | null = null;
  $effect(() => {
    const c = crystal;
    untrack(() => {
      if (c === shownCrystal) return;
      shownCrystal = c;
      settings.range = defaultEDSettings().range;
      settings.zoneAxis = [0, 0, 1];
      uvwInput = ['0', '0', '1'];
      selected = [];
      frame = null;
      typedAxis = null;
      patternPanel?.fit();
    });
  });

  const geometryKey = $derived(
    JSON.stringify([settings.range, viewSettings.bonds.rules.map((r) => [r.a, r.b, r.min, r.max])]),
  );
  let builtFor: { crystal: Crystal | null; key: string } | null = null;
  let model = $state.raw<ReturnType<typeof buildModel> | null>(null);

  $effect(() => {
    if (!ready || !view) return;
    const c = crystal;
    const key = geometryKey;
    if (builtFor && builtFor.crystal === c && builtFor.key === key) return;
    const keepView = builtFor?.crystal === c && c !== null;
    builtFor = { crystal: c, key };
    untrack(() => {
      if (!c) {
        model = null;
        return;
      }
      try {
        const r = $state.snapshot(settings.range);
        const m = buildModel(c, {
          range: r,
          boundary: r.boundary,
          bonds: { rules: $state.snapshot(viewSettings.bonds.rules) },
        });
        model = m;
        view!.setStructure(m, c.lattice, keepView);
        if (!keepView) lookAlongUvw(settings.zoneAxis);
        error = '';
      } catch (e) {
        model = null;
        error = e instanceof Error ? e.message : String(e);
      }
    });
  });

  // Appearance follows the Structure Viewer (style, colours, radii, bonds, background).
  $effect(() => {
    if (!ready || !view) return;
    const m = model;
    const c = crystal;
    const vs = $state.snapshot(viewSettings);
    if (!m || !c) return;
    untrack(() => {
      const app = resolveAppearance(c, m, vs.appearance, vs.bonds.rules, vs.hiddenAtoms);
      view!.setAppearance(app, true);
      view!.setBondsDrawn(vs.appearance.bondsVisible && vs.appearance.displayStyle !== 'spaceFill');
      view!.setShowCell(vs.showCell);
      view!.setShowAxes(vs.showAxes);
      view!.setToon(vs.toon);
      view!.requestRender();
    });
  });

  // ---- controls -------------------------------------------------------------------------------------

  let uvwInput = $state<[string, string, string]>(['0', '0', '1']);
  const uvwValue = $derived.by((): Vec3 | null => {
    const v = uvwInput.map((x) => Number(x.trim() === '' ? NaN : x));
    return v.every(Number.isInteger) && v.some((x) => x !== 0) ? [v[0], v[1], v[2]] : null;
  });

  function goToZone() {
    const uvw = uvwValue;
    if (!uvw) return;
    guardMove(() => {
      settings.zoneAxis = uvw;
      lookAlongUvw(uvw);
    });
  }

  function fromStructureViewer() {
    if (!view || !orientation.ready) return;
    guardMove(() => {
      typedAxis = null;
      view?.lookAlong(orientation.direction, orientation.up);
    });
  }

  const AXES: { name: string; v: Vec3 }[] = [
    { name: 'a', v: [1, 0, 0] },
    { name: 'b', v: [0, 1, 0] },
    { name: 'c', v: [0, 0, 1] },
  ];

  /** Beam along a, b or c. */
  function presetUvw(uvw: Vec3) {
    uvwInput = [String(uvw[0]), String(uvw[1]), String(uvw[2])];
    goToZone();
  }

  /** Beam along a*, b* or c*: the normal of the (100), (010) or (001) planes. */
  function presetHkl(hkl: Vec3) {
    if (!crystal || !view) return;
    guardMove(() => {
      if (!crystal) return;
      typedAxis = null;
      const d = directionNormalToHkl(crystal.lattice, hkl);
      view?.lookAlong(d, defaultUp(crystal.lattice, d));
    });
  }

  const step = $derived(
    Number.isFinite(settings.tiltStep) && settings.tiltStep > 0 ? settings.tiltStep : 1,
  );

  function turn(right: number, upward: number, roll: number) {
    if (!view) return;
    const s = view.viewState();
    const f = rotateView({ direction: s.direction, up: s.up }, { right, upward, roll });
    view.lookAlong(f.direction, f.up);
  }

  /**
   * Dragging the pattern in tilt mode: the crystal turns so that the pattern (Kikuchi lines, rings)
   * follows the pointer. dx, dy are detector units (1/angstrom); the angle is dx / k. The sign is
   * opposite to the arrow keys: turning the crystal right moves its near atoms right, but the zone
   * axis points into the screen, so its image (and the rings and Kikuchi lines) moves left.
   */
  function tiltBy(dx: number, dy: number) {
    if (!Number.isFinite(lambda) || warning) return;
    const deg = (180 / Math.PI) * lambda;
    guardMove(dynamic ? null : () => turn(-dx * deg, -dy * deg, 0));
  }

  const ARROWS: Record<string, [number, number]> = {
    ArrowRight: [1, 0],
    ArrowLeft: [-1, 0],
    ArrowUp: [0, 1],
    ArrowDown: [0, -1],
  };

  /** Arrow keys tilt by the step (Shift: a tenth of it, Ctrl: five times); Alt+Left/Right rolls. */
  function onKeydown(e: KeyboardEvent) {
    const a = ARROWS[e.key];
    if (!a || e.metaKey || !view || !crystal) return;
    e.preventDefault();
    if (warning) return;
    const size = e.shiftKey ? step / 10 : e.ctrlKey ? step * 5 : step;
    const roll = e.altKey;
    guardMove(() => {
      if (roll) turn(0, 0, a[0] * size);
      else turn(a[0] * size, a[1] * size, 0);
    });
  }

  function setPreset(p: RangePreset | 'supercell3') {
    if (p === 'supercell3') {
      settings.range = { min: [0, 0, 0], max: [3, 3, 3], boundary: true, slab: null };
      return;
    }
    const { range, boundary } = presetRange(p);
    settings.range = { ...range, boundary, slab: null };
  }

  const MAX_CELLS = 20;
  /** Cells shown along a, b and c. */
  const cells = $derived(
    settings.range.max.map((x, k) => Math.round((x - settings.range.min[k]) * 1000) / 1000),
  );

  /** `n` whole cells along one axis, counted from the origin like the presets. */
  function setCells(k: number, input: HTMLInputElement) {
    const n = Number(input.value);
    if (!Number.isInteger(n) || n < 1 || n > MAX_CELLS) {
      input.value = String(cells[k]);
      return;
    }
    const r = settings.range;
    const min = [...r.min] as [number, number, number];
    const max = [...r.max] as [number, number, number];
    min[k] = 0;
    max[k] = n;
    settings.range = { ...r, min, max };
  }

  const isPreset = (n: number) =>
    settings.range.min.every((x) => x === 0) && settings.range.max.every((x) => x === n);

  // ---- export (M12) --------------------------------------------------------------------------------

  const baseName = () => safeName(fileName || (crystal?.name ?? ''));
  const zoneTag = () =>
    `zone_${(shownPattern?.zoneAxis ?? reading?.indices ?? [0, 0, 0]).join('_')}${dynamic ? '_dynamical' : ''}`;

  const patternSections: ExportSection[] = [
    {
      title: 'Image of the pattern',
      image: true,
      rows: svgImageRows({
        get: () => patternPanel?.svgElement(),
        name: () => `${baseName()}_${zoneTag()}_pattern`,
      }),
    },
  ];
  const structureSections: ExportSection[] = [
    {
      title: 'Image of the structure',
      image: true,
      rows: structureImageRows({
        view: () => view,
        background: () => viewSettings.appearance.background,
        name: () => `${baseName()}_${zoneTag()}_structure`,
      }),
    },
  ];

  /** The spot list of the pattern shown, as CSV; returns the file name. */
  function saveSpots(): string {
    if (!shownPattern) throw new Error('There is no pattern yet.');
    const name = `${baseName()}_${zoneTag()}_spots.csv`;
    downloadText(spotsToCsv(shownPattern.spots), name, 'text/csv');
    return name;
  }

  let sideTab = $state<EDTab>('params');
  const patternSize = () => {
    const el = patternPanel?.svgElement();
    if (!el) return null;
    const { w, h } = svgSize(el);
    return { width: w, height: h };
  };

  const deviation = $derived(reading ? reading.angleDeg : 0);
  const measurement = $derived.by(() => {
    void shownPattern;
    void selected;
    return patternPanel?.measurement() ?? null;
  });
  const indexText = (v: readonly number[]) => v.join(' ');
</script>

<section class="ed" aria-label="Electron diffraction" data-testid="ed-tab">
  <div class="toolbar card">
    <fieldset class="tgroup" disabled={!crystal}>
      <legend>Zone axis</legend>
      <div class="ctl">
        <form
          class="idxform"
          onsubmit={(e) => {
            e.preventDefault();
            goToZone();
          }}
          title="Beam along the zone axis [uvw] (integers)"
        >
          <span class="br">[</span>
          {#each [0, 1, 2] as k (k)}
            <input
              class="idx"
              bind:value={uvwInput[k]}
              aria-label={`zone axis index ${k + 1}`}
              data-testid={`ed-uvw-${k}`}
              inputmode="numeric"
            />
          {/each}
          <span class="br">]</span>
          <button type="submit" disabled={!uvwValue} data-testid="ed-uvw-go">Go</button>
        </form>
        <button
          type="button"
          onclick={fromStructureViewer}
          disabled={!orientation.ready}
          title="Take the orientation of the Structure Viewer tab"
          data-testid="ed-from-viewer">From Structure Viewer</button
        >
        <span class="seg" role="group" aria-label="Zone axis along a, b or c">
          {#each AXES as { name, v } (name)}
            <button
              type="button"
              onclick={() => presetUvw(v)}
              title={`Beam along ${name}, the zone axis [${v.join(' ')}]`}
              data-testid={`ed-zone-${name}`}>{name}</button
            >
          {/each}
        </span>
        <span class="seg" role="group" aria-label="Zone axis along a*, b* or c*">
          {#each AXES as { name, v } (name)}
            <button
              type="button"
              onclick={() => presetHkl(v)}
              title={`Beam along ${name}*, the normal of the (${v.join(' ')}) planes`}
              data-testid={`ed-zone-${name}star`}>{name}*</button
            >
          {/each}
        </span>
        <label class="unit" title="Tilt step of the arrow keys (Shift: a tenth, Ctrl: five times)">
          step
          <input
            class="idx"
            type="number"
            min="0.01"
            max="90"
            step="0.1"
            bind:value={settings.tiltStep}
            aria-label="Tilt step in degrees"
            data-testid="ed-tilt-step"
          />°
        </label>
      </div>
    </fieldset>

    <fieldset class="tgroup" disabled={!crystal}>
      <legend>Structure range</legend>
      <div class="ctl">
        <span class="seg" role="group" aria-label="Range presets">
          <button
            type="button"
            aria-pressed={isPreset(1)}
            onclick={() => setPreset('cellBoundary')}
            title="One cell with its boundary atoms"
            data-testid="ed-range-1">1×1×1</button
          ><button
            type="button"
            aria-pressed={isPreset(2)}
            onclick={() => setPreset('supercell2')}
            data-testid="ed-range-2">2×2×2</button
          ><button
            type="button"
            aria-pressed={isPreset(3)}
            onclick={() => setPreset('supercell3')}
            data-testid="ed-range-3">3×3×3</button
          >
        </span>
        <span
          class="cells"
          title={`Cells along a, b and c (1 to ${MAX_CELLS}), counted from the origin`}
        >
          {#each ['a', 'b', 'c'] as axis, k (axis)}
            {#if k > 0}<span class="br">×</span>{/if}
            <input
              class="idx"
              type="number"
              min="1"
              max={MAX_CELLS}
              step="1"
              value={cells[k]}
              onchange={(e) => setCells(k, e.currentTarget)}
              aria-label={`Cells along ${axis}`}
              data-testid={`ed-cells-${k}`}
            />
          {/each}
        </span>
      </div>
    </fieldset>
    <fieldset class="tgroup" disabled={!crystal}>
      <legend>Dynamical</legend>
      <div class="ctl">
        <button
          type="button"
          class="calc"
          onclick={calculateDynamical}
          disabled={solving !== null || !beamsValid || !reading}
          title="Bloch-wave intensities (multiple scattering) for the current orientation and thickness. Moving the crystal afterwards switches back to kinematic intensities."
          data-testid="ed-dyn-calc">Calculate dynamical diffraction</button
        >
        {#if solving !== null}
          <span class="busy" role="status" data-testid="ed-dyn-busy"
            ><span class="spinner" aria-hidden="true"></span>solving {solving} beams…</span
          >
        {:else if dynamic}
          <span class="muted" role="status" data-testid="ed-dyn-status"
            >{dynamic.problem.n} beams · {fmt(dynamic.ms / 1000, 2)} s</span
          >
          <button
            type="button"
            onclick={backToKinematic}
            title="Show the kinematic pattern again"
            data-testid="ed-dyn-off">Kinematic</button
          >
        {/if}
        <label
          class="unit"
          title="Beams in the Bloch-wave calculation (000 included), nearest the Ewald sphere first. The time grows as the cube: about 0.2 s for 150, 1.5 s for 300."
        >
          beams
          <input
            class="num small"
            type="number"
            min="2"
            max={MAX_DYN_BEAMS}
            step="10"
            bind:value={settings.dynBeams}
            aria-label="Number of beams"
            data-testid="ed-dyn-beams"
          />
        </label>
        <label
          class="unit"
          title="Absorption: the imaginary potential is this fraction of the real one (U′ = κU); 0.05-0.1 is typical"
        >
          κ
          <input
            class="num small"
            type="number"
            min="0"
            max={MAX_ABSORPTION}
            step="0.01"
            bind:value={settings.absorption}
            aria-label="Absorption factor kappa"
            data-testid="ed-dyn-absorption"
          />
        </label>
      </div>
    </fieldset>
    <fieldset class="tgroup" disabled={!crystal}>
      <legend>Tools</legend>
      <div class="ctl">
        <label class="chip" title="Click two spots to compare |g| and the angle between them">
          <input
            type="checkbox"
            bind:checked={measuring}
            onchange={() => (selected = [])}
            data-testid="ed-measure"
          /> Measure
        </label>
      </div>
    </fieldset>
  </div>

  <div class="layout" class:withPanel={crystal !== null}>
    <div class="pair">
      <div class="panel card">
        <div class="phead">
          <span class="phead-title">
            <span>Structure</span>
            <ExportMenu
              sections={structureSections}
              disabled={!crystal}
              imageSize={() => view?.size ?? null}
              testid="ed-structure-export"
              compact
            />
          </span>
          <span class="phead-tools">
            <button
              type="button"
              disabled={!crystal}
              onclick={() => view?.resetZoom()}
              title="Magnification back to fit; the orientation stays"
              data-testid="ed-reset-zoom">Reset zoom</button
            >
          </span>
        </div>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <div
          class="square stage"
          bind:this={stage}
          style:background={viewSettings.appearance.background}
          tabindex="0"
          role="application"
          aria-label="Crystal seen along the beam. Arrow keys tilt it."
          onkeydown={onKeydown}
          onpointerdowncapture={onStagePointerCapture}
          onpointerdown={() => stage?.focus({ preventScroll: true })}
        >
          <canvas bind:this={canvas} data-testid="ed-canvas"></canvas>
          {#if !crystal}
            <div class="empty">
              <Logo size={48} />
              <p>Open a CIF above to simulate its diffraction pattern.</p>
            </div>
          {/if}
          {#if crystal && reading}
            <span class="readout" data-testid="ed-readout">
              beam ∥ [{indexText(reading.indices)}] · {fmt(deviation, 2)}° ({fmt(
                (deviation * Math.PI) / 0.18,
                1,
              )} mrad) off
            </span>
          {/if}
          {#if model}
            <div class="hud">{model.count.toLocaleString('en')} atoms</div>
          {/if}
        </div>
      </div>

      <div class="panel card">
        <div class="phead">
          <span class="phead-title">
            <span>Diffraction pattern</span>
            <ExportMenu
              sections={patternSections}
              disabled={!crystal}
              imageSize={patternSize}
              testid="ed-export"
              compact
            />
          </span>
          <span class="phead-tools">
            <span class="seg small" role="group" aria-label="What dragging the pattern does">
              <button
                type="button"
                aria-pressed={settings.dragMode === 'pan'}
                onclick={() => (settings.dragMode = 'pan')}
                title="Drag moves the view of the pattern"
                data-testid="ed-drag-pan">Pan</button
              ><button
                type="button"
                aria-pressed={settings.dragMode === 'tilt'}
                onclick={() => (settings.dragMode = 'tilt')}
                title="Drag tilts the crystal so that the pattern follows the pointer (Kikuchi navigation)"
                data-testid="ed-drag-tilt">Tilt</button
              >
            </span>
            <span class="seg small">
              <button
                type="button"
                onclick={() => patternPanel?.zoomOut()}
                aria-label="Zoom out"
                data-testid="ed-zoom-out">−</button
              ><button
                type="button"
                onclick={() => patternPanel?.fit()}
                title="Back to the full pattern, centred"
                data-testid="ed-zoom-fit">Reset</button
              ><button
                type="button"
                onclick={() => patternPanel?.zoomIn()}
                aria-label="Zoom in"
                data-testid="ed-zoom-in">+</button
              >
            </span>
          </span>
        </div>
        <div class="square">
          <EDPattern
            bind:this={patternPanel}
            pattern={shownPattern}
            {settings}
            bind:view={patternView}
            {measuring}
            bind:selected
            {overlay}
            dragMode={settings.dragMode}
            onTilt={tiltBy}
          />
          {#if crystal && dynView && dynamic}
            <span class="readout dark dyn" data-testid="ed-caption">
              Dynamical · {dynamic.problem.n} beams · t = {settings.thickness} Å · [{indexText(
                dynView.pattern.zoneAxis,
              )}] · {settings.voltage} kV
            </span>
            <div class="hud dark" data-testid="ed-hud">
              000 {fmt(100 * dynView.transmitted, 1)}% · strongest {fmt(
                100 * dynView.strongest,
                1,
              )}% of the incident beam{settings.absorption > 0
                ? ` · ${fmt(100 * (1 - dynView.total), 1)}% absorbed`
                : ''}
            </div>
          {:else if crystal && pattern}
            <span class="readout dark" data-testid="ed-caption">
              {settings.maxZone === 0 ? 'ZOLZ' : `Laue zones |n| ≤ ${settings.maxZone}`} of [{indexText(
                pattern.zoneAxis,
              )}] · {settings.voltage} kV
            </span>
            <div class="hud dark" data-testid="ed-hud">
              {pattern.spots.length.toLocaleString('en')} spots · {fmt(computeMs, 1)} ms
            </div>
          {/if}
          {#if warning}
            <div
              class="warn"
              role="alertdialog"
              aria-labelledby="ed-dyn-warn-title"
              aria-describedby="ed-dyn-warn-text"
              data-testid="ed-dyn-warning"
              tabindex="-1"
              onkeydown={(e) => {
                if (e.key === 'Escape') cancelMove();
              }}
            >
              <strong id="ed-dyn-warn-title">Leave the dynamical pattern?</strong>
              <p id="ed-dyn-warn-text">
                Its intensities hold for this orientation only. Moving the crystal switches back to
                kinematic intensities; click Calculate again at the new orientation.
              </p>
              <div class="warn-actions">
                <button
                  type="button"
                  class="calc"
                  bind:this={switchButton}
                  onclick={confirmMove}
                  data-testid="ed-dyn-switch">Switch to kinematic</button
                >
                <button type="button" onclick={cancelMove} data-testid="ed-dyn-keep"
                  >Keep dynamical</button
                >
              </div>
            </div>
          {/if}
          {#if error}<p class="empty err" role="alert">{error}</p>{/if}
        </div>
      </div>
    </div>

    {#if crystal}
      <SidePanel
        tabs={ED_TABS}
        bind:tab={sideTab}
        label="Diffraction settings"
        storageKey="crystallens.edPanel"
        idPrefix="ed"
        testid="ed-"
        defaultWidth={320}
      >
        <EDPanel
          tab={sideTab}
          {crystal}
          bind:settings
          spotCount={shownPattern?.spots.length ?? 0}
          onSaveSpots={saveSpots}
        />
      </SidePanel>
    {/if}
  </div>

  {#if dynNote}
    <p class="note" role="status" data-testid="ed-dyn-note">{dynNote}</p>
  {/if}
  {#if measuring}
    <p class="measure" data-testid="ed-measurement">
      {#if measurement}
        g₁ ({indexText(measurement.spots[0].hkl)}) = {fmt(measurement.g1)} Å⁻¹ (d {fmt(
          measurement.d1,
        )} Å) · g₂ ({indexText(measurement.spots[1].hkl)}) = {fmt(measurement.g2)} Å⁻¹ (d {fmt(
          measurement.d2,
        )} Å) · g₂/g₁ = {fmt(measurement.ratio)} · angle {fmt(measurement.angle, 2)}°
      {:else}
        Click two spots in the pattern ({selected.length} of 2 picked).
      {/if}
    </p>
  {/if}
  <p class="hint">
    Left: <kbd>drag</kbd> rotate · <kbd>wheel</kbd> zoom · <kbd>right-drag</kbd> pan · click it,
    then
    <kbd>←↑→↓</kbd> tilt by the step (<kbd>Shift</kbd> a tenth, <kbd>Ctrl</kbd> five times,
    <kbd>Alt</kbd>+<kbd>←→</kbd> roll). Right: <kbd>wheel</kbd> zoom · <kbd>drag</kbd> pan ·
    <kbd>double-click</kbd> reset · hover a spot for its data. The pattern is drawn in the same orientation
    as the structure (no microscope image rotation).
  </p>
</section>

<style>
  .ed {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    padding: 0.35rem 0.4rem;
    font-size: 0.84rem;
  }
  .cells {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .tgroup {
    margin: 0;
    padding: 0.25rem 0.85rem 0.35rem;
    border: none;
    border-right: 1px solid var(--border);
    min-width: 0;
  }
  .tgroup:last-child {
    border-right: none;
  }
  .tgroup:disabled {
    opacity: 0.55;
  }
  legend {
    float: left;
    width: 100%;
    padding: 0;
    margin-bottom: 0.25rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .ctl {
    clear: both;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.6rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.15rem 0.55rem 0.15rem 0.4rem;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: var(--surface);
    cursor: pointer;
    user-select: none;
  }
  .chip:has(input:checked) {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-ink);
  }
  .chip input {
    margin: 0;
  }
  .seg {
    display: inline-flex;
  }
  .seg > button {
    border-radius: 0;
    margin-left: -1px;
    min-width: 2rem;
  }
  .seg > button:first-child {
    border-radius: 6px 0 0 6px;
    margin-left: 0;
  }
  .seg > button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .seg > button:hover:not(:disabled) {
    position: relative;
    z-index: 1;
  }
  .seg > button[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-ink);
    position: relative;
    z-index: 1;
  }
  .seg.small > button {
    padding: 0.05rem 0.5rem;
    font-size: 0.78rem;
    min-width: 1.8rem;
  }
  .idxform,
  .unit {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
  }
  .br {
    font-family: var(--mono);
    color: var(--muted);
  }
  .idx {
    width: 2.6rem;
    padding: 0.15rem 0.2rem;
    text-align: center;
  }
  .num {
    width: 4.2rem;
    padding: 0.15rem 0.3rem;
  }
  .num.small {
    width: 3.6rem;
  }
  .muted {
    color: var(--muted);
    font-family: var(--mono);
    font-size: 0.8rem;
  }

  /* ---- the two square panels ---- */
  /* the two square panels and the sidebar, which takes their height */
  .layout {
    display: flex;
    align-items: stretch;
    justify-content: center;
  }
  .pair {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: 0.75rem;
    /* each square is at most as tall as the window leaves room for */
    max-width: calc(2 * max(18rem, 100vh - 22rem) + 0.75rem);
  }
  @media (max-width: 60rem) {
    .layout.withPanel {
      flex-direction: column;
      gap: 0.75rem;
    }
  }
  .panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }
  .square {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
  }
  .stage {
    touch-action: none;
  }
  .stage:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
  }
  canvas:active {
    cursor: grabbing;
  }
  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin: 0;
    padding: 1rem;
    text-align: center;
    pointer-events: none;
    color: #5b6578;
  }
  .empty p {
    margin: 0;
  }
  .err {
    color: #fca5a5;
  }
  .readout {
    position: absolute;
    left: 0.5rem;
    top: 0.5rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(0, 0, 0, 0.06);
    color: #27304a;
    font: 0.75rem var(--mono);
    pointer-events: none;
    z-index: 2;
  }
  .readout.dark {
    background: rgba(255, 255, 255, 0.85);
    border-color: rgba(0, 0, 0, 0.08);
    color: #27304a;
  }
  .hud {
    position: absolute;
    right: 0.5rem;
    bottom: 0.4rem;
    padding: 0.05rem 0.45rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.6);
    font: 0.7rem var(--mono);
    color: #5b6578;
    pointer-events: none;
  }
  .hud.dark {
    background: rgba(255, 255, 255, 0.7);
    color: #5b6578;
  }
  .calc {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;
    font-weight: 600;
  }
  /* outranks the global button:hover (which would leave white text on a light background) */
  .calc:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--accent);
    filter: brightness(1.1);
  }
  .busy {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--accent-ink);
    font: 0.8rem var(--mono);
  }
  .spinner {
    width: 0.85rem;
    height: 0.85rem;
    box-sizing: border-box;
    border: 2px solid var(--accent-soft);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 2.4s;
    }
  }
  .readout.dyn {
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .warn {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(22rem, calc(100% - 2rem));
    padding: 0.8rem 0.9rem;
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid var(--border-strong);
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
    color: var(--text-h);
    font-size: 0.86rem;
    z-index: 5;
  }
  .warn p {
    margin: 0.4rem 0 0.7rem;
    color: var(--text);
  }
  .warn-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .note {
    margin: 0;
    font-size: 0.84rem;
    color: var(--muted);
  }
  .measure {
    margin: 0;
    font: 0.84rem var(--mono);
    color: var(--text-h);
  }
  .hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--muted);
  }
  kbd {
    padding: 0 0.3rem;
    border: 1px solid var(--border-strong);
    border-bottom-width: 2px;
    border-radius: 4px;
    font: 0.72rem var(--mono);
    background: var(--surface);
  }
  @media (max-width: 50rem) {
    .pair {
      grid-template-columns: minmax(0, 1fr);
      max-width: none;
    }
  }
</style>
