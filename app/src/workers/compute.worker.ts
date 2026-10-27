// Heavy-compute worker. Everything slow (> 16 ms) is exposed from here via Comlink so the UI
// thread stays responsive (context.md 5.3).
import * as Comlink from 'comlink';
import { solveBloch, type BlochMatrices, type BlochSolution } from '../core/diffraction/dynamical';
import init, { sum_f64, version } from '../wasm/kernels.js';

let ready: Promise<unknown> | undefined;
const ensureWasm = () => (ready ??= init());

const api = {
  /** Version string of the Rust `kernels` crate, read through the WASM boundary. */
  async wasmVersion(): Promise<string> {
    await ensureWasm();
    return version();
  },
  /** Sums a typed array in WASM; proves typed arrays cross the boundary. */
  async sumF64(values: Float64Array): Promise<number> {
    await ensureWasm();
    return sum_f64(values);
  },
  /** Logical cores available to size the future worker pool (hardwareConcurrency - 1). */
  cores(): number {
    return navigator.hardwareConcurrency ?? 1;
  },
  /** Bloch-wave eigen-decomposition (M11): 0.1-2 s for 100-300 beams, so never on the UI thread. */
  bloch(m: BlochMatrices): BlochSolution {
    const s = solveBloch(m);
    return Comlink.transfer(s, [s.gamma.buffer, s.q.buffer, s.ampRe.buffer, s.ampIm.buffer]);
  },
};

export type ComputeApi = typeof api;
Comlink.expose(api);
