// Heavy-compute worker. Everything slow (> 16 ms) is exposed from here via Comlink so the UI
// thread stays responsive (context.md 5.3). M0 only proves the Comlink + Rust/WASM pipeline.
import * as Comlink from 'comlink';
import init, { sum_f64, version } from '../wasm/kernels.js';

let ready: Promise<unknown> | undefined;
const ensureWasm = () => (ready ??= init());

const api = {
  /** Version string of the Rust `kernels` crate, read through the WASM boundary. */
  async wasmVersion(): Promise<string> {
    await ensureWasm();
    return version();
  },
  /** Sums a typed array in WASM; proves typed arrays cross the boundary (needed from M11). */
  async sumF64(values: Float64Array): Promise<number> {
    await ensureWasm();
    return sum_f64(values);
  },
  /** Logical cores available to size the future worker pool (hardwareConcurrency - 1). */
  cores(): number {
    return navigator.hardwareConcurrency ?? 1;
  },
};

export type ComputeApi = typeof api;
Comlink.expose(api);
