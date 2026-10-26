<script lang="ts">
  // 3D structure viewer (M5, M6). The real interface (M14) will wrap this with menus and tabs.
  import { onMount, tick, untrack } from 'svelte';
  import type { Crystal } from '../core/crystal';
  import type { Vec3 } from '../core/math/vec3';
  import {
    atomLabel,
    buildModel,
    buildPolyhedra,
    defaultRange,
    defaultViewSettings,
    getBondGraph,
    hexToRgb,
    measure,
    resolveAppearance,
    resolveColours,
    settingsForNewCrystal,
    type Appearance,
    type AtomRef,
    type Measurement,
    type StructureModel,
    type ViewSettings,
  } from '../core/structure';
  import { StructureView } from '../render/structureView';
  import ViewPanel from './ViewPanel.svelte';

  let { crystal }: { crystal: Crystal | null } = $props();

  let stage = $state<HTMLDivElement>();
  let canvas: HTMLCanvasElement;
  let labelCanvas: HTMLCanvasElement;
  let view: StructureView | null = null;
  let ready = $state(false);
  // True until a newly loaded crystal has been drawn once (with the default camera).
  let fresh = true;

  let settings = $state<ViewSettings>(defaultViewSettings(null));
  let measuring = $state(false);

  let model = $state.raw<StructureModel | null>(null);
  let modelWarnings = $state<string[]>([]);
  let polyhedraInfo = $state({ count: 0, skipped: 0 });
  let error = $state('');
  let fps = $state(0);
  let hover = $state<{ atom: number; x: number; y: number } | null>(null);
  let selection = $state.raw<readonly number[]>([]);
  let labelEls: HTMLElement[] = [];
  let measurements = $state.raw<Measurement[]>([]);
  const screen = { x: 0, y: 0, visible: true };

  const fmt = (x: number, d = 4) => x.toFixed(d);

  function describe(atom: number) {
    if (!model || !crystal) return null;
    const placed = model.placed;
    const a = crystal.atoms[placed.atom[atom]];
    const site = crystal.sites[a.site];
    return {
      label: site.label,
      element: a.element,
      frac: [0, 1, 2].map((k) => placed.frac[3 * atom + k]),
      occupancy: a.occupancy,
      added: model.inRange[atom] === 0,
    };
  }

  const refOf = (i: number): AtomRef => {
    const p = model!.placed;
    return { atom: p.atom[i], cell: [p.cell[3 * i], p.cell[3 * i + 1], p.cell[3 * i + 2]] };
  };

  // ---- overlays: measurement labels and atom labels ---------------------------------------------

  function updateMeasurementLabels() {
    if (!view) return;
    for (let i = 0; i < measurements.length; i++) {
      const el = labelEls[i];
      if (!el) continue;
      view.project(measurements[i].anchor, screen);
      el.style.transform = `translate(${screen.x}px, ${screen.y}px) translate(-50%, -120%)`;
      el.style.display = screen.visible ? '' : 'none';
    }
  }

  const MAX_ATOM_LABELS = 4000;
  let labelCtx: CanvasRenderingContext2D | null = null;
  let labelTexts: string[] = [];
  let labelInk = '#1b1d24';
  let labelHalo = 'rgba(255,255,255,0.85)';
  let lastApp: Appearance | null = null;
  let stageW = 1;
  let stageH = 1;

  function drawAtomLabels() {
    const ctx = labelCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, stageW, stageH);
    if (!view || !lastApp || labelTexts.length === 0) return;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = labelHalo;
    ctx.fillStyle = labelInk;
    const n = labelTexts.length;
    for (let i = 0; i < n; i++) {
      if (!lastApp.atomVisible[i]) continue;
      view.atomScreen(i, screen);
      if (
        !screen.visible ||
        screen.x < -20 ||
        screen.y < -20 ||
        screen.x > stageW + 20 ||
        screen.y > stageH + 20
      )
        continue;
      ctx.strokeText(labelTexts[i], screen.x, screen.y - 2);
      ctx.fillText(labelTexts[i], screen.x, screen.y - 2);
    }
  }

  function onRendered() {
    updateMeasurementLabels();
    drawAtomLabels();
  }

  function sizeOverlays() {
    if (!stage || !labelCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    stageW = stage.clientWidth;
    stageH = stage.clientHeight;
    labelCanvas.width = Math.max(1, Math.round(stageW * dpr));
    labelCanvas.height = Math.max(1, Math.round(stageH * dpr));
    labelCtx = labelCanvas.getContext('2d');
    labelCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- mounting ---------------------------------------------------------------------------------

  let lastApplyMs = 0;

  onMount(() => {
    view = new StructureView(canvas, {
      onHover: (atom, x, y) => {
        hover = atom === null ? null : { atom, x, y };
      },
      onSelect: (s) => {
        selection = s;
      },
      onRender: onRendered,
    });
    sizeOverlays();
    const observer = new ResizeObserver(() => {
      view?.resize();
      sizeOverlays();
      view?.requestRender();
    });
    observer.observe(stage!);
    const timer = setInterval(() => {
      if (view) fps = Math.round(view.stats.fps);
    }, 500);
    // Test hook (also handy in the console): screen positions of atoms, to drive the pointer.
    (window as unknown as Record<string, unknown>).__crystallens = {
      atomScreen: (i: number) => {
        view!.atomScreen(i, screen);
        const r = canvas.getBoundingClientRect();
        return { x: r.left + screen.x, y: r.top + screen.y };
      },
      stats: () => ({ ...view!.stats }),
      model: () => model,
      pickAt: (x: number, y: number) => view!.pickAt(x, y),
      selection: () => [...view!.getSelection()],
      viewState: () => view!.viewState(),
      settings: () => $state.snapshot(settings),
      bondsDrawn: () => view!.bondsDrawn,
      appearanceMs: () => lastApplyMs,
      polyhedra: () => ({ ...polyhedraInfo }),
    };
    ready = true;
    return () => {
      clearInterval(timer);
      observer.disconnect();
      view?.dispose();
      view = null;
    };
  });

  // ---- a new crystal starts with fresh settings (keeping the user's preferences) -----------------

  $effect(() => {
    const c = crystal;
    untrack(() => {
      settings = c ? settingsForNewCrystal(settings, c) : defaultViewSettings(null);
      fresh = true;
    });
  });

  // ---- what is shown: rebuilt only when the geometry-relevant settings change --------------------

  const geometryKey = $derived(
    JSON.stringify([
      settings.range,
      settings.bonds.rules.map((r) => [r.a, r.b, r.min, r.max]),
      settings.bonds.beyondRange,
      settings.bonds.completeMolecules,
      settings.bonds.manual,
    ]),
  );
  let builtFor: { crystal: Crystal | null; key: string } | null = null;
  let modelRevision = 0;

  $effect(() => {
    if (!ready || !view) return;
    const c = crystal;
    const key = geometryKey;
    if (builtFor && builtFor.crystal === c && builtFor.key === key) return;
    builtFor = { crystal: c, key };
    error = '';
    untrack(() => {
      if (!c) {
        model = null;
        modelWarnings = [];
        return;
      }
      try {
        const snap = $state.snapshot(settings);
        const built = buildModel(c, {
          range: snap.range,
          boundary: snap.range.boundary,
          slab: snap.range.slab,
          bonds: snap.bonds,
        });
        model = built;
        modelRevision++;
        modelWarnings = built.warnings;
        // Same crystal, new range or rules: keep the user's orientation and zoom.
        view!.setStructure(built, c.lattice, !fresh);
        fresh = false;
        view!.setSelectionLimit(measuring ? 4 : 0);
        selection = [];
        hover = null;
      } catch (e) {
        model = null;
        error = e instanceof Error ? e.message : String(e);
      }
    });
  });

  // ---- how it looks: resolved from the settings, applied in place -------------------------------

  const appearanceKey = $derived(
    JSON.stringify([
      settings.appearance,
      settings.bonds.rules.map((r) => [r.visible, r.radius, r.color]),
      settings.hiddenAtoms,
      settings.polyhedra,
    ]),
  );
  /** The parts of the appearance that change sizes or visibility, not only colours. */
  const shapeKey = $derived.by(() => {
    const a = settings.appearance;
    const pick = (o: Record<string, { radius?: number; visible?: boolean }>) =>
      Object.entries(o).map(([k, v]) => [k, v.radius, v.visible]);
    return JSON.stringify([
      a.displayStyle,
      a.radiusScheme,
      a.radiusScale,
      a.uniformRadius,
      pick(a.elements),
      pick(a.sites),
      settings.hiddenAtoms,
      settings.bonds.rules.map((r) => [r.visible, r.radius]),
    ]);
  });
  /** The colour settings alone: a change here rewrites only the colour buffers. */
  const colourKey = $derived.by(() => {
    const a = settings.appearance;
    const col = (o: Record<string, { color?: string }>) =>
      Object.entries(o).map(([k, v]) => [k, v.color]);
    return JSON.stringify([
      col(a.elements),
      col(a.sites),
      settings.bonds.rules.map((r) => r.color),
    ]);
  });
  let lastShapeKey = '';
  let lastColourKey = '';
  let lastPolyKey = '';
  let lastLabelKey = '';
  let lastModelRevision = -1;

  $effect(() => {
    if (!ready || !view) return;
    const m = model;
    const c = crystal;
    void appearanceKey;
    const shape = shapeKey;
    const colour = colourKey;
    if (!m || !c) return;
    untrack(() => {
      const t0 = performance.now();
      const snap = $state.snapshot(settings);
      const newModel = modelRevision !== lastModelRevision;
      // Three cases, cheapest last: sizes or visibility changed (everything is rewritten), only
      // colours changed (just the colour buffers), or neither (bonds on/off, labels, ...).
      let changed = false;
      if (shape !== lastShapeKey || newModel || !lastApp) {
        lastApp = resolveAppearance(c, m, snap.appearance, snap.bonds.rules, snap.hiddenAtoms);
        view!.setAppearance(lastApp, true);
        changed = true;
      } else if (colour !== lastColourKey) {
        const colours = resolveColours(c, m, snap.appearance, snap.bonds.rules);
        view!.setColours(colours);
        lastApp = { ...lastApp, ...colours };
        changed = true;
      }
      const drawn = snap.appearance.bondsVisible && snap.appearance.displayStyle !== 'spaceFill';
      if (lastApp.bondsDrawn !== drawn) {
        view!.setBondsDrawn(drawn);
        lastApp = { ...lastApp, bondsDrawn: drawn };
      }
      lastShapeKey = shape;
      lastColourKey = colour;
      lastModelRevision = modelRevision;

      const polyKey = JSON.stringify(snap.polyhedra);
      if (changed || polyKey !== lastPolyKey) {
        lastPolyKey = polyKey;
        try {
          if (snap.polyhedra.centres.length > 0) {
            const g = buildPolyhedra(m, lastApp, getBondGraph(c, m.rules), snap.polyhedra.centres);
            view!.setPolyhedra(g, snap.polyhedra.opacity, snap.polyhedra.edges);
            polyhedraInfo = { count: g.count, skipped: g.skipped };
          } else {
            view!.setPolyhedra(null, 1, false);
            polyhedraInfo = { count: 0, skipped: 0 };
          }
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
      }

      const mode = snap.appearance.labels;
      const labelKey = `${mode}|${modelRevision}`;
      if (labelKey !== lastLabelKey) {
        lastLabelKey = labelKey;
        labelTexts =
          mode === 'none' || m.count > MAX_ATOM_LABELS
            ? []
            : Array.from({ length: m.count }, (_, i) => atomLabel(c, m, i, mode));
      }
      const [r, g2, b] = hexToRgb(snap.appearance.background);
      const dark = 0.299 * r + 0.587 * g2 + 0.114 * b < 128;
      labelInk = dark ? '#f4f6fa' : '#1b1d24';
      labelHalo = dark ? 'rgba(10,12,18,0.85)' : 'rgba(255,255,255,0.85)';
      view!.requestRender();
      lastApplyMs = performance.now() - t0;
    });
  });

  // ---- viewer-level settings ---------------------------------------------------------------------

  $effect(() => {
    if (ready) view?.setProjection(settings.projection);
  });
  $effect(() => {
    if (ready) view?.setShowCell(settings.showCell);
  });
  $effect(() => {
    if (ready) view?.setShowAxes(settings.showAxes);
  });
  $effect(() => {
    if (ready) view?.setToon(settings.toon);
  });
  $effect(() => {
    if (ready) view?.setSelectionLimit(measuring ? 4 : 0);
    if (!measuring) measurements = [];
  });
  $effect(() => {
    if (!measuring || !model) {
      measurements = [];
      return;
    }
    const m = model;
    const pts: Vec3[] = selection.map((i) => [m.cart[3 * i], m.cart[3 * i + 1], m.cart[3 * i + 2]]);
    measurements = measure(pts);
    void tick().then(() => {
      updateMeasurementLabels();
      view?.requestRender();
    });
  });

  // ---- toolbar actions ---------------------------------------------------------------------------

  function lookAlong(k: 0 | 1 | 2) {
    if (!crystal || !view) return;
    const M = crystal.lattice.M;
    const dir: Vec3 = [M[0][k], M[1][k], M[2][k]];
    // Keep b (or c when looking along b) pointing up the screen where possible.
    const upIdx = k === 1 ? 2 : 1;
    view.lookAlong(dir, [M[0][upIdx], M[1][upIdx], M[2][upIdx]]);
  }

  const resetRange = () => {
    settings.range = defaultRange();
  };

  function hideSelected() {
    if (!model || selection.length === 0) return;
    const refs = selection.map(refOf);
    settings.hiddenAtoms = [...settings.hiddenAtoms, ...refs];
    view?.setSelection([]);
  }

  const hovered = $derived(hover ? describe(hover.atom) : null);
</script>

<section aria-label="Structure viewer" data-testid="viewer">
  <h2>Structure viewer</h2>
  <div class="toolbar">
    <label>
      Style
      <select bind:value={settings.appearance.displayStyle} data-testid="style">
        <option value="ballStick">Ball and stick</option>
        <option value="spaceFill">Space filling</option>
        <option value="stick">Stick</option>
      </select>
    </label>
    <label>
      Projection
      <select bind:value={settings.projection} data-testid="projection">
        <option value="ortho">Orthographic</option>
        <option value="persp">Perspective</option>
      </select>
    </label>
    <label class="inline"><input type="checkbox" bind:checked={settings.showCell} /> Cell</label>
    <label class="inline"><input type="checkbox" bind:checked={settings.showAxes} /> Axes</label>
    <label class="inline"><input type="checkbox" bind:checked={settings.toon} /> Toon</label>
    <label class="inline" title="Untick to draw no bonds at all">
      <input type="checkbox" bind:checked={settings.appearance.bondsVisible} data-testid="bonds" />
      Bonds
    </label>
    <label class="inline">
      <input type="checkbox" bind:checked={measuring} data-testid="measure" /> Measure
    </label>
    <span class="group">
      View along
      <button type="button" onclick={() => lookAlong(0)}>a</button>
      <button type="button" onclick={() => lookAlong(1)}>b</button>
      <button type="button" onclick={() => lookAlong(2)}>c</button>
    </span>
    <span class="group">
      <button
        type="button"
        onclick={() => view?.resetOrientation()}
        title="Default orientation and centring; the zoom stays">Reset view</button
      >
      <button
        type="button"
        onclick={() => view?.resetZoom()}
        title="Magnification back to fit; orientation and pan stay">Reset zoom</button
      >
      <button type="button" onclick={resetRange} title="One cell with its boundary atoms, no slab"
        >Reset range</button
      >
    </span>
  </div>

  <div class="layout" class:withPanel={crystal !== null}>
    <div class="stage" bind:this={stage} style:background={settings.appearance.background}>
      <canvas bind:this={canvas} data-testid="viewer-canvas"></canvas>
      <canvas bind:this={labelCanvas} class="overlay" data-testid="label-canvas"></canvas>

      {#if !crystal}
        <p class="empty">Load a CIF to see its structure.</p>
      {/if}
      {#if error}
        <p class="empty err" role="alert">{error}</p>
      {/if}

      {#each measurements as m, i (i)}
        <div class="mlabel" bind:this={labelEls[i]} data-testid="measurement">
          {fmt(m.value, m.unit === 'Å' ? 3 : 2)}
          {m.unit}
        </div>
      {/each}

      {#if hover && hovered}
        <div
          class="tip"
          data-testid="tooltip"
          style:left={`${hover.x - stage!.getBoundingClientRect().left + 14}px`}
          style:top={`${hover.y - stage!.getBoundingClientRect().top + 14}px`}
        >
          <strong>{hovered.label}</strong>
          {hovered.element}
          <div>frac {hovered.frac.map((x) => fmt(x)).join(' ')}</div>
          <div>occ {fmt(hovered.occupancy, 3)}</div>
          {#if hovered.added}<div>outside the range (bonded)</div>{/if}
        </div>
      {/if}

      <div class="hud" data-testid="hud">
        {#if model}{model.count.toLocaleString('en')} atoms · {(
            model.bonds.length / 2
          ).toLocaleString('en')} bonds ·
        {/if}{fps > 0 ? `${fps} fps` : 'idle'}
      </div>
    </div>

    {#if crystal}
      <aside class="side">
        <ViewPanel
          {crystal}
          {model}
          {selection}
          bind:settings
          {polyhedraInfo}
          onHideSelected={hideSelected}
        />
      </aside>
    {/if}
  </div>

  {#each modelWarnings as w, i (i)}
    <p class="warn" role="status">{w}</p>
  {/each}
  <p class="hint">
    Drag to rotate, wheel to zoom, right-drag to pan. Click an atom to select it; turn on Measure
    and click 2, 3 or 4 atoms for a distance, angle or torsion.
  </p>
</section>

<style>
  section {
    margin: 2rem 0;
  }
  h2 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-h);
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    margin-bottom: 0.6rem;
    font-size: 0.85rem;
  }
  .group {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
  }
  .inline {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
  }
  .layout.withPanel {
    grid-template-columns: minmax(0, 1fr) 21rem;
  }
  @media (max-width: 60rem) {
    .layout.withPanel {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .side {
    height: 32rem;
    overflow: hidden;
  }
  .stage {
    position: relative;
    height: 32rem;
    border: 1px solid var(--border, #c9ced8);
    border-radius: 6px;
    overflow: hidden;
    touch-action: none;
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
  canvas.overlay {
    pointer-events: none;
    cursor: inherit;
  }
  .empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    pointer-events: none;
    color: #5b6578;
  }
  .err {
    color: var(--err);
  }
  .warn {
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: #8a5a00;
  }
  .tip {
    position: absolute;
    pointer-events: none;
    padding: 0.35rem 0.55rem;
    border-radius: 4px;
    background: rgba(20, 24, 33, 0.9);
    color: #f1f3f8;
    font: 0.75rem/1.35 var(--mono);
    white-space: nowrap;
    z-index: 3;
  }
  .mlabel {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    background: rgba(255, 210, 63, 0.95);
    color: #1b1d24;
    font: 600 0.75rem var(--mono);
    z-index: 2;
  }
  .hud {
    position: absolute;
    right: 0.5rem;
    bottom: 0.4rem;
    font: 0.7rem var(--mono);
    color: #5b6578;
    pointer-events: none;
  }
  .hint {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
  }
</style>
