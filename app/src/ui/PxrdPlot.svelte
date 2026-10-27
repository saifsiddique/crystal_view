<script lang="ts">
  // The powder pattern (context.md M9) as SVG: wheel zooms the horizontal axis about the pointer,
  // drag pans, double-click fits; ticks under the pattern mark every peak (labelled hkl for the
  // strongest ones); hover a peak for its data, click it to select its row.
  import type { MergedPeak, Profile } from '../core/diffraction/powder';
  import {
    axisTitle,
    axisValue,
    lowerBound,
    niceTicks,
    thinLabels,
    tickText,
    yTransform,
    type PxrdAxis,
    type YScale,
  } from '../plots/pxrdPlot';

  export interface PlotView {
    /** Visible range of the axis coordinate (2θ, Q or −d). */
    u0: number;
    u1: number;
  }

  let {
    profile,
    peaks,
    lambda,
    axis,
    scale,
    labels,
    view = $bindable(),
    selected = null,
    onSelect,
  }: {
    profile: Profile | null;
    peaks: MergedPeak[];
    lambda: number;
    axis: PxrdAxis;
    scale: YScale;
    labels: boolean;
    view: PlotView;
    /** Key of the selected peak group: its first member's "h k l". */
    selected?: string | null;
    onSelect?: (key: string | null) => void;
  } = $props();

  let width = $state(0);
  const HEIGHT = 380;
  const M = { left: 58, right: 14, top: 14, bottom: 44 };
  const TICK_ROW = 16;
  let svg = $state<SVGSVGElement>();
  let hover = $state<{ group: MergedPeak; x: number; y: number } | null>(null);

  const plotW = $derived(Math.max(10, width - M.left - M.right));
  const plotH = HEIGHT - M.top - M.bottom;

  /** Axis coordinate of every profile point (ascending in all three axes). */
  const us = $derived.by(() => {
    if (!profile) return new Float64Array(0);
    const a = new Float64Array(profile.twoTheta.length);
    for (let i = 0; i < a.length; i++) a[i] = axisValue(axis, profile.twoTheta[i], lambda);
    return a;
  });
  const peakUs = $derived(peaks.map((g) => axisValue(axis, g.twoTheta, lambda)));

  const toX = (u: number) => M.left + ((u - view.u0) / (view.u1 - view.u0)) * plotW;
  const fromX = (x: number) => view.u0 + ((x - M.left) / plotW) * (view.u1 - view.u0);

  /** Highest drawn value in view (after the √ transform), with some headroom. */
  const yTop = $derived.by(() => {
    if (!profile) return 1;
    const i0 = lowerBound(us, view.u0);
    const i1 = Math.min(us.length, lowerBound(us, view.u1) + 1);
    let max = 0;
    for (let i = i0; i < i1; i++) if (profile.intensity[i] > max) max = profile.intensity[i];
    return Math.max(yTransform(max, scale), 1e-9) * (labels ? 1.22 : 1.06);
  });
  const toY = (v: number) => M.top + (plotH - TICK_ROW) * (1 - v / yTop) + 0;
  const baseline = $derived(toY(0));

  /** The curve: one point per pixel column (the highest in the column), so no peak is lost. */
  const curve = $derived.by(() => {
    if (!profile || width === 0) return '';
    const n = Math.max(2, Math.floor(plotW));
    const parts: string[] = [];
    let i = lowerBound(us, view.u0);
    const end = lowerBound(us, view.u1);
    // start one point early so the line reaches the left edge
    if (i > 0) i--;
    for (let px = 0; px < n; px++) {
      const uHi = view.u0 + ((px + 1) / n) * (view.u1 - view.u0);
      let max = -1;
      let any = false;
      while (i < us.length && us[i] <= uHi) {
        if (profile.intensity[i] > max) max = profile.intensity[i];
        any = true;
        i++;
      }
      if (i > end + 2 && !any) break;
      if (!any) {
        // a column between two points: interpolate from the neighbours
        const j = Math.min(Math.max(i, 1), us.length - 1);
        const t = (uHi - us[j - 1]) / (us[j] - us[j - 1] || 1);
        max = profile.intensity[j - 1] + t * (profile.intensity[j] - profile.intensity[j - 1]);
      }
      parts.push(`${(M.left + px + 0.5).toFixed(1)},${toY(yTransform(max, scale)).toFixed(1)}`);
    }
    return parts.join(' ');
  });

  const xTicks = $derived(
    niceTicks(
      Math.min(view.u0, view.u1),
      Math.max(view.u0, view.u1),
      Math.max(3, Math.round(plotW / 90)),
    ),
  );
  const yTicks = $derived.by(() => {
    // ticks in intensity units, placed through the transform
    const top = scale === 'sqrt' ? yTop * yTop : yTop;
    return niceTicks(0, top, 5).filter((v) => v <= top);
  });

  /** Peaks in view, with pixel positions. */
  const visible = $derived(
    peaks
      .map((g, i) => ({ g, i, x: toX(peakUs[i]) }))
      .filter((p) => p.x >= M.left - 2 && p.x <= M.left + plotW + 2),
  );

  /** Heights (pixels from the top) of the curve at each visible peak, for label placement. */
  function topOf(u: number): number {
    if (!profile) return baseline;
    const i = lowerBound(us, u);
    let max = 0;
    for (let j = Math.max(0, i - 3); j < Math.min(us.length, i + 4); j++)
      max = Math.max(max, profile.intensity[j]);
    return toY(yTransform(max, scale));
  }

  const labelled = $derived.by(() => {
    if (!labels) return [];
    const kept = thinLabels(
      visible.map((v, k) => ({ index: k, x: v.x, priority: v.g.I })),
      12,
      60,
    );
    return kept.map((k) => {
      const v = visible[k];
      const text = v.g.members
        .slice(0, 2)
        .map((m) => m.hkl.join(' '))
        .join(' / ');
      return { ...v, text, y: Math.max(M.top + 4, topOf(peakUs[v.i]) - 5) };
    });
  });

  // ---- interaction ------------------------------------------------------------------------------

  const local = (e: PointerEvent | WheelEvent): [number, number] => {
    const r = svg!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  function nearest(px: number): MergedPeak | null {
    let best: MergedPeak | null = null;
    let bestD = 7;
    for (const v of visible) {
      const d = Math.abs(v.x - px);
      if (d < bestD) {
        bestD = d;
        best = v.g;
      }
    }
    return best;
  }

  let dragging: { id: number; x: number; u0: number; u1: number; moved: boolean } | null = null;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    svg!.setPointerCapture(e.pointerId);
    dragging = { id: e.pointerId, x: e.clientX, u0: view.u0, u1: view.u1, moved: false };
  }

  function onPointerMove(e: PointerEvent) {
    if (dragging && dragging.id === e.pointerId) {
      const dx = e.clientX - dragging.x;
      if (!dragging.moved && Math.abs(dx) > 3) dragging.moved = true;
      if (dragging.moved) {
        const du = (dx / plotW) * (dragging.u1 - dragging.u0);
        view.u0 = dragging.u0 - du;
        view.u1 = dragging.u1 - du;
        hover = null;
        return;
      }
    }
    const [px, py] = local(e);
    const g = px >= M.left && px <= M.left + plotW ? nearest(px) : null;
    hover = g ? { group: g, x: px, y: py } : null;
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging || dragging.id !== e.pointerId) return;
    const click = !dragging.moved;
    dragging = null;
    if (!click) return;
    const [px] = local(e);
    const g = nearest(px);
    onSelect?.(g ? g.members[0].hkl.join(' ') : null);
  }

  function zoomAt(factor: number, px = M.left + plotW / 2) {
    const u = fromX(px);
    const span = (view.u1 - view.u0) / factor;
    const t = (px - M.left) / plotW;
    view.u0 = u - t * span;
    view.u1 = u + (1 - t) * span;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * 0.0015), local(e)[0]);
  }

  export function fit() {
    if (!profile || us.length < 2) return;
    view.u0 = us[0];
    view.u1 = us[us.length - 1];
    // On the d axis the low-angle end is a long empty stretch up to the first peak: start just
    // before it. (2θ and Q show the whole range that was asked for.)
    if (axis === 'd' && peakUs.length > 0) {
      const first = Math.min(...peakUs);
      view.u0 = Math.max(view.u0, first - 0.1 * (view.u1 - first));
    }
  }
  export const zoomIn = () => zoomAt(1.4);
  export const zoomOut = () => zoomAt(1 / 1.4);
  /** The SVG element, for the export. */
  export const svgElement = () => svg;
  export const drawnLabels = () => labelled.length;
  export const visiblePeaks = () => visible.length;
  /** Client position of the tick of a peak group (tests), or null when it is out of view. */
  export function peakClient(key: string): { x: number; y: number } | null {
    const v = visible.find((p) => p.g.members.some((m) => m.hkl.join(' ') === key));
    if (!v || !svg) return null;
    const r = svg.getBoundingClientRect();
    return { x: r.left + v.x, y: r.top + baseline + TICK_ROW / 2 };
  }

  const fmt = (x: number, d = 4) => x.toFixed(d);
  const selectedX = $derived.by(() => {
    if (!selected) return null;
    const v = visible.find((p) => p.g.members.some((m) => m.hkl.join(' ') === selected));
    return v ? v.x : null;
  });
</script>

<div class="wrap" bind:clientWidth={width}>
  {#if width > 0}
    <svg
      bind:this={svg}
      {width}
      height={HEIGHT}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      role="img"
      aria-label="Powder diffraction pattern"
      data-testid="pxrd-plot"
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={() => (dragging = null)}
      onpointerleave={() => (hover = null)}
      onwheel={onWheel}
      ondblclick={fit}
    >
      <rect x="0" y="0" {width} height={HEIGHT} fill="#ffffff" />
      <clipPath id="pxrd-clip"
        ><rect x={M.left} y={M.top} width={plotW} height={plotH + 1} /></clipPath
      >

      <!-- grid and axes -->
      {#each xTicks as t (t)}
        <line x1={toX(t)} x2={toX(t)} y1={M.top} y2={M.top + plotH} class="grid" />
        <line x1={toX(t)} x2={toX(t)} y1={M.top + plotH} y2={M.top + plotH + 5} class="axis" />
        <text x={toX(t)} y={M.top + plotH + 18} class="tick" text-anchor="middle"
          >{tickText(axis, t)}</text
        >
      {/each}
      {#each yTicks as t (t)}
        <line
          x1={M.left}
          x2={M.left + plotW}
          y1={toY(yTransform(t, scale))}
          y2={toY(yTransform(t, scale))}
          class="grid"
        />
        <text x={M.left - 7} y={toY(yTransform(t, scale)) + 4} class="tick" text-anchor="end"
          >{t}</text
        >
      {/each}
      <rect x={M.left} y={M.top} width={plotW} height={plotH} class="frame" />
      <text x={M.left + plotW / 2} y={HEIGHT - 6} class="title" text-anchor="middle"
        >{axisTitle(axis)}</text
      >
      <text
        x="14"
        y={M.top + plotH / 2}
        class="title"
        text-anchor="middle"
        transform={`rotate(-90 14 ${M.top + plotH / 2})`}
        >Intensity (% of the highest peak){scale === 'sqrt' ? ', √ scale' : ''}</text
      >

      <g clip-path="url(#pxrd-clip)">
        {#if selectedX !== null}
          <line
            x1={selectedX}
            x2={selectedX}
            y1={M.top}
            y2={M.top + plotH}
            class="sel"
            data-testid="pxrd-selected"
          />
        {/if}
        <polyline points={curve} class="curve" data-testid="pxrd-curve" />
        <!-- one tick per peak, under the pattern -->
        {#each visible as v (v.i)}
          <line
            x1={v.x}
            x2={v.x}
            y1={baseline + 3}
            y2={baseline + TICK_ROW - 3}
            class="stick"
            data-testid="pxrd-tick"
          />
        {/each}
        {#each labelled as l (l.i)}
          <text x={l.x + 3.5} y={l.y} class="hkl" transform={`rotate(-90 ${l.x + 3.5} ${l.y})`}
            >{l.text}</text
          >
        {/each}
      </g>
    </svg>

    {#if hover}
      {@const g = hover.group}
      <div
        class="tip"
        data-testid="pxrd-tooltip"
        style:left={`${Math.min(hover.x + 14, width - 190)}px`}
        style:top={`${Math.max(8, hover.y - 96)}px`}
      >
        <strong>{g.members.map((m) => `(${m.hkl.join(' ')})`).join(' ')}</strong>
        <div>d {fmt(g.d)} Å</div>
        <div>2θ {fmt(g.twoTheta, 3)}°</div>
        <div>m {g.m}</div>
        <div>I {fmt(g.I, 2)}</div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    width: 100%;
  }
  svg {
    display: block;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  svg:active {
    cursor: grabbing;
  }
  .grid {
    stroke: #e5e8ef;
    stroke-width: 1;
  }
  .axis {
    stroke: #64748b;
  }
  .frame {
    fill: none;
    stroke: #94a3b8;
  }
  .tick {
    font: 11px var(--mono);
    fill: #475569;
  }
  .title {
    font: 12px var(--sans);
    fill: #334155;
  }
  .curve {
    fill: none;
    stroke: #1d4ed8;
    stroke-width: 1.3;
    stroke-linejoin: round;
  }
  .stick {
    stroke: #dc2626;
    stroke-width: 1.2;
  }
  .sel {
    stroke: #f59e0b;
    stroke-width: 2;
    stroke-opacity: 0.8;
  }
  .hkl {
    font: 10px var(--mono);
    fill: #334155;
    pointer-events: none;
  }
  .tip {
    position: absolute;
    pointer-events: none;
    padding: 0.35rem 0.55rem;
    border-radius: 6px;
    background: rgba(20, 24, 33, 0.94);
    color: #f1f3f8;
    font: 0.75rem/1.35 var(--mono);
    white-space: nowrap;
    z-index: 3;
  }
</style>
