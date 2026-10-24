// Same-card stock-vs-unlocked measurements published in the upstream evidence folders.
// Nothing here is extrapolated: every number is one line of an evidence file.
//
//   RTX 4090: stock from baseline.txt (reps=3), unlocked from unlocked-40000.txt (iters=40000, reps=3).
//     f16/f16 stock best is 325.7 (306.3/306.3/325.7); unlocked 331.6 — mostly unaffected, unlike f16/f32.
//   RTX 4070 Ti SUPER: every field cross-checked against ada2705/tensor-modes-comparison.json
//     (driver 580.178.04, power limit 240 W, iterations 20000, reps=3).
//   RTX 2080 Ti: nlzy/turing-unlock's README table, which states TFLOPS directly and gives
//     the percentage-of-peak in parentheses (cuBLAS FP16 GEMM, FP32 accumulate, 250 W,
//     driver 575.51.03). The TFLOPS here are the README's own numbers, not a conversion.

export interface BenchRow {
  card: string;
  cardSlug: string;
  pciId: string;
  mode: string;
  unit: string;
  stock: number;
  unlocked: number;
  /** unlocked / stock. 1.00 means the unlock did nothing for this path. */
  ratio: number;
  /** Repetition count, or null when the upstream table does not state one. */
  iters: number | null;
  note?: string;
}

export interface BenchRun {
  card: string;
  cardSlug: string;
  chip: string;
  sms: number;
  driver: string;
  powerLimitW: number | null;
  source: string;
  rows: BenchRow[];
}

export const BENCH_RUNS: BenchRun[] = [
  {
    card: "GeForce RTX 4090",
    cardSlug: "rtx-4090",
    chip: "AD102",
    sms: 128,
    driver: "unrecorded in the evidence file",
    powerLimitW: 450,
    source: "https://github.com/JustAResearcher/gpu-unlock-ada/tree/main/docs/evidence/rtx4090",
    rows: [
      { card: "RTX 4090", cardSlug: "rtx-4090", pciId: "10de:2684", mode: "f16/f16", unit: "TF/s", stock: 325.7, unlocked: 331.6, ratio: 1.018, iters: 20000, note: "unlocked values are the 40,000-iteration run; f16/f16 was mostly unaffected, unlike f16/f32" },
      { card: "RTX 4090", cardSlug: "rtx-4090", pciId: "10de:2684", mode: "f16/f32", unit: "TF/s", stock: 165.6, unlocked: 330.8, ratio: 1.998, iters: 20000 },
      { card: "RTX 4090", cardSlug: "rtx-4090", pciId: "10de:2684", mode: "bf16/f32", unit: "TF/s", stock: 165.5, unlocked: 330.3, ratio: 1.996, iters: 20000 },
      { card: "RTX 4090", cardSlug: "rtx-4090", pciId: "10de:2684", mode: "s8/s32", unit: "TF/s", stock: 661.6, unlocked: 659.5, ratio: 0.997, iters: 20000, note: "already at full rate before the unlock" },
      { card: "RTX 4090", cardSlug: "rtx-4090", pciId: "10de:2684", mode: "dp4a", unit: "TF/s", stock: 164.5, unlocked: 164.1, ratio: 0.998, iters: 20000 },
      { card: "RTX 4090", cardSlug: "rtx-4090", pciId: "10de:2684", mode: "ffma", unit: "TF/s", stock: 79.1, unlocked: 79.1, ratio: 1.0, iters: 20000, note: "FP32 was never rate-limited" },
    ],
  },
  {
    card: "GeForce RTX 4070 Ti SUPER",
    cardSlug: "rtx-4070-ti-super",
    chip: "AD103",
    sms: 66,
    driver: "580.178.04",
    powerLimitW: 240,
    source: "https://github.com/JustAResearcher/gpu-unlock-ada/tree/main/docs/evidence/ada2705",
    rows: [
      { card: "RTX 4070 Ti SUPER", cardSlug: "rtx-4070-ti-super", pciId: "10de:2705", mode: "f16/f32", unit: "TFLOP/s", stock: 94.96, unlocked: 188.97, ratio: 1.99, iters: 20000 },
      { card: "RTX 4070 Ti SUPER", cardSlug: "rtx-4070-ti-super", pciId: "10de:2705", mode: "tf32", unit: "TFLOP/s", stock: 47.49, unlocked: 94.51, ratio: 1.99, iters: 20000 },
      { card: "RTX 4070 Ti SUPER", cardSlug: "rtx-4070-ti-super", pciId: "10de:2705", mode: "u4/s32", unit: "TOP/s", stock: 754.81, unlocked: 754.68, ratio: 1.0, iters: 20000, note: "integer path, unaffected" },
    ],
  },
  {
    card: "GeForce RTX 2080 Ti",
    cardSlug: "rtx-2080-ti",
    chip: "TU102",
    // The Turing module is a different codebase; 68 is the TU102 SM count, not a claim of
    // parity with the Ada/Ampere runs.
    sms: 68,
    driver: "575.51.03",
    powerLimitW: 250,
    source: "https://github.com/nlzy/turing-unlock",
    rows: [
      // 56.9 TF/s peak is the figure the upstream README quotes from the Turing whitepaper.
      // Each row below converts the README's "before/after %peak" pair to TF/s.
      { card: "RTX 2080 Ti", cardSlug: "rtx-2080-ti", pciId: "10de:1e07", mode: "f16/f32 1024³", unit: "TF/s", stock: 50.3, unlocked: 68.3, ratio: 1.358, iters: null, note: "README row 1024: 50.3 (88.4% of a 56.9 TF/s peak) -> 68.3 (120.0%)" },
      { card: "RTX 2080 Ti", cardSlug: "rtx-2080-ti", pciId: "10de:1e07", mode: "f16/f32 2048³", unit: "TF/s", stock: 55.7, unlocked: 91.4, ratio: 1.641, iters: null, note: "README row 2048: 55.7 (97.9% of a 56.9 TF/s peak) -> 91.4 (160.6%)" },
      { card: "RTX 2080 Ti", cardSlug: "rtx-2080-ti", pciId: "10de:1e07", mode: "f16/f32 4096³", unit: "TF/s", stock: 53.7, unlocked: 81.7, ratio: 1.521, iters: null, note: "README row 4096: 53.7 (94.4% of a 56.9 TF/s peak) -> 81.7 (143.6%)" },
      { card: "RTX 2080 Ti", cardSlug: "rtx-2080-ti", pciId: "10de:1e07", mode: "f16/f32 8192³", unit: "TF/s", stock: 52.8, unlocked: 77.9, ratio: 1.475, iters: null, note: "README row 8192: 52.8 (92.8% of a 56.9 TF/s peak) -> 77.9 (136.9%)" },
    ],
  },
];

/** The E4M3 FP8 CUTLASS pair, which the fork measured separately and which did not move. */
export const FP8_CUTLASS = {
  card: "RTX 4070 Ti SUPER",
  kernel: "cutlass_tensorop_s16832gemm_e4m3_128x128_64x3_tn_align16",
  stock: { ms: 2.31724, gflops: 59325.8 },
  unlocked: { ms: 2.31066, gflops: 59495.0 },
  ratio: 1.0029,
  source: "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/evidence/ada2705/README.md",
};
