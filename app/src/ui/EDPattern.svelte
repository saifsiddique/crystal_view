<script lang="ts">
  // The spot pattern (kinematic, M8, or dynamical, M11) as SVG: wheel to zoom about the pointer, drag to
  // pan, hover for a spot's data, and (with Measure on) click two spots to compare them.
  import type { Pattern, Spot } from '../core/diffraction/electron';
  import type { HolzLine, KikuchiBand, LaueRing } from '../core/diffraction/kikuchi';
  import {
    hklText,
    indexPieces,
    isLowIndex,
    maxSpotRadius,
    measureSpots,
    niceLength,
    placeLabels,
    spotRadius,
    type LabelCandidate,
  } from '../plots/edPlot';
  import type { EDSettings } from '../state/settings';

  export interface PatternView {
    /** Centre of the panel, 1/angstrom. */
    cx: number;
    cy: number;
    /** Half the width of the panel, 1/angstrom. */
    half: number;
  }

  /** The geometric overlays (M10), all in detector coordinates (1/angstrom). */
  export interface Overlay {
    bands: KikuchiBand[];
    rings: LaueRing[];
    holz: HolzLine[];
    /** Radius of the transmitted CBED disc, or null when it is not shown. */
    disc: number | null;
  }

  let {
    pattern,
    settings,
    view = $bindable(),
    measuring = false,
    selected = $bindable([]),
    overlay = { bands: [], rings: [], holz: [], disc: null },
    dragMode = 'pan',
    onTilt,
  }: {
    pattern: Pattern | null;
    settings: EDSettings;
    view: PatternView;
    measuring?: boolean;
    /** Keys ("h k l") of the spots picked for measuring, in click order. */
    selected?: string[];
    overlay?: Overlay;
    /** What a drag does: move the view, or tilt the crystal so that the pattern follows the pointer. */
    dragMode?: 'pan' | 'tilt';
    /** Tilt request in detector units (1/angstrom, x right, y up) from a drag in tilt mode. */
    onTilt?: (dx: number, dy: number) => void;
  } = $props();

  let size = $state(0);
  let svg = $state<SVGSVGElement>();
  let hover = $state<{ spot: Spot; x: number; y: number } | null>(null);

  const scale = $derived(size > 0 ? size / 2 / view.half : 1);
  const toX = (gx: number) => size / 2 + (gx - view.cx) * scale;
  const toY = (gy: number) => size / 2 - (gy - view.cy) * scale;

  // dark and saturated: the pattern is drawn on white
  const ZONE_COLOURS = ['#111827', '#2563eb', '#db2777', '#059669'];
  const zoneColour = (n: number) => ZONE_COLOURS[Math.min(Math.abs(n), ZONE_COLOURS.length - 1)];

  interface Drawn {
    spot: Spot;
    key: string;
    x: number;
    y: number;
    r: number;
  }

  const maxR = $derived(maxSpotRadius(scale));

  /** Spots inside the panel, in pixels, strongest last so they are drawn on top. */
  const drawn = $derived.by((): Drawn[] => {
    if (!pattern || size === 0) return [];
    const out: Drawn[] = [];
    const margin = 20;
    for (const s of pattern.spots) {
      const x = toX(s.x);
      const y = toY(s.y);
      if (x < -margin || y < -margin || x > size + margin || y > size + margin) continue;
      const r = s.forbidden
        ? Math.max(2.5, maxR * 0.45)
        : spotRadius(s.I, settings.intensityScale, maxR, settings.exposure);
      if (r <= 0) continue;
      out.push({ spot: s, key: hklText(s.hkl), x, y, r });
    }
    out.sort((a, b) => a.spot.I - b.spot.I);
    return out.length > 6000 ? out.slice(out.length - 6000) : out;
  });

  const LABEL_H = 11;
  const labels = $derived.by(() => {
    if (settings.labels === 'none') return [];
    const candidates: LabelCandidate[] = [];
    drawn.forEach((d, i) => {
      if (settings.labels === 'low' && !isLowIndex(d.spot.hkl)) return;
      // no labels on specks
      if (!d.spot.forbidden && d.r < 1.5) return;
      const chars = d.spot.hkl.reduce((n, x) => n + String(Math.abs(x)).length, 0) + 2;
      candidates.push({
        index: i,
        x: d.x,
        y: d.y,
        r: d.r,
        width: chars * 6.2,
        height: LABEL_H,
        // strong and near the centre first
        priority: (d.spot.forbidden ? 0 : d.spot.I) - 1e-3 * d.spot.g,
      });
    });
    return placeLabels(candidates, size, size).map((p) => ({ ...p, drawn: drawn[p.index] }));
  });

  // ---- Kikuchi bands, rings, CBED disc ------------------------------------------------------

  /** The two ends, in pixels, of the line {P : P·(ex, ey) = D}, centred near the view. */
  function lineEnds(ex: number, ey: number, D: number) {
    const tx = -ey;
    const ty = ex;
    const along = tx * view.cx + ty * view.cy;
    const fx = D * ex + along * tx;
    const fy = D * ey + along * ty;
    const L = 2.4 * view.half;
    return {
      x1: toX(fx - L * tx),
      y1: toY(fy - L * ty),
      x2: toX(fx + L * tx),
      y2: toY(fy + L * ty),
    };
  }

  const reach = $derived(1.45 * view.half);
  const inView = (ex: number, ey: number, D: number) =>
    Math.abs(D - (ex * view.cx + ey * view.cy)) <= reach;

  const bandLines = $derived.by(() => {
    if (size === 0) return [];
    return overlay.bands
      .filter((b) => inView(b.ex, b.ey, b.D1) || inView(b.ex, b.ey, b.D2))
      .map((b) => ({
        key: hklText(b.hkl),
        band: b,
        a: lineEnds(b.ex, b.ey, b.D1),
        b: lineEnds(b.ex, b.ey, b.D2),
        w: 0.6 + 2.2 * Math.sqrt(Math.min(1, b.I)),
      }));
  });

  /** Band names at the band centre, nearest to the view centre; the strongest few only. */
  const bandLabels = $derived.by(() => {
    if (settings.labels === 'none') return [];
    const out: { key: string; x: number; y: number; band: KikuchiBand }[] = [];
    for (const l of bandLines) {
      const b = l.band;
      const mid = (b.D1 + b.D2) / 2;
      const tx = -b.ey;
      const ty = b.ex;
      const along = tx * view.cx + ty * view.cy;
      const x = toX(mid * b.ex + along * tx);
      const y = toY(mid * b.ey + along * ty);
      if (x < 8 || y < 8 || x > size - 40 || y > size - 8) continue;
      out.push({ key: l.key, x, y, band: b });
      if (out.length >= 10) break;
    }
    return out;
  });

  const ringPx = $derived(
    overlay.rings
      .filter((r) => r.allowed)
      .map((r) => ({ ring: r, x: toX(r.cx), y: toY(r.cy), r: r.radius * scale })),
  );
  const ringName = (n: number) => (n === 1 ? 'FOLZ' : n === 2 ? 'SOLZ' : `HOLZ n=${n}`);

  const holzSegments = $derived.by(() => {
    if (size === 0 || overlay.disc === null) return [];
    return overlay.holz.map((h) => {
      const tx = -h.ey;
      const ty = h.ex;
      const px = h.D * h.ex;
      const py = h.D * h.ey;
      return {
        key: hklText(h.hkl),
        h,
        x1: toX(px - h.half * tx),
        y1: toY(py - h.half * ty),
        x2: toX(px + h.half * tx),
        y2: toY(py + h.half * ty),
        w: 0.8 + 1.8 * Math.sqrt(Math.min(1, h.I * 100)),
      };
    });
  });

  // ---- scale bar ---------------------------------------------------------------------------

  const bar = $derived.by(() => {
    if (size === 0) return null;
    const g = niceLength((size * 0.22) / scale);
    return { g, px: g * scale };
  });
  const fmtG = (g: number) => (g >= 1 ? g.toFixed(g % 1 ? 1 : 0) : g.toPrecision(1));

  // ---- measuring ---------------------------------------------------------------------------

  const picked = $derived(
    selected
      .map((k) => pattern?.spots.find((s) => hklText(s.hkl) === k))
      .filter((s): s is Spot => s !== undefined),
  );
  export const measurement = () =>
    picked.length === 2 ? { spots: picked, ...measureSpots(picked[0], picked[1]) } : null;

  // ---- pointer -----------------------------------------------------------------------------

  function local(e: PointerEvent | WheelEvent): [number, number] {
    const r = svg!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function spotAt(px: number, py: number): Drawn | null {
    let best: Drawn | null = null;
    let bestD = Infinity;
    for (const d of drawn) {
      const dist = Math.hypot(d.x - px, d.y - py);
      if (dist <= Math.max(d.r, 4) + 3 && dist < bestD) {
        best = d;
        bestD = dist;
      }
    }
    return best;
  }

  let drag: {
    id: number;
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    cx: number;
    cy: number;
    moved: boolean;
  } | null = null;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    svg!.setPointerCapture(e.pointerId);
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      cx: view.cx,
      cy: view.cy,
      moved: false,
    };
  }

  function onPointerMove(e: PointerEvent) {
    if (drag && drag.id === e.pointerId) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 3) drag.moved = true;
      if (drag.moved) {
        hover = null;
        if (dragMode === 'tilt' && onTilt) {
          // the pattern follows the pointer: tilt by the step since the last move
          onTilt((e.clientX - drag.lastX) / scale, -(e.clientY - drag.lastY) / scale);
          drag.lastX = e.clientX;
          drag.lastY = e.clientY;
        } else {
          view.cx = drag.cx - dx / scale;
          view.cy = drag.cy + dy / scale;
        }
        return;
      }
    }
    const [px, py] = local(e);
    const d = spotAt(px, py);
    hover = d ? { spot: d.spot, x: px, y: py } : null;
  }

  function onPointerUp(e: PointerEvent) {
    if (!drag || drag.id !== e.pointerId) return;
    const click = !drag.moved;
    drag = null;
    if (!click || !measuring) return;
    const [px, py] = local(e);
    const d = spotAt(px, py);
    if (!d) return;
    if (selected.includes(d.key)) selected = selected.filter((k) => k !== d.key);
    else selected = [...selected, d.key].slice(-2);
  }

  const MIN_HALF = 0.05;
  const MAX_HALF = 8;

  /** Zoom by `factor` (> 1 zooms in) keeping the point at pixel (px, py) where it is. */
  function zoomAt(factor: number, px = size / 2, py = size / 2) {
    const half = Math.min(MAX_HALF, Math.max(MIN_HALF, view.half / factor));
    const gx = view.cx + (px - size / 2) / scale;
    const gy = view.cy - (py - size / 2) / scale;
    const s2 = size / 2 / half;
    view.cx = gx - (px - size / 2) / s2;
    view.cy = gy + (py - size / 2) / s2;
    view.half = half;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const [px, py] = local(e);
    zoomAt(Math.exp(-e.deltaY * 0.0015), px, py);
  }

  export function fit() {
    view.cx = 0;
    view.cy = 0;
    view.half = settings.gMax * 1.08;
  }
  export const zoomIn = () => zoomAt(1.25);
  export const zoomOut = () => zoomAt(0.8);

  /** Client coordinates of a spot (for tests), or null when it is not drawn. */
  export function spotClient(key: string): { x: number; y: number } | null {
    const d = drawn.find((s) => s.key === key);
    if (!d || !svg) return null;
    const r = svg.getBoundingClientRect();
    return { x: r.left + d.x, y: r.top + d.y };
  }
  /** The SVG element, for the export. */
  export const svgElement = () => svg;
  export const drawnCount = () => drawn.length;
  export const labelCount = () => labels.length;
  export const pxPerInvA = () => scale;

  const fmt = (x: number, d = 4) => x.toFixed(d);
</script>

<div class="wrap" bind:clientWidth={size}>
  {#if size > 0}
    <svg
      bind:this={svg}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      data-testid="ed-pattern"
      role="img"
      aria-label="Electron diffraction pattern"
      class:measuring
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={() => (drag = null)}
      onpointerleave={() => (hover = null)}
      onwheel={onWheel}
      ondblclick={fit}
    >
      <rect width={size} height={size} fill="#ffffff" data-export-bg />

      <!-- Kikuchi bands: the pair of lines of +g and -g, 2 theta_B apart -->
      {#each bandLines as l (l.key)}
        <polygon
          points={`${l.a.x1},${l.a.y1} ${l.a.x2},${l.a.y2} ${l.b.x2},${l.b.y2} ${l.b.x1},${l.b.y1}`}
          fill="#7c3aed"
          fill-opacity="0.015"
          data-testid="ed-kikuchi-band"
        />
        <line x1={l.a.x1} y1={l.a.y1} x2={l.a.x2} y2={l.a.y2} class="kik" stroke-width={l.w} />
        <line x1={l.b.x1} y1={l.b.y1} x2={l.b.x2} y2={l.b.y2} class="kik" stroke-width={l.w} />
      {/each}

      <!-- CBED: the transmitted disc and the HOLZ lines inside it -->
      {#if overlay.disc !== null}
        <circle
          cx={toX(0)}
          cy={toY(0)}
          r={overlay.disc * scale}
          fill="#0ea5e9"
          fill-opacity="0.07"
          stroke="#0284c7"
          stroke-width="1.2"
          data-testid="ed-disc"
        />
        {#each holzSegments as s (s.key)}
          <line
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke="#dc2626"
            stroke-width={s.w}
            stroke-linecap="round"
            data-testid="ed-holz-line"
          />
        {/each}
      {/if}

      <!-- HOLZ rings: where the Ewald sphere cuts the higher Laue layers -->
      {#each ringPx as r (r.ring.n)}
        <circle
          cx={r.x}
          cy={r.y}
          r={r.r}
          fill="none"
          stroke="#0d9488"
          stroke-width="1.4"
          stroke-dasharray="6 4"
          data-testid="ed-ring"
        />
        {#if r.x + r.r * 0.7071 > 0 && r.y - r.r * 0.7071 > 12 && r.x + r.r * 0.7071 < size - 120 && r.y - r.r * 0.7071 < size}
          <text x={r.x + r.r * 0.7071 + 4} y={r.y - r.r * 0.7071} class="ring">
            {ringName(r.ring.n)} · {fmt(r.ring.radius, 2)} Å⁻¹
          </text>
        {/if}
      {/each}
      {#each drawn as d (d.key)}
        {#if d.spot.forbidden}
          <circle
            cx={d.x}
            cy={d.y}
            r={d.r}
            fill="none"
            stroke="#d97706"
            stroke-width="1"
            stroke-dasharray="2 1.5"
          />
        {:else}
          <circle cx={d.x} cy={d.y} r={d.r} fill={zoneColour(d.spot.zone)} />
          {#if d.spot.kinematicallyForbidden && settings.showForbidden}
            <!-- dynamical pattern: lit only by multiple scattering -->
            <circle
              cx={d.x}
              cy={d.y}
              r={d.r + 2}
              fill="none"
              stroke="#d97706"
              stroke-width="1"
              stroke-dasharray="2 1.5"
              data-testid="ed-double"
            />
          {/if}
        {/if}
      {/each}
      <!-- transmitted beam -->
      <circle
        cx={toX(0)}
        cy={toY(0)}
        r={maxR * 1.15}
        fill="#ffffff"
        stroke="#111827"
        stroke-width="2"
        data-testid="ed-central"
      />

      {#each picked as s, i (hklText(s.hkl))}
        <line
          x1={toX(0)}
          y1={toY(0)}
          x2={toX(s.x)}
          y2={toY(s.y)}
          stroke="#f59e0b"
          stroke-width="1.5"
          stroke-dasharray={i === 0 ? '' : '4 3'}
        />
        <circle
          cx={toX(s.x)}
          cy={toY(s.y)}
          r={maxR + 4}
          fill="none"
          stroke="#f59e0b"
          stroke-width="1.5"
        />
      {/each}

      {#each bandLabels as l (l.key)}
        <text x={l.x + 3} y={l.y - 3} class="klabel">
          {#each indexPieces(l.band.hkl) as p, k (k)}<tspan
              text-decoration={p.bar ? 'overline' : undefined}>{p.text}</tspan
            >{/each}
        </text>
      {/each}

      {#each labels as l (l.drawn.key)}
        <text x={l.x} y={l.y} class="label" class:forb={l.drawn.spot.forbidden}>
          {#each indexPieces(l.drawn.spot.hkl) as p, k (k)}<tspan
              text-decoration={p.bar ? 'overline' : undefined}>{p.text}</tspan
            >{/each}
        </text>
      {/each}

      {#if bar && pattern}
        <g transform={`translate(14, ${size - 16})`} data-testid="ed-scalebar">
          <line x1="0" y1="0" x2={bar.px} y2="0" stroke="#334155" stroke-width="2" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="#334155" stroke-width="1.5" />
          <line x1={bar.px} y1="-4" x2={bar.px} y2="4" stroke="#334155" stroke-width="1.5" />
          <text x="0" y="-8" class="bar">{fmtG(bar.g)} Å⁻¹</text>
        </g>
      {/if}
    </svg>

    {#if hover}
      <div
        class="tip"
        data-testid="ed-tooltip"
        style:left={`${Math.min(hover.x + 14, size - 170)}px`}
        style:top={`${Math.min(hover.y + 14, size - 130)}px`}
      >
        <strong
          >({#each indexPieces(hover.spot.hkl) as p, k (k)}<span class:neg={p.bar}>{p.text}</span
            >{#if k < 2}&thinsp;{/if}{/each})</strong
        >
        {#if hover.spot.forbidden}<em>forbidden</em>{/if}
        {#if hover.spot.kinematicallyForbidden}<em>kinematically forbidden</em>{/if}
        <div>d {fmt(hover.spot.d)} Å</div>
        <div>|g| {fmt(hover.spot.g)} Å⁻¹</div>
        <div>|F| {fmt(hover.spot.F, 3)} Å</div>
        {#if hover.spot.fraction !== undefined}
          <div>I {(100 * hover.spot.fraction).toPrecision(3)}% of incident</div>
        {:else}
          <div>I {hover.spot.I.toExponential(2)}</div>
        {/if}
        <div>s<sub>g</sub> {hover.spot.s.toExponential(2)} Å⁻¹</div>
        <div>Laue zone {hover.spot.zone}</div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    border-radius: inherit;
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
  svg.measuring {
    cursor: crosshair;
  }
  .kik {
    stroke: #7c3aed;
    stroke-opacity: 0.55;
    fill: none;
  }
  .klabel {
    font: 10px var(--mono);
    fill: #6d28d9;
    pointer-events: none;
  }
  .ring {
    font: 11px var(--mono);
    fill: #0f766e;
    pointer-events: none;
  }
  .label {
    font: 10px var(--mono);
    fill: #334155;
    pointer-events: none;
  }
  .label.forb {
    fill: #b45309;
  }
  .bar {
    font: 11px var(--mono);
    fill: #334155;
  }
  .tip {
    position: absolute;
    pointer-events: none;
    padding: 0.35rem 0.55rem;
    border-radius: 6px;
    background: rgba(20, 24, 33, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #f1f3f8;
    font: 0.75rem/1.35 var(--mono);
    white-space: nowrap;
    z-index: 3;
  }
  .tip em {
    margin-left: 0.4rem;
    color: #fbbf24;
    font-style: normal;
  }
  .tip .neg {
    text-decoration: overline;
  }
</style>
