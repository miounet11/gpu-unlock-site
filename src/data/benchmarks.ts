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
      { card: "RTX 4090", cardSlug: "rtx-4090", pciId: "10de:2684", mode: "s8/s32", unit: "TOP/s", stock: 661.6, unlocked: 659.5, ratio: 0.997, iters: 20000, note: "already at full rate before the unlock" },
      { card: "RTX 4090", cardSlug: "rtx-4090", pciId: "10de:2684", mode: "dp4a", unit: "TOP/s", stock: 164.5, unlocked: 164.1, ratio: 0.998, iters: 20000 },
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
  // RTX 4080 and 4080 SUPER share one host and one cold boot. The README reports both cards in
  // the same tables, so each card gets its own run here rather than a merged average.
  {
    card: "GeForce RTX 4080",
    cardSlug: "rtx-4080",
    chip: "AD103",
    sms: 76,
    driver: "595.99.02",
    powerLimitW: 250,
    source:
      "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/evidence/ada2702-ada2704-matched/README.md",
    rows: [
      { card: "RTX 4080", cardSlug: "rtx-4080", pciId: "10de:2704", mode: "f16/f32", unit: "TF/s", stock: 107.0, unlocked: 213.7, ratio: 2.0, iters: 20000 },
      { card: "RTX 4080", cardSlug: "rtx-4080", pciId: "10de:2704", mode: "bf16/f32", unit: "TF/s", stock: 106.9, unlocked: 213.6, ratio: 2.0, iters: 20000 },
      { card: "RTX 4080", cardSlug: "rtx-4080", pciId: "10de:2704", mode: "f16/f16", unit: "TF/s", stock: 214.2, unlocked: 213.9, ratio: 0.999, iters: 20000, note: "control mode, already at full rate" },
      { card: "RTX 4080", cardSlug: "rtx-4080", pciId: "10de:2704", mode: "s8/s32", unit: "TOP/s", stock: 427.1, unlocked: 425.7, ratio: 0.997, iters: 20000, note: "control mode, already at full rate" },
      { card: "RTX 4080", cardSlug: "rtx-4080", pciId: "10de:2704", mode: "dp4a", unit: "TOP/s", stock: 106.0, unlocked: 105.8, ratio: 0.998, iters: 20000, note: "control mode" },
      { card: "RTX 4080", cardSlug: "rtx-4080", pciId: "10de:2704", mode: "ffma", unit: "TF/s", stock: 50.8, unlocked: 50.7, ratio: 0.998, iters: 20000, note: "FP32 was never rate-limited" },
      { card: "RTX 4080", cardSlug: "rtx-4080", pciId: "10de:2704", mode: "cuBLAS f16/f32 4096³", unit: "TF/s", stock: 100.7, unlocked: 194.9, ratio: 1.94, iters: null, note: "cublasGemmEx, CUBLAS_COMPUTE_32F" },
      { card: "RTX 4080", cardSlug: "rtx-4080", pciId: "10de:2704", mode: "cuBLAS f16/f32 8192³", unit: "TF/s", stock: 102.5, unlocked: 164.9, ratio: 1.61, iters: null, note: "power-limited at 250 W, not issue-limited" },
    ],
  },
  {
    card: "GeForce RTX 4080 SUPER",
    cardSlug: "rtx-4080-super",
    chip: "AD103",
    sms: 80,
    driver: "595.99.02",
    powerLimitW: 250,
    source:
      "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/evidence/ada2702-ada2704-matched/README.md",
    rows: [
      { card: "RTX 4080 SUPER", cardSlug: "rtx-4080-super", pciId: "10de:2702", mode: "f16/f32", unit: "TF/s", stock: 104.8, unlocked: 209.7, ratio: 2.0, iters: 20000 },
      { card: "RTX 4080 SUPER", cardSlug: "rtx-4080-super", pciId: "10de:2702", mode: "bf16/f32", unit: "TF/s", stock: 104.8, unlocked: 209.3, ratio: 1.997, iters: 20000 },
      { card: "RTX 4080 SUPER", cardSlug: "rtx-4080-super", pciId: "10de:2702", mode: "f16/f16", unit: "TF/s", stock: 210.1, unlocked: 210.4, ratio: 1.001, iters: 20000, note: "control mode, already at full rate" },
      { card: "RTX 4080 SUPER", cardSlug: "rtx-4080-super", pciId: "10de:2702", mode: "s8/s32", unit: "TOP/s", stock: 418.9, unlocked: 417.0, ratio: 0.995, iters: 20000, note: "control mode" },
      { card: "RTX 4080 SUPER", cardSlug: "rtx-4080-super", pciId: "10de:2702", mode: "dp4a", unit: "TOP/s", stock: 103.9, unlocked: 103.8, ratio: 0.999, iters: 20000, note: "control mode" },
      { card: "RTX 4080 SUPER", cardSlug: "rtx-4080-super", pciId: "10de:2702", mode: "ffma", unit: "TF/s", stock: 49.4, unlocked: 49.7, ratio: 1.006, iters: 20000, note: "FP32 was never rate-limited" },
      { card: "RTX 4080 SUPER", cardSlug: "rtx-4080-super", pciId: "10de:2702", mode: "cuBLAS f16/f32 4096³", unit: "TF/s", stock: 98.7, unlocked: 190.7, ratio: 1.93, iters: null },
      { card: "RTX 4080 SUPER", cardSlug: "rtx-4080-super", pciId: "10de:2702", mode: "cuBLAS f16/f32 8192³", unit: "TF/s", stock: 100.9, unlocked: 177.7, ratio: 1.76, iters: null, note: "power-limited at 250 W" },
    ],
  },
  {
    card: "GeForce RTX 4070 (AD103)",
    cardSlug: "rtx-4070",
    chip: "AD103",
    sms: 46,
    driver: "595.99.02",
    powerLimitW: 200,
    source: "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2709-report.md",
    rows: [
      { card: "RTX 4070", cardSlug: "rtx-4070", pciId: "10de:2709", mode: "f16/f16", unit: "TF/s", stock: 132.6, unlocked: 132.2, ratio: 0.997, iters: 20000, note: "control mode, already at full rate" },
      { card: "RTX 4070", cardSlug: "rtx-4070", pciId: "10de:2709", mode: "f16/f32", unit: "TF/s", stock: 66.3, unlocked: 132.2, ratio: 1.994, iters: 20000 },
      { card: "RTX 4070", cardSlug: "rtx-4070", pciId: "10de:2709", mode: "bf16/f32", unit: "TF/s", stock: 66.3, unlocked: 132.0, ratio: 1.991, iters: 20000 },
      { card: "RTX 4070", cardSlug: "rtx-4070", pciId: "10de:2709", mode: "s8/s32", unit: "TOP/s", stock: 265.1, unlocked: 263.7, ratio: 0.995, iters: 20000, note: "control mode" },
      { card: "RTX 4070", cardSlug: "rtx-4070", pciId: "10de:2709", mode: "dp4a", unit: "TOP/s", stock: 65.8, unlocked: 65.7, ratio: 0.998, iters: 20000, note: "control mode" },
      { card: "RTX 4070", cardSlug: "rtx-4070", pciId: "10de:2709", mode: "ffma", unit: "TF/s", stock: 31.7, unlocked: 31.7, ratio: 1.0, iters: 20000, note: "FP32 was never rate-limited" },
      { card: "RTX 4070", cardSlug: "rtx-4070", pciId: "10de:2709", mode: "tf32", unit: "TF/s", stock: 33.1, unlocked: 65.8, ratio: 1.988, iters: null, note: "tensor_modes_issue through the driver runner, 0 mismatches" },
      { card: "RTX 4070", cardSlug: "rtx-4070", pciId: "10de:2709", mode: "u4/s32", unit: "TOP/s", stock: 527.2, unlocked: 525.7, ratio: 0.997, iters: null, note: "tensor_modes_issue, control mode" },
      { card: "RTX 4070", cardSlug: "rtx-4070", pciId: "10de:2709", mode: "cuBLAS f16/f32 1024³", unit: "TF/s", stock: 49.06, unlocked: 70.14, ratio: 1.43, iters: null, note: "not tensor-bound at this shape" },
      { card: "RTX 4070", cardSlug: "rtx-4070", pciId: "10de:2709", mode: "cuBLAS f16/f32 4096³", unit: "TF/s", stock: 64.04, unlocked: 96.33, ratio: 1.5, iters: null },
      { card: "RTX 4070", cardSlug: "rtx-4070", pciId: "10de:2709", mode: "cuBLAS f16/f32 8192³", unit: "TF/s", stock: 64.42, unlocked: 93.63, ratio: 1.45, iters: null, note: "power-limited at 200 W" },
    ],
  },
  {
    card: "GeForce RTX 4070 Ti",
    cardSlug: "rtx-4070-ti",
    chip: "AD104",
    sms: 60,
    driver: "595.99.02",
    powerLimitW: 285,
    source: "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2782-report.md",
    rows: [
      { card: "RTX 4070 Ti", cardSlug: "rtx-4070-ti", pciId: "10de:2782", mode: "f16/f16", unit: "TF/s", stock: 169.4, unlocked: 170.0, ratio: 1.004, iters: 20000, note: "control mode, already at full rate" },
      { card: "RTX 4070 Ti", cardSlug: "rtx-4070-ti", pciId: "10de:2782", mode: "f16/f32", unit: "TF/s", stock: 84.8, unlocked: 169.4, ratio: 1.998, iters: 20000 },
      { card: "RTX 4070 Ti", cardSlug: "rtx-4070-ti", pciId: "10de:2782", mode: "bf16/f32", unit: "TF/s", stock: 84.7, unlocked: 168.9, ratio: 1.994, iters: 20000 },
      { card: "RTX 4070 Ti", cardSlug: "rtx-4070-ti", pciId: "10de:2782", mode: "s8/s32", unit: "TOP/s", stock: 338.8, unlocked: 338.0, ratio: 0.998, iters: 20000, note: "control mode" },
      { card: "RTX 4070 Ti", cardSlug: "rtx-4070-ti", pciId: "10de:2782", mode: "dp4a", unit: "TOP/s", stock: 84.1, unlocked: 84.0, ratio: 0.999, iters: 20000, note: "control mode" },
      { card: "RTX 4070 Ti", cardSlug: "rtx-4070-ti", pciId: "10de:2782", mode: "ffma", unit: "TF/s", stock: 40.1, unlocked: 40.2, ratio: 1.002, iters: 20000, note: "FP32 was never rate-limited" },
      { card: "RTX 4070 Ti", cardSlug: "rtx-4070-ti", pciId: "10de:2782", mode: "tf32", unit: "TF/s", stock: 42.4, unlocked: 84.0, ratio: 1.981, iters: null, note: "tensor_modes_issue, 0 mismatches" },
      { card: "RTX 4070 Ti", cardSlug: "rtx-4070-ti", pciId: "10de:2782", mode: "u4/s32", unit: "TOP/s", stock: 673.9, unlocked: 672.4, ratio: 0.998, iters: null, note: "control mode" },
      { card: "RTX 4070 Ti", cardSlug: "rtx-4070-ti", pciId: "10de:2782", mode: "cuBLAS f16/f32 1024³", unit: "TF/s", stock: 51.9, unlocked: 77.8, ratio: 1.5, iters: null },
      { card: "RTX 4070 Ti", cardSlug: "rtx-4070-ti", pciId: "10de:2782", mode: "cuBLAS f16/f32 4096³", unit: "TF/s", stock: 79.8, unlocked: 154.0, ratio: 1.93, iters: null },
      { card: "RTX 4070 Ti", cardSlug: "rtx-4070-ti", pciId: "10de:2782", mode: "cuBLAS f16/f32 8192³", unit: "TF/s", stock: 83.4, unlocked: 162.1, ratio: 1.94, iters: null },
    ],
  },
  {
    card: "GeForce RTX 4070 SUPER",
    cardSlug: "rtx-4070-super",
    chip: "AD104",
    sms: 56,
    driver: "595.99.02",
    powerLimitW: 242,
    source: "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2783-report.md",
    rows: [
      { card: "RTX 4070 SUPER", cardSlug: "rtx-4070-super", pciId: "10de:2783", mode: "f16/f16", unit: "TF/s", stock: 153.4, unlocked: 153.6, ratio: 1.001, iters: 20000, note: "control mode, already at full rate" },
      { card: "RTX 4070 SUPER", cardSlug: "rtx-4070-super", pciId: "10de:2783", mode: "f16/f32", unit: "TF/s", stock: 76.7, unlocked: 153.6, ratio: 2.003, iters: 20000 },
      { card: "RTX 4070 SUPER", cardSlug: "rtx-4070-super", pciId: "10de:2783", mode: "bf16/f32", unit: "TF/s", stock: 76.7, unlocked: 153.6, ratio: 2.003, iters: 20000 },
      { card: "RTX 4070 SUPER", cardSlug: "rtx-4070-super", pciId: "10de:2783", mode: "s8/s32", unit: "TOP/s", stock: 306.9, unlocked: 307.3, ratio: 1.001, iters: 20000, note: "control mode" },
      { card: "RTX 4070 SUPER", cardSlug: "rtx-4070-super", pciId: "10de:2783", mode: "dp4a", unit: "TOP/s", stock: 76.4, unlocked: 76.5, ratio: 1.001, iters: 20000, note: "control mode" },
      { card: "RTX 4070 SUPER", cardSlug: "rtx-4070-super", pciId: "10de:2783", mode: "ffma", unit: "TF/s", stock: 36.6, unlocked: 36.7, ratio: 1.003, iters: 20000, note: "FP32 was never rate-limited" },
      { card: "RTX 4070 SUPER", cardSlug: "rtx-4070-super", pciId: "10de:2783", mode: "cuBLAS f16/f32 1024³", unit: "TF/s", stock: 49.3, unlocked: 67.5, ratio: 1.37, iters: null, note: "not tensor-bound at this shape" },
      { card: "RTX 4070 SUPER", cardSlug: "rtx-4070-super", pciId: "10de:2783", mode: "cuBLAS f16/f32 4096³", unit: "TF/s", stock: 73.6, unlocked: 122.9, ratio: 1.67, iters: null },
      { card: "RTX 4070 SUPER", cardSlug: "rtx-4070-super", pciId: "10de:2783", mode: "cuBLAS f16/f32 8192³", unit: "TF/s", stock: 75.7, unlocked: 144.4, ratio: 1.91, iters: null },
    ],
  },
  {
    card: "GeForce RTX 4070 (Gigabyte)",
    cardSlug: "rtx-4070-gigabyte",
    chip: "AD104",
    sms: 46,
    driver: "615.78.08",
    powerLimitW: 216,
    source: "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2786-report.md",
    rows: [
      { card: "RTX 4070", cardSlug: "rtx-4070-gigabyte", pciId: "10de:2786", mode: "f16/f16", unit: "TF/s", stock: 133.9, unlocked: 133.9, ratio: 1.0, iters: 20000, note: "control mode, already at full rate" },
      { card: "RTX 4070", cardSlug: "rtx-4070-gigabyte", pciId: "10de:2786", mode: "f16/f32", unit: "TF/s", stock: 67.0, unlocked: 133.8, ratio: 1.997, iters: 20000 },
      { card: "RTX 4070", cardSlug: "rtx-4070-gigabyte", pciId: "10de:2786", mode: "bf16/f32", unit: "TF/s", stock: 66.9, unlocked: 133.7, ratio: 1.999, iters: 20000 },
      { card: "RTX 4070", cardSlug: "rtx-4070-gigabyte", pciId: "10de:2786", mode: "s8/s32", unit: "TOP/s", stock: 267.4, unlocked: 267.4, ratio: 1.0, iters: 20000, note: "control mode" },
      { card: "RTX 4070", cardSlug: "rtx-4070-gigabyte", pciId: "10de:2786", mode: "dp4a", unit: "TOP/s", stock: 66.6, unlocked: 66.6, ratio: 1.0, iters: 20000, note: "control mode" },
      { card: "RTX 4070", cardSlug: "rtx-4070-gigabyte", pciId: "10de:2786", mode: "ffma", unit: "TF/s", stock: 32.1, unlocked: 32.1, ratio: 1.0, iters: 20000, note: "FP32 was never rate-limited" },
    ],
  },
  {
    card: "GeForce RTX 4060 Ti 16GB",
    cardSlug: "rtx-4060-ti-16gb",
    chip: "AD106",
    sms: 34,
    driver: "615.78.08",
    powerLimitW: 165,
    source: "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2803-report.md",
    rows: [
      { card: "RTX 4060 Ti 16GB", cardSlug: "rtx-4060-ti-16gb", pciId: "10de:2803", mode: "f16/f32", unit: "TF/s", stock: 46.4, unlocked: 92.3, ratio: 1.989, iters: null },
      { card: "RTX 4060 Ti 16GB", cardSlug: "rtx-4060-ti-16gb", pciId: "10de:2803", mode: "tf32", unit: "TF/s", stock: 23.2, unlocked: 46.2, ratio: 1.991, iters: null },
      { card: "RTX 4060 Ti 16GB", cardSlug: "rtx-4060-ti-16gb", pciId: "10de:2803", mode: "u4/s32", unit: "TOP/s", stock: 368.7, unlocked: 368.7, ratio: 1.0, iters: null, note: "control mode, already at full rate" },
    ],
  },
  {
    card: "GeForce RTX 4060",
    cardSlug: "rtx-4060",
    chip: "AD107",
    sms: 24,
    driver: "610.43.03",
    powerLimitW: null,
    source: "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2882-report.md",
    rows: [
      { card: "RTX 4060", cardSlug: "rtx-4060", pciId: "10de:2882", mode: "cuBLAS f16/f32 4096³", unit: "TF/s", stock: 29.97, unlocked: 46.49, ratio: 1.55, iters: null, note: "PyTorch cuBLAS, median of 3 reps of 30 calls" },
      { card: "RTX 4060", cardSlug: "rtx-4060", pciId: "10de:2882", mode: "cuBLAS f16/f32 8192³", unit: "TF/s", stock: 31.38, unlocked: 44.23, ratio: 1.41, iters: null },
      { card: "RTX 4060", cardSlug: "rtx-4060", pciId: "10de:2882", mode: "cuBLAS bf16/f32 4096³", unit: "TF/s", stock: 31.46, unlocked: 49.57, ratio: 1.58, iters: null },
      { card: "RTX 4060", cardSlug: "rtx-4060", pciId: "10de:2882", mode: "cuBLAS bf16/f32 8192³", unit: "TF/s", stock: 31.59, unlocked: 45.37, ratio: 1.44, iters: null },
      { card: "RTX 4060", cardSlug: "rtx-4060", pciId: "10de:2882", mode: "cuBLAS tf32 4096³", unit: "TF/s", stock: 15.86, unlocked: 25.86, ratio: 1.63, iters: null },
      { card: "RTX 4060", cardSlug: "rtx-4060", pciId: "10de:2882", mode: "cuBLAS tf32 8192³", unit: "TF/s", stock: 15.89, unlocked: 25.30, ratio: 1.59, iters: null },
      { card: "RTX 4060", cardSlug: "rtx-4060", pciId: "10de:2882", mode: "cuBLAS fp8 4096³", unit: "TF/s", stock: 63.97, unlocked: 96.19, ratio: 1.5, iters: null, note: "torch._scaled_mm, e4m3 inputs" },
      { card: "RTX 4060", cardSlug: "rtx-4060", pciId: "10de:2882", mode: "cuBLAS fp8 8192³", unit: "TF/s", stock: 63.49, unlocked: 100.43, ratio: 1.58, iters: null },
      { card: "RTX 4060", cardSlug: "rtx-4060", pciId: "10de:2882", mode: "cuBLAS f16/f16 4096³", unit: "TF/s", stock: 46.75, unlocked: 52.48, ratio: 1.12, iters: null, note: "control mode, small size carries more run-to-run variation" },
      { card: "RTX 4060", cardSlug: "rtx-4060", pciId: "10de:2882", mode: "cuBLAS f16/f16 8192³", unit: "TF/s", stock: 49.47, unlocked: 49.19, ratio: 0.994, iters: null, note: "control mode" },
      { card: "RTX 4060", cardSlug: "rtx-4060", pciId: "10de:2882", mode: "cuBLAS fp32 4096³", unit: "TF/s", stock: 7.85, unlocked: 7.60, ratio: 0.968, iters: null, note: "no tensor cores, unaffected" },
      { card: "RTX 4060", cardSlug: "rtx-4060", pciId: "10de:2882", mode: "cuBLAS int8 4096³", unit: "TF/s", stock: 28.10, unlocked: 28.27, ratio: 1.006, iters: null, note: "torch._int_mm, does not reach the INT8 tensor peak" },
    ],
  },
  {
    card: "GeForce RTX 4050 Laptop GPU",
    cardSlug: "rtx-4050-laptop",
    chip: "AD107",
    sms: 20,
    driver: "595.99.02",
    powerLimitW: null,
    source: "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-28e1-report.md",
    rows: [
      { card: "RTX 4050 Laptop", cardSlug: "rtx-4050-laptop", pciId: "10de:28e1", mode: "f16/f32", unit: "TF/s", stock: 26.48, unlocked: 52.97, ratio: 2.0, iters: null, note: "26.48 TF/s (209.02 ms) -> 52.97 TF/s (104.51 ms)" },
      { card: "RTX 4050 Laptop", cardSlug: "rtx-4050-laptop", pciId: "10de:28e1", mode: "tf32", unit: "TF/s", stock: 13.21, unlocked: 26.42, ratio: 2.0, iters: null, note: "13.21 TF/s (209.56 ms) -> 26.42 TF/s (104.78 ms)" },
    ],
  },
  {
    card: "GeForce RTX 3050 6GB",
    cardSlug: "rtx-3050-6gb",
    chip: "GA107",
    sms: 18,
    driver: "595.99.02",
    powerLimitW: 70,
    source: "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ga107-2584-report.md",
    rows: [
      { card: "RTX 3050 6GB", cardSlug: "rtx-3050-6gb", pciId: "10de:2584", mode: "f16/f16", unit: "TF/s", stock: 36.6, unlocked: 36.6, ratio: 1.0, iters: null, note: "control mode, already at full rate" },
      { card: "RTX 3050 6GB", cardSlug: "rtx-3050-6gb", pciId: "10de:2584", mode: "f16/f32", unit: "TF/s", stock: 18.3, unlocked: 36.6, ratio: 2.0, iters: null },
      { card: "RTX 3050 6GB", cardSlug: "rtx-3050-6gb", pciId: "10de:2584", mode: "bf16/f32", unit: "TF/s", stock: 18.2, unlocked: 36.3, ratio: 1.994, iters: null },
      { card: "RTX 3050 6GB", cardSlug: "rtx-3050-6gb", pciId: "10de:2584", mode: "s8/s32", unit: "TOP/s", stock: 72.8, unlocked: 72.6, ratio: 0.997, iters: null, note: "control mode" },
      { card: "RTX 3050 6GB", cardSlug: "rtx-3050-6gb", pciId: "10de:2584", mode: "dp4a", unit: "TOP/s", stock: 17.7, unlocked: 17.7, ratio: 1.0, iters: null, note: "control mode" },
      { card: "RTX 3050 6GB", cardSlug: "rtx-3050-6gb", pciId: "10de:2584", mode: "ffma", unit: "TF/s", stock: 8.4, unlocked: 8.5, ratio: 1.012, iters: null, note: "FP32 was never rate-limited" },
      { card: "RTX 3050 6GB", cardSlug: "rtx-3050-6gb", pciId: "10de:2584", mode: "cuBLAS f16/f32 4096³", unit: "TF/s", stock: 15.83, unlocked: 22.47, ratio: 1.42, iters: null, note: "70 W cap active in most samples, so large shapes are power-limited" },
      { card: "RTX 3050 6GB", cardSlug: "rtx-3050-6gb", pciId: "10de:2584", mode: "cuBLAS f16/f32 8192³", unit: "TF/s", stock: 16.05, unlocked: 19.66, ratio: 1.22, iters: null, note: "power-limited at 70 W" },
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
