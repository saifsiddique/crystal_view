<script lang="ts">
  // 3D structure viewer (M5). The real interface (M14) will wrap this with panels and menus.
  import { onMount, tick, untrack } from 'svelte';
  import type { Crystal } from '../core/crystal';
  import type { Vec3 } from '../core/math/vec3';
  import { measure, type Measurement } from '../core/structure/measure';
  import { buildModel, type DisplayStyle, type StructureModel } from '../core/structure/model';
  import { StructureView, type Projection } from '../render/structureView';

  let { crystal }: { crystal: Crystal | null } = $props();

  let stage = $state<HTMLDivElement>();
  let canvas: HTMLCanvasElement;
  let view: StructureView | null = null;
  let ready = $state(false);
  let lastCrystal: Crystal | null = null;

  let style = $state<DisplayStyle>('ballStick');
  let projection = $state<Projection>('ortho');
  let showCell = $state(true);
  let showAxes = $state(true);
  let toon = $state(false);
  let measuring = $state(false);
  let repeat = $state<[number, number, number]>([1, 1, 1]);

  let model = $state.raw<StructureModel | null>(null);
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
      cart: [0, 1, 2].map((k) => model!.cart[3 * atom + k]),
      occupancy: a.occupancy,
    };
  }

  function updateLabels() {
    if (!view) return;
    for (let i = 0; i < measurements.length; i++) {
      const el = labelEls[i];
      if (!el) continue;
      view.project(measurements[i].anchor, screen);
      el.style.transform = `translate(${screen.x}px, ${screen.y}px) translate(-50%, -120%)`;
      el.style.display = screen.visible ? '' : 'none';
    }
  }

  onMount(() => {
    view = new StructureView(canvas, {
      onHover: (atom, x, y) => {
        hover = atom === null ? null : { atom, x, y };
      },
      onSelect: (s) => {
        selection = s;
      },
      onRender: updateLabels,
    });
    const observer = new ResizeObserver(() => view?.resize());
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
    };
    ready = true;
    return () => {
      clearInterval(timer);
      observer.disconnect();
      view?.dispose();
      view = null;
    };
  });

  $effect(() => {
    if (!ready || !view) return;
    const c = crystal;
    const n = repeat;
    error = '';
    // A newly loaded crystal starts at one cell; changing the counts then re-runs this effect.
    if (c !== lastCrystal) {
      lastCrystal = c;
      if (n.some((x) => x !== 1)) {
        repeat = [1, 1, 1];
        return;
      }
    }
    if (!c) {
      model = null;
      return;
    }
    try {
      const built = buildModel(c, { range: { min: [0, 0, 0], max: [n[0], n[1], n[2]] } });
      model = built;
      // Only the crystal and the cell counts rebuild the scene; the other settings are applied
      // here without being tracked (their own effects below handle later changes).
      untrack(() => {
        view!.setStructure(built, c.lattice);
        view!.setStyle(style);
        view!.setToon(toon);
        view!.setShowCell(showCell);
        view!.setShowAxes(showAxes);
        view!.setProjection(projection);
        view!.setSelectionLimit(measuring ? 4 : 0);
        hover = null;
      });
    } catch (e) {
      model = null;
      error = e instanceof Error ? e.message : String(e);
    }
  });

  $effect(() => {
    view?.setStyle(style);
  });
  $effect(() => {
    view?.setProjection(projection);
  });
  $effect(() => {
    view?.setShowCell(showCell);
  });
  $effect(() => {
    view?.setShowAxes(showAxes);
  });
  $effect(() => {
    view?.setToon(toon);
  });
  $effect(() => {
    view?.setSelectionLimit(measuring ? 4 : 0);
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
      updateLabels();
      view?.requestRender();
    });
  });

  const setRepeat = (k: number, value: string) => {
    const v = Math.max(1, Math.min(30, Math.round(Number(value)) || 1));
    repeat = repeat.map((x, i) => (i === k ? v : x)) as [number, number, number];
  };

  function lookAlong(k: 0 | 1 | 2) {
    if (!crystal || !view) return;
    const M = crystal.lattice.M;
    const dir: Vec3 = [M[0][k], M[1][k], M[2][k]];
    // Keep b (or c when looking along b) pointing up the screen where possible.
    const upIdx = k === 1 ? 2 : 1;
    view.lookAlong(dir, [M[0][upIdx], M[1][upIdx], M[2][upIdx]]);
  }

  const hovered = $derived(hover ? describe(hover.atom) : null);
</script>

<section aria-label="Structure viewer" data-testid="viewer">
  <h2>Structure viewer</h2>
  <div class="toolbar">
    <label>
      Style
      <select bind:value={style} data-testid="style">
        <option value="ballStick">Ball and stick</option>
        <option value="spaceFill">Space filling</option>
        <option value="stick">Stick</option>
      </select>
    </label>
    <label>
      Projection
      <select bind:value={projection} data-testid="projection">
        <option value="ortho">Orthographic</option>
        <option value="persp">Perspective</option>
      </select>
    </label>
    <label class="inline"><input type="checkbox" bind:checked={showCell} /> Cell</label>
    <label class="inline"><input type="checkbox" bind:checked={showAxes} /> Axes</label>
    <label class="inline"><input type="checkbox" bind:checked={toon} /> Toon</label>
    <label class="inline">
      <input type="checkbox" bind:checked={measuring} data-testid="measure" /> Measure
    </label>
    <span class="group">
      Cells
      {#each ['a', 'b', 'c'] as axis, k (axis)}
        <input
          class="n"
          type="number"
          min="1"
          max="30"
          aria-label={`Cells along ${axis}`}
          value={repeat[k]}
          onchange={(e) => setRepeat(k, e.currentTarget.value)}
        />
      {/each}
    </span>
    <span class="group">
      View along
      <button type="button" onclick={() => lookAlong(0)}>a</button>
      <button type="button" onclick={() => lookAlong(1)}>b</button>
      <button type="button" onclick={() => lookAlong(2)}>c</button>
      <button type="button" onclick={() => view?.resetView()}>Reset</button>
    </span>
  </div>

  <div class="stage" bind:this={stage}>
    <canvas bind:this={canvas} data-testid="viewer-canvas"></canvas>

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
      </div>
    {/if}

    <div class="hud" data-testid="hud">
      {#if model}{model.count.toLocaleString('en')} atoms · {(
          model.bonds.length / 2
        ).toLocaleString('en')} bonds ·
      {/if}{fps} fps
    </div>
  </div>
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
  .n {
    width: 3.2rem;
  }
  .stage {
    position: relative;
    height: 30rem;
    border: 1px solid var(--border, #c9ced8);
    border-radius: 6px;
    overflow: hidden;
    background: radial-gradient(circle at 50% 35%, #ffffff, #dde2ec);
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
