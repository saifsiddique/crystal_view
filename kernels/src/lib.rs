//! CrystalLens numerical kernels. M0 only exposes a version string and a typed-array sum,
//! which prove the Rust -> WASM -> Web Worker pipeline end to end. The Bloch-wave solver
//! arrives in M11.

use wasm_bindgen::prelude::*;

/// Version of this crate, so the UI can show which kernel build it loaded.
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Sums a `Float64Array`. Exists to prove typed arrays cross the WASM boundary.
#[wasm_bindgen]
pub fn sum_f64(values: &[f64]) -> f64 {
    values.iter().sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_matches_cargo() {
        assert_eq!(version(), env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn sums_values() {
        assert_eq!(sum_f64(&[1.0, 2.0, 3.5]), 6.5);
        assert_eq!(sum_f64(&[]), 0.0);
    }
}
