// Every entry here is taken from one of the two upstream repositories, not invented.
//
//   Zagitta/gpu-unlock        main @ 6081407 — GA102/GA103/GA104/GA106 module + packaging
//   JustAResearcher/gpu-unlock-ada v1.1.1 — adds AD102 (RTX 4090) and an experimental AD103 canary
//   nlzy/turing-unlock        main @ 417f333 — TU102/TU104/TU106 (RTX 20 series), a separate module
//
// Only the Ada fork publishes tags; the other two publish neither tags nor releases, so their
// revision is the branch head recorded in upstream-pins.json.
//
// Turing is a different kernel module with a different kernel parameter (`turing_unlock.targets=`),
// so nothing in an Ada/Ampere entry applies to it and vice versa.
//
// `status` records what the upstream reports say, and nothing stronger:
//   measured   the fork published a same-card stock-vs-unlocked measurement
//   reported   a user filed a compatibility report; the fork did not revalidate it
//   partial    the unlock completes but the throughput gain does not materialise
//   untested   the module accepts the device id, nobody has reported a result
//   unsupported  deliberately not accepted by the module

export type DeviceStatus = "measured" | "reported" | "partial" | "untested" | "unsupported";

export interface Device {
  slug: string;
  chip: string;
  name: string;
  pciId: string;
  vendor: "NVIDIA";
  status: DeviceStatus;
  /** Same-card floor of the reported GEMM gain, in percent. Null when nobody measured it. */
  gainMin: number | null;
  gainMax: number | null;
  /** Which upstream fork carries support. */
  fork: "both" | "ada" | "ampere" | "turing";
  notes: string;
  sources: string[];
}

export const DEVICES: Device[] = [
  {
    slug: "rtx-4090",
    chip: "AD102",
    name: "GeForce RTX 4090",
    pciId: "10de:2684",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 99,
    gainMax: 100,
    fork: "ada",
    notes:
      "The only Ada card with published same-card numbers. The signed firmware runs, the payload's completion marker and permissions are checked, SS0 is written 0x88888888 and SS1 0x8, then FLR happens before the unmodified NVIDIA driver binds. No patched driver and no UEFI application.",
    sources: [
      "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/evidence/rtx4090/README.md",
    ],
  },
  {
    slug: "rtx-4070-ti-super",
    chip: "AD103",
    name: "GeForce RTX 4070 Ti SUPER",
    pciId: "10de:2705",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 99,
    gainMax: 99,
    fork: "ada",
    notes:
      "Experimental, validated on one card. Requires both gpu_unlock.ad103_experimental=1 and gpu_unlock.targets= set to that single exact PCI address; targets=all never selects it. Two cold boots and later warm reboots confirmed driver 580.178.04 handoff.",
    sources: [
      "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/evidence/ada2705/README.md",
    ],
  },
  // Experimental Ada targets. Each needs its own opt-in flag, and every one of them is "exact":
  // the card must be named by its own PCI address in gpu_unlock.targets=, because targets=all
  // never selects them. They all reuse the RTX 4090's pinned AD102-family firmware and payload,
  // so a result is evidence for the boot path, not for a per-die firmware.
  {
    slug: "rtx-4090-d",
    chip: "AD102",
    name: "GeForce RTX 4090 D",
    pciId: "10de:2685",
    vendor: "NVIDIA",
    status: "reported",
    gainMin: null,
    gainMax: null,
    fork: "ada",
    notes:
      "Needs gpu_unlock.rtx4090d_experimental=1 plus its exact address in targets=. Eight cards in one host unlocked; no matched throughput table was published with the report.",
    sources: ["https://github.com/JustAResearcher/gpu-unlock-ada/pull/7"],
  },
  {
    slug: "rtx-4070-ti-super-ad102",
    chip: "AD102",
    name: "GeForce RTX 4070 Ti SUPER (AD102)",
    pciId: "10de:2689",
    vendor: "NVIDIA",
    status: "reported",
    gainMin: null,
    gainMax: null,
    fork: "ada",
    notes:
      "The AD102 variant of the same model name, not the AD103 canary. Needs gpu_unlock.rtx4070tis_ad102_experimental=1 and its exact address; one card held a 30-minute soak. No matched numbers published.",
    sources: ["https://github.com/JustAResearcher/gpu-unlock-ada/pull/19"],
  },
  {
    slug: "rtx-4080-super",
    chip: "AD103",
    name: "GeForce RTX 4080 SUPER",
    pciId: "10de:2702",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 94,
    gainMax: 100,
    fork: "ada",
    notes:
      "One card, measured against its own stock state in the same host as a 10de:2704. Register-resident FP16/FP32 and BF16/FP32 doubled; cuBLAS GEMM reached 1.94× at 4096³ and 1.61× at 8192³ because the large shapes are power-limited at 250 W.",
    sources: [
      "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/evidence/ada2702-ada2704-matched/README.md",
    ],
  },
  {
    slug: "rtx-4080",
    chip: "AD103",
    name: "GeForce RTX 4080",
    pciId: "10de:2704",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 94,
    gainMax: 100,
    fork: "ada",
    notes:
      "One modified 32 GiB card. Needs gpu_unlock.rtx4080_experimental=1 and its exact address. Same matched run as the 10de:2702: FP16/FP32 and BF16/FP32 doubled, cuBLAS GEMM 1.94× at 4096³ and 1.61× at 8192³, both cards capped at 250 W.",
    sources: [
      "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/evidence/ada2702-ada2704-matched/README.md",
    ],
  },
  {
    slug: "rtx-4070",
    chip: "AD103",
    name: "GeForce RTX 4070 (AD103)",
    pciId: "10de:2709",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 43,
    gainMax: 100,
    fork: "ada",
    notes:
      "Then-untested AD103 die. The register-level probe went from half to full rate and doubled FP16/BF16 with FP32 accumulate; cuBLAS GEMM gained less on small shapes (+43% at 1024, rising to +50% at 4096) because those runs are not tensor-bound.",
    sources: ["https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2709-report.md"],
  },
  {
    slug: "rtx-4090-laptop",
    chip: "AD103M",
    name: "GeForce RTX 4090 Laptop GPU",
    pciId: "10de:2757",
    vendor: "NVIDIA",
    status: "partial",
    gainMin: null,
    gainMax: null,
    fork: "ada",
    notes:
      "Laptop board, so the result is per-chassis. A Clevo unlocked with no throughput change at all; a Lenovo reached 2× on two cold boots. Needs gpu_unlock.ad103m_experimental=1 and its exact address.",
    sources: [
      "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2757-report.md",
    ],
  },
  {
    slug: "rtx-4070-ti",
    chip: "AD104",
    name: "GeForce RTX 4070 Ti",
    pciId: "10de:2782",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 50,
    gainMax: 100,
    fork: "ada",
    notes:
      "Measured inside a KVM guest with the card passed through by VFIO, so the unlock survived the guest reboot that VFIO forces. FP16/FP32 84.8 → 169.4 TF/s and TF32 42.4 → 84.0 TF/s, same card, binary and 285 W cap. cuBLAS GEMM gained +50% at 1024³, rising to +94% at 8192³.",
    sources: ["https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2782-report.md"],
  },
  {
    slug: "rtx-4070-super",
    chip: "AD104",
    name: "GeForce RTX 4070 SUPER",
    pciId: "10de:2783",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 37,
    gainMax: 92,
    fork: "ada",
    notes:
      "One card, 56 SMs, 242 W cap. FP16/FP32 and BF16/FP32 doubled at the register level; cuBLAS GEMM ran 1.37× at 1024³ up to 1.92× at 8192³. The unlock survived a warm reboot, and llama.cpp throughput did not move.",
    sources: ["https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2783-report.md"],
  },
  {
    slug: "rtx-4070-gigabyte",
    chip: "AD104",
    name: "GeForce RTX 4070 (Gigabyte)",
    pciId: "10de:2786",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 99,
    gainMax: 100,
    fork: "ada",
    notes:
      "Board-specific: the FWSEC image offset and IMEM size pinned for the MSI 10de:2782 must not be reused here. FP16/FP32 67.0 → 133.8 TF/s and BF16/FP32 66.9 → 133.7 TF/s; control modes stayed flat. Kernel logged a module signing-key trust warning, so Secure-Boot-enabled operation is not validated.",
    sources: [
      "https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2786-report.md",
    ],
  },
  {
    slug: "rtx-4060-ti-16gb",
    chip: "AD106",
    name: "GeForce RTX 4060 Ti 16GB",
    pciId: "10de:2803",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 99,
    gainMax: 99,
    fork: "ada",
    notes:
      "34 SMs, 165 W cap. FP16/FP32 46.4 → 92.3 TF/s and TF32 23.2 → 46.2 TF/s; the unsigned INT4 path was already at full rate. The 8 GB variant is a different ID (10de:2805).",
    sources: ["https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2803-report.md"],
  },
  {
    slug: "rtx-4060-ti-16gb-2805",
    chip: "AD106",
    name: "GeForce RTX 4060 Ti 16GB (second board)",
    pciId: "10de:2805",
    vendor: "NVIDIA",
    status: "reported",
    gainMin: null,
    gainMax: null,
    fork: "ada",
    notes:
      "The unlock completes and the RM getter reports full rate, but the report states no matched throughput run was taken. Its speedup is therefore unproven, not absent.",
    sources: ["https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2805-report.md"],
  },
  {
    slug: "rtx-4060",
    chip: "AD107",
    name: "GeForce RTX 4060",
    pciId: "10de:2882",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 41,
    gainMax: 63,
    fork: "ada",
    notes:
      "24 SMs, 8 GB. FP16/FP32 gained 55% on the cold boot and 41% after a warm reboot; TF32 gained the most (+63%). FP8 and the int8 path barely moved, and FP32 without tensor cores went slightly backwards — the unlock only widens the tensor rate.",
    sources: ["https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-2882-report.md"],
  },
  {
    slug: "rtx-4060-laptop-maxq",
    chip: "AD107M",
    name: "GeForce RTX 4060 Laptop GPU (Max-Q)",
    pciId: "10de:28a0",
    vendor: "NVIDIA",
    status: "reported",
    gainMin: null,
    gainMax: null,
    fork: "ada",
    notes:
      "Only the unlocked state was observed; no matched stock run was published. The module's own speed-select readback went from fields 0 0 2 0 0 2 0 2 0 to all zero within one boot, and the RM getter reported full rate afterwards.",
    sources: ["https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-28a0-report.md"],
  },
  {
    slug: "rtx-4060-laptop",
    chip: "AD107",
    name: "GeForce RTX 4060 Laptop GPU",
    pciId: "10de:28e0",
    vendor: "NVIDIA",
    status: "reported",
    gainMin: null,
    gainMax: null,
    fork: "ada",
    notes:
      "One owner report. The same model number also appears under 10de:28a0 with its own report, so the ID is what identifies the board, not the name.",
    sources: ["https://github.com/JustAResearcher/gpu-unlock-ada/pull/10"],
  },
  {
    slug: "rtx-4050-laptop",
    chip: "AD107",
    name: "GeForce RTX 4050 Laptop GPU",
    pciId: "10de:28e1",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 100,
    gainMax: 100,
    fork: "ada",
    notes:
      "One laptop, matched: FP16/FP32 26.48 → 52.97 TF/s and TF32 13.21 → 26.42 TF/s, exactly 2.00× on both.",
    sources: ["https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ada-28e1-report.md"],
  },
  {
    slug: "rtx-3050-6gb",
    chip: "GA107",
    name: "GeForce RTX 3050 6GB",
    pciId: "10de:2584",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 22,
    gainMax: 99,
    fork: "ada",
    notes:
      "Ampere die on the GA102 Booter path, not an Ada experimental target. 18 SMs. Register-resident FP16/FP32 18.07 → 36.01 TF/s, but cuBLAS GEMM gained only 22–69% depending on shape because the card spends most of a large run power-limited.",
    sources: ["https://github.com/JustAResearcher/gpu-unlock-ada/blob/main/docs/ga107-2584-report.md"],
  },
  {
    slug: "rtx-3090-ti",
    chip: "GA102",
    name: "GeForce RTX 3090 Ti",
    pciId: "10de:2203",
    vendor: "NVIDIA",
    status: "reported",
    gainMin: 68,
    gainMax: 80,
    fork: "both",
    notes: "Unlocked according to the compatibility report. BF16 GEMM gain of +68–80%.",
    sources: ["https://github.com/Zagitta/gpu-unlock/issues/1"],
  },
  {
    slug: "rtx-3090",
    chip: "GA102",
    name: "GeForce RTX 3090",
    pciId: "10de:2204",
    vendor: "NVIDIA",
    status: "reported",
    gainMin: 25,
    gainMax: 67,
    fork: "both",
    notes:
      "The most-reported card on the Ampere fork, across seven issue threads. Gain spread is wide because the reports come from different workloads.",
    sources: ["https://github.com/Zagitta/gpu-unlock/issues/5"],
  },
  {
    slug: "rtx-3080-ti-20gb",
    chip: "GA102",
    name: "GeForce RTX 3080 Ti 20 GB (OEM, GA102-250)",
    pciId: "10de:2205",
    vendor: "NVIDIA",
    status: "partial",
    gainMin: null,
    gainMax: null,
    fork: "both",
    notes:
      "The unlock completes but BF16 stays at half rate. This is the clearest example of the gap between 'the module loaded' and 'the card is faster'.",
    sources: ["https://github.com/Zagitta/gpu-unlock/issues/28"],
  },
  {
    slug: "rtx-3080-10gb",
    chip: "GA102",
    name: "GeForce RTX 3080 10 GB",
    pciId: "10de:2206",
    vendor: "NVIDIA",
    status: "reported",
    gainMin: 70,
    gainMax: 73,
    fork: "both",
    notes: "Unlocked. BF16 GEMM gain of +70–73%.",
    sources: ["https://github.com/Zagitta/gpu-unlock/issues/14"],
  },
  {
    slug: "rtx-3080-20gb",
    chip: "GA102",
    name: "GeForce RTX 3080 20 GB (memory upgrade)",
    pciId: "10de:2206",
    vendor: "NVIDIA",
    status: "reported",
    gainMin: 56,
    gainMax: 59,
    fork: "both",
    notes:
      "Same device id as the 10 GB board, different memory configuration, different gain. Worth knowing that a device id does not pin down the result.",
    sources: ["https://github.com/Zagitta/gpu-unlock/issues/10"],
  },
  {
    slug: "rtx-3070",
    chip: "GA104",
    name: "GeForce RTX 3070",
    pciId: "10de:2484",
    vendor: "NVIDIA",
    status: "reported",
    gainMin: 73,
    gainMax: 81,
    fork: "both",
    notes: "Unlocked. BF16 GEMM gain of +73–81%.",
    sources: ["https://github.com/Zagitta/gpu-unlock/issues/12"],
  },
  {
    slug: "rtx-3070-ti",
    chip: "GA104",
    name: "GeForce RTX 3070 Ti",
    pciId: "10de:2482",
    vendor: "NVIDIA",
    status: "untested",
    gainMin: null,
    gainMax: null,
    fork: "ampere",
    notes:
      "Not tested with this module. The same unlock was reported to work from a UEFI port on Windows, which is a different mechanism and does not transfer.",
    sources: ["https://github.com/Zagitta/gpu-unlock/issues/32"],
  },
  {
    slug: "rtx-3060-12gb",
    chip: "GA106",
    name: "GeForce RTX 3060 12 GB",
    pciId: "10de:2504",
    vendor: "NVIDIA",
    status: "reported",
    gainMin: 80,
    gainMax: 80,
    fork: "both",
    notes:
      "Unlocked, about +80% BF16 GEMM. This is also the only GA106 device the fork validated.",
    sources: ["https://github.com/Zagitta/gpu-unlock/pull/13"],
  },
  {
    slug: "ga103-2414",
    chip: "GA103",
    name: "GA103 (any board)",
    pciId: "10de:2414",
    vendor: "NVIDIA",
    status: "untested",
    gainMin: null,
    gainMax: null,
    fork: "both",
    notes:
      "The module accepts this id. Upstream marks it untested and there are no compatibility reports, so there is nothing to promise.",
    sources: ["https://github.com/Zagitta/gpu-unlock"],
  },
  {
    slug: "rtx-2080-ti",
    chip: "TU102",
    name: "GeForce RTX 2080 Ti",
    pciId: "10de:1e07",
    vendor: "NVIDIA",
    status: "measured",
    gainMin: 36,
    gainMax: 64,
    fork: "turing",
    notes:
      "The only card the Turing module's author tested: a Dell RTX 2080 Ti 22 GB with driver 575.51.03, on both the proprietary and the open NVIDIA driver. SS0 is written 0x88888888, SS1 0x8, ACR mutex 3 is released, and the GPU returns through the normal Booter finalize path. The gain depends on the GEMM size — +36% at 1024³ up to +64% at 2048³. Other cards and other drivers are untested.",
    sources: [
      "https://github.com/nlzy/turing-unlock",
      "https://github.com/nlzy/turing-unlock/blob/master/docs/Difference%20between%20Ampere%20and%20Turing.md",
    ],
  },
  {
    slug: "rtx-2080-ti-12gb",
    chip: "TU102",
    name: "GeForce RTX 2080 Ti 12 GB",
    pciId: "10de:1e03",
    vendor: "NVIDIA",
    status: "untested",
    gainMin: null,
    gainMax: null,
    fork: "turing",
    notes:
      "Accepted by the TU102 list in the Turing module. The author tested the 22 GB board (10de:1e07) only, so this id gets no result even though it is the same chip.",
    sources: ["https://github.com/nlzy/turing-unlock"],
  },
  {
    slug: "rtx-2080-super",
    chip: "TU104",
    name: "GeForce RTX 2080 SUPER",
    pciId: "10de:1e81",
    vendor: "NVIDIA",
    status: "untested",
    gainMin: null,
    gainMax: null,
    fork: "turing",
    notes:
      "Accepted by the TU104 list, which upstream marks as not tested. The Turing payload has a per-chip layout — do not assume TU102 addresses carry over.",
    sources: ["https://github.com/nlzy/turing-unlock"],
  },
  {
    slug: "rtx-2080",
    chip: "TU104",
    name: "GeForce RTX 2080",
    pciId: "10de:1e82",
    vendor: "NVIDIA",
    status: "untested",
    gainMin: null,
    gainMax: null,
    fork: "turing",
    notes:
      "Accepted by the TU104 list, marked not tested upstream. No compatibility report exists for this id.",
    sources: ["https://github.com/nlzy/turing-unlock"],
  },
  {
    slug: "rtx-2070-super",
    chip: "TU104",
    name: "GeForce RTX 2070 SUPER",
    pciId: "10de:1e84",
    vendor: "NVIDIA",
    status: "untested",
    gainMin: null,
    gainMax: null,
    fork: "turing",
    notes:
      "Accepted by the TU104 list, marked not tested upstream. Two further TU104 ids (10de:1ec2, 10de:1ec7) also map to this model in the module's list.",
    sources: ["https://github.com/nlzy/turing-unlock"],
  },
  {
    slug: "rtx-2060",
    chip: "TU104",
    name: "GeForce RTX 2060",
    pciId: "10de:1e89",
    vendor: "NVIDIA",
    status: "untested",
    gainMin: null,
    gainMax: null,
    fork: "turing",
    notes:
      "Accepted by the TU104 list, marked not tested upstream. No result has been published for this card.",
    sources: ["https://github.com/nlzy/turing-unlock"],
  },
  {
    slug: "rtx-2070",
    chip: "TU106",
    name: "GeForce RTX 2070",
    pciId: "10de:1f02",
    vendor: "NVIDIA",
    status: "untested",
    gainMin: null,
    gainMax: null,
    fork: "turing",
    notes:
      "Accepted by the TU106 list, marked not tested upstream. TU106 is the furthest chip from the tested TU102 board.",
    sources: ["https://github.com/nlzy/turing-unlock"],
  },
  {
    slug: "rtx-2060-super",
    chip: "TU106",
    name: "GeForce RTX 2060 SUPER",
    pciId: "10de:1f06",
    vendor: "NVIDIA",
    status: "untested",
    gainMin: null,
    gainMax: null,
    fork: "turing",
    notes:
      "Accepted by the TU106 list, marked not tested upstream. Further TU106 ids (10de:1f42, 10de:1f47) also map to this model.",
    sources: ["https://github.com/nlzy/turing-unlock"],
  },
];

/** Every device id the module matches, including ones with no report and no page. */
// Ada is split by die because each die has its own opt-in flag, and the exact ones must be
// named by PCI address — `gpu_unlock.targets=all` never selects them. The list follows
// kernel/gpu_unlock/arch_610.h and experimental_ids[] in main.c, not the README prose.
export const ACCEPTED_IDS = {
  AD102: ["0x2684", "0x2685", "0x2689"],
  AD103: ["0x2702", "0x2704", "0x2705", "0x2709"],
  AD103M: ["0x2757"],
  AD104: ["0x2782", "0x2783", "0x2786"],
  AD106: ["0x2803", "0x2805"],
  AD107: ["0x2882", "0x28a0", "0x28e0", "0x28e1"],
  GA102: [
    "0x2200", "0x2203", "0x2204", "0x2205", "0x2206", "0x2207", "0x2208",
    "0x220a", "0x220d", "0x2216", "0x222b", "0x222f",
  ],
  GA103: ["0x2414"],
  GA104: [
    "0x2480", "0x2482", "0x2483", "0x2484", "0x2486", "0x2487", "0x2488", "0x2489",
    "0x248a", "0x248c", "0x248d", "0x248e", "0x249c", "0x249d", "0x249f", "0x24a0",
    "0x24a4", "0x24ac", "0x24ad", "0x24af", "0x24bf", "0x24c0", "0x24c7", "0x24c8",
    "0x24c9", "0x24dc", "0x24dd", "0x24df", "0x24e0",
  ],
  GA106: [
    "0x2501", "0x2503", "0x2504", "0x2505", "0x2507", "0x2508", "0x2509", "0x252f",
    "0x2544",
  ],
  // Validated only on the RTX 3050 6GB, but it goes through the same GA102 Booter HAL as the
  // Ampere list rather than any Ada opt-in.
  GA107: ["0x2584"],
  // Turing, from nlzy/turing-unlock's supported_ids[] — a different module, kept here so
  // the accepted-id count covers every card the site documents.
  TU102: ["0x1e03", "0x1e04", "0x1e07", "0x1e2d", "0x1e2e"],
  TU104: ["0x1e81", "0x1e82", "0x1e84", "0x1e87", "0x1e89", "0x1ec2", "0x1ec7"],
  TU106: ["0x1f02", "0x1f03", "0x1f06", "0x1f07", "0x1f08", "0x1f42", "0x1f47"],
} as const;

export function getDevice(slug: string): Device | undefined {
  return DEVICES.find((d) => d.slug === slug);
}

export function acceptedCount(): number {
  return Object.values(ACCEPTED_IDS).reduce((n, ids) => n + ids.length, 0);
}
