<script lang="ts" module>
  import type { Crystal } from '../core/crystal';

  export interface Loaded {
    crystal: Crystal | null;
    fileName: string;
    warnings: string[];
  }
</script>

<script lang="ts">
  // Opening a structure: a CIF from disk (button or drag and drop), with a chooser when the file
  // has several data blocks. COD search (M9) will sit next to the file button.
  import { parseCif, type BlockOutcome } from '../core/cif';
  import { buildCrystal } from '../core/crystal';
  import SpaceGroupSymbol from './SpaceGroupSymbol.svelte';

  let { onLoad }: { onLoad: (loaded: Loaded) => void } = $props();

  let fileName = $state('');
  let error = $state('');
  let outcomes = $state.raw<BlockOutcome[]>([]);
  let block = $state(0);
  let crystal = $state.raw<Crystal | null>(null);
  let dragging = $state(false);
  let input: HTMLInputElement;

  function select(index: number) {
    block = index;
    crystal = null;
    error = '';
    const o = outcomes[index];
    if (!o?.structure) {
      onLoad({ crystal: null, fileName, warnings: [] });
      return;
    }
    try {
      const built = buildCrystal(o.structure);
      crystal = built.crystal;
      onLoad({
        crystal: built.crystal,
        fileName,
        warnings: [...o.warnings, ...built.warnings].map((w) => w.message),
      });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      onLoad({ crystal: null, fileName, warnings: [] });
    }
  }

  async function open(file: File) {
    fileName = file.name;
    error = '';
    outcomes = [];
    crystal = null;
    try {
      outcomes = parseCif(await file.text());
      const first = outcomes.findIndex((o) => o.structure);
      if (first === -1) {
        error = outcomes[0]?.error ?? 'No structure found in this file.';
        onLoad({ crystal: null, fileName, warnings: [] });
      } else select(first);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      onLoad({ crystal: null, fileName, warnings: [] });
    }
  }

  function onFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) void open(file);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) void open(file);
  }
</script>

<section
  class="load card"
  class:dragging
  aria-label="Open a structure"
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
>
  <div class="actions">
    <button type="button" class="primary" onclick={() => input.click()}>
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"
        ><path
          d="M3 5.5A1.5 1.5 0 0 1 4.5 4h3.6l1.6 1.8h5.8A1.5 1.5 0 0 1 17 7.3v7.2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z"
          fill="currentColor"
        /></svg
      >
      Open CIF…
    </button>
    <input
      bind:this={input}
      class="file"
      type="file"
      accept=".cif,.txt"
      onchange={onFile}
      data-testid="cif-input"
      aria-label="CIF file"
    />
    <span class="hint">or drop a .cif file here</span>
  </div>

  {#if crystal}
    <div class="current" data-testid="loaded">
      <span class="file-name">{fileName}</span>
      <span class="chip strong">{crystal.summary.formula}</span>
      {#if crystal.spaceGroup.symbol}
        <span class="chip"
          ><SpaceGroupSymbol symbol={crystal.spaceGroup.symbol} /> · No. {crystal.spaceGroup
            .number ?? '?'}</span
        >
      {/if}
      {#if crystal.spaceGroup.crystalSystem}<span class="chip"
          >{crystal.spaceGroup.crystalSystem}</span
        >{/if}
    </div>
  {/if}

  {#if outcomes.length > 1}
    <label class="block">
      Data block
      <select value={block} onchange={(e) => select(Number(e.currentTarget.value))}>
        {#each outcomes as o, i (i)}
          <option value={i} disabled={!o.structure}
            >{o.name}{o.structure ? '' : ' (no structure)'}</option
          >
        {/each}
      </select>
    </label>
  {/if}

  {#if error}<p class="err" data-testid="error">{fileName}: {error}</p>{/if}
</section>

<style>
  .load {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1.25rem;
    padding: 0.7rem 1rem;
    transition:
      border-color 0.12s,
      background 0.12s;
  }
  .load.dragging {
    border-color: var(--accent);
    border-style: dashed;
    background: var(--accent-soft);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .primary {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.9rem;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    border-color: #4f46e5;
  }
  .primary:hover:not(:disabled) {
    color: #fff;
    background: linear-gradient(135deg, #4f46e5, #4338ca);
  }
  /* Visually hidden, still reachable by tests and assistive technology through the button. */
  .file {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
  .hint {
    font-size: 0.82rem;
    color: var(--muted);
  }
  .current {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
  .file-name {
    font-family: var(--mono);
    font-size: 0.85rem;
    color: var(--text-h);
    margin-right: 0.2rem;
  }
  .chip {
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    font-size: 0.82rem;
  }
  .chip.strong {
    color: var(--accent-ink);
    background: var(--accent-soft);
    border-color: transparent;
    font-weight: 600;
  }
  .block {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.85rem;
  }
  .err {
    flex-basis: 100%;
    margin: 0;
    color: var(--err);
    font-size: 0.85rem;
  }
</style>
