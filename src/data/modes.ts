// Measurement paths, grouped by what a row actually measures.
//
// A group is defined by two things that must not be confused with each other:
//
//   unit   — TF/s, TOP/s and GFLOP/s are different quantities. Rows in one table share one.
//   kernel — an issue-rate loop and a cuBLAS GEMM both print "f16/f32" but measure different
//            things (sustained issue rate vs library GEMM throughput). They get separate
//            groups, because a 2.0x on one and a 1.9x on the other are not the same result.
//
// Every row in benchmarks.ts therefore maps to exactly one group. `groupForRow` decides that
// mechanically: a mode carrying a M.N.K size ("cuBLAS f16/f32 8192³", and the Turing table's
// "f16/f32 4096³") is a GEMM; anything else is a register-resident issue-rate loop.
//
// `name` stays in English on purpose. It names a hardware path — "FP16 → FP32 tensor rate" —
// the way the `mode` strings and the `method` text do, and translating a technical identifier
// per locale would invent seven names for one measurement. The surrounding UI is translated.

export type ModeGroupId =
  | "tensor-f16-f32"
  | "tensor-bf16-f32"
  | "tensor-f16-f16"
  | "tensor-tf32"
  | "tensor-int8"
  | "tensor-int4"
  | "dp4a"
  | "fp32-ffma"
  | "gemm-f16-f32"
  | "gemm-mixed-precision"
  | "gemm-fp8"
  | "gemm-int8";

export interface ModeGroup {
  id: ModeGroupId;
  /** Rendered as-is; see the note above about why this is not translated. */
  name: string;
  /** One sentence on what the row measures. Also rendered as-is. */
  exercises: string;
  /** The unit every row in this group is printed in. */
  unit: string;
  /** Does the SM speed-select fuse govern this path? Decides whether an unlock can move it. */
  gated: boolean;
  /** Where the number comes from, quoted from the evidence folder. */
  method: string;
  /**
   * A page is only worth generating when the group carries enough independent rows to say
   * something. One row from one card is thin content that duplicates the card page; those
   * rows still appear on /benchmarks.
   */
  pageworthy: boolean;
}

export const MODE_GROUPS: ModeGroup[] = [
  {
    id: "tensor-f16-f32",
    name: "FP16 → FP32 tensor rate",
    exercises:
      "FP16 multiply with an FP32 accumulator — the shape most inference and attention kernels use.",
    unit: "TF/s",
    gated: true,
    method:
      "Register-resident mma.sync issue rate: all-one inputs, eight independent accumulator chains per warp, 20,000 iterations and three timed repetitions, best of three reported.",
    pageworthy: true,
  },
  {
    id: "tensor-bf16-f32",
    name: "BF16 → FP32 tensor rate",
    exercises: "BF16 multiply with an FP32 accumulator, the shape used by bf16 training stacks.",
    unit: "TF/s",
    gated: true,
    method:
      "Register-resident mma.sync issue rate: all-one inputs, eight independent accumulator chains per warp, 20,000 iterations and three timed repetitions, best of three reported.",
    pageworthy: true,
  },
  {
    id: "tensor-f16-f16",
    name: "FP16 → FP16 tensor rate",
    exercises:
      "FP16 multiply with an FP16 accumulator, the path that already runs at full tensor rate.",
    unit: "TF/s",
    gated: false,
    method:
      "Register-resident mma.sync issue rate: all-one inputs, eight independent accumulator chains per warp, 20,000 iterations and three timed repetitions, best of three reported.",
    pageworthy: true,
  },
  {
    id: "tensor-tf32",
    name: "TF32 → FP32 tensor rate",
    exercises: "TF32 multiply with an FP32 accumulator, the default for unqualified fp32 matmul.",
    unit: "TFLOP/s",
    gated: true,
    method:
      "Register-resident MMA issue rate at the card's stock power cap, 20,000 iterations and three timed repetitions, with every output cell checked per state.",
    pageworthy: true,
  },
  {
    id: "tensor-int8",
    name: "INT8 → INT32 tensor rate",
    exercises: "INT8 multiply with an INT32 accumulator, the quantised inference path.",
    unit: "TOP/s",
    gated: false,
    method:
      "Register-resident MMA issue rate: all-one inputs, eight independent accumulator chains per warp, best of three timed runs.",
    pageworthy: true,
  },
  {
    id: "tensor-int4",
    name: "INT4 → INT32 tensor rate",
    exercises: "Unsigned INT4 multiply with an INT32 accumulator, the aggressive quantisation path.",
    unit: "TOP/s",
    gated: false,
    method:
      "Register-resident MMA issue rate at the card's stock power cap, 20,000 iterations and three timed repetitions, with every output cell checked per state.",
    pageworthy: true,
  },
  {
    id: "dp4a",
    name: "dp4a integer dot product",
    exercises: "The dp4a instruction — four INT8 multiply-accumulates per lane, no tensor core.",
    unit: "TF/s",
    gated: false,
    method:
      "Register-resident dp4a.s32.s32 issue rate: eight independent accumulator chains per warp, best of three timed runs.",
    pageworthy: true,
  },
  {
    id: "fp32-ffma",
    name: "FP32 FFMA (CUDA cores)",
    exercises:
      "Scalar FP32 fused multiply-add on the CUDA cores, which is the path the unlock never governed.",
    unit: "TF/s",
    gated: false,
    method:
      "Register-resident fma.rn.f32 issue rate: eight independent accumulator chains per warp, best of three timed runs. Library SGEMM rows are grouped with the other cuBLAS GEMMs instead, because a fixed M.N.K call and an issue loop are not the same measurement.",
    pageworthy: true,
  },
  {
    id: "gemm-f16-f32",
    name: "cuBLAS FP16 GEMM, FP32 accumulate",
    exercises:
      "A library GEMM rather than an issue-rate loop, so it measures what a real workload gets at several M.N.K sizes.",
    unit: "TFLOP/s",
    gated: true,
    method:
      "cuBLAS FP16-in/FP32-accumulate GEMM at M.N.K 1024, 2048, 4096 and 8192, one timed run per size. The Turing rows are the nlzy/turing-unlock README table, which states TFLOPS directly.",
    pageworthy: true,
  },
  {
    id: "gemm-mixed-precision",
    name: "cuBLAS low-precision GEMM",
    exercises:
      "BF16/f32, FP16/f16 and TF32 library GEMM at 4096 and 8192, as measured on one card in a single sweep.",
    unit: "TF/s",
    gated: true,
    method:
      "cuBLAS GEMM with device-reference verification, 4096³ and 8192³, warmups followed by timed iterations.",
    pageworthy: false,
  },
  {
    id: "gemm-fp8",
    name: "cuBLAS FP8 GEMM",
    exercises: "E4M3 FP8 multiply with an FP32 accumulator through the library.",
    unit: "GFLOP/s",
    gated: false,
    method:
      "cuBLAS FP8 GEMM at 4096³ and 8192³ with device-reference verification.",
    pageworthy: false,
  },
  {
    id: "gemm-int8",
    name: "cuBLAS INT8 GEMM",
    exercises: "INT8 library GEMM, the quantised path a serving stack actually calls.",
    unit: "TOP/s",
    gated: false,
    method: "cuBLAS INT8 GEMM at 4096³ with device-reference verification.",
    pageworthy: false,
  },
];

const BY_ID = new Map(MODE_GROUPS.map((g) => [g.id, g]));

export function getModeGroup(id: string): ModeGroup | undefined {
  return BY_ID.get(id as ModeGroupId);
}

/**
 * The base quantity a mode string names, with any M.N.K size stripped.
 *   "cuBLAS f16/f32 8192³" -> { base: "f16/f32", gemm: true }
 *   "f16/f32 4096³"        -> { base: "f16/f32", gemm: true }   (Turing README table)
 *   "f16/f32"              -> { base: "f16/f32", gemm: false }
 */
export function parseMode(mode: string): { base: string; gemm: boolean } {
  const gemm = mode.includes("³");
  const stripped = mode.replace(/^cuBLAS\s+/, "").replace(/\s+\d+³$/, "");
  return { base: stripped.trim(), gemm };
}

const GEMM_GROUPS: Record<string, ModeGroupId> = {
  "f16/f32": "gemm-f16-f32",
  "bf16/f32": "gemm-mixed-precision",
  "f16/f16": "gemm-mixed-precision",
  tf32: "gemm-mixed-precision",
  fp8: "gemm-fp8",
  int8: "gemm-int8",
  // A cuBLAS SGEMM call, not an fma.rn.f32 issue loop. It measures the same unit set as
  // FP32 FFMA but through a library at a fixed M.N.K, so it does not belong in that table.
  fp32: "gemm-mixed-precision",
};

const ISSUE_GROUPS: Record<string, ModeGroupId> = {
  "f16/f32": "tensor-f16-f32",
  "bf16/f32": "tensor-bf16-f32",
  "f16/f16": "tensor-f16-f16",
  tf32: "tensor-tf32",
  "s8/s32": "tensor-int8",
  "u4/s32": "tensor-int4",
  dp4a: "dp4a",
  ffma: "fp32-ffma",
};

/**
 * Which group a measured row belongs to. Returns null for a mode nobody registered, so a new
 * evidence row fails a test instead of silently landing in the wrong table.
 */
export function groupForRow(mode: string): ModeGroupId | null {
  const { base, gemm } = parseMode(mode);
  return (gemm ? GEMM_GROUPS[base] : ISSUE_GROUPS[base]) ?? null;
}

/** Group slug used in the URL. The ids are already URL-safe. */
export function groupSlug(id: ModeGroupId): string {
  return id;
}

export function groupBySlug(slug: string): ModeGroup | undefined {
  return MODE_GROUPS.find((g) => groupSlug(g.id) === slug);
}

/**
 * The groups that get a page, and therefore the only ones a sitemap may list.
 *
 * Both conditions matter and both live here so the page and the sitemap cannot disagree:
 * `pageworthy` is the editorial judgement (one card's one row is already on its card page),
 * and `rowCount > 0` is the mechanical fact. A group that is pageworthy but has no rows would
 * render an empty table, and the page returns notFound() for it — so listing it in the sitemap
 * would publish a URL that 404s.
 *
 * The caller supplies the row count, because modes.ts does not import benchmarks.ts. That is
 * one import away from a cycle, and this keeps the decision single-sourced anyway.
 */
export function pageGroups(rowCount: (id: ModeGroupId) => number): ModeGroup[] {
  return MODE_GROUPS.filter((g) => g.pageworthy && rowCount(g.id) > 0);
}
