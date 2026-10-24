export interface FaqEntry {
  q: string;
  a: string;
}

export const FAQS: FaqEntry[] = [
  {
    q: "What does GPU Unlock actually change?",
    a: "It enables the SM speed-select override before the stock NVIDIA driver binds the card. On the Ada RTX 4090 path the signed firmware runs, the payload's completion marker and required permissions are checked, SS0 is written 0x88888888 and SS1 0x8, and FLR happens before the unmodified driver loads. No patched NVIDIA driver and no UEFI application is involved.",
  },
  {
    q: "Which cards are confirmed to work?",
    a: "Three cards have published same-card stock-vs-unlocked measurements: RTX 4090 (10de:2684), RTX 4070 Ti SUPER (10de:2705, experimental, one card) and RTX 2080 Ti (10de:1e07, the only Turing card the turing_unlock author tested). RTX 3090 Ti, RTX 3090, RTX 3080 10 GB, RTX 3080 20 GB, RTX 3070 and RTX 3060 12 GB have user compatibility reports. RTX 3070 Ti has not been tested with this module on Linux; the same unlock worked from a UEFI port on Windows. GA103 (10de:2414) and every TU104/TU106 id (RTX 2080 SUPER, 2080, 2070, 2060 and their SUPER variants) have no reports at all.",
  },
  {
    q: "How much faster is it?",
    a: "On RTX 4090, f16/f32 and bf16/f32 go from about 165.6 TF/s to about 330 TF/s — roughly 2×. On RTX 4070 Ti SUPER, f16/f32 goes from 94.96 to 188.97 TFLOP/s and tf32 from 47.49 to 94.51 TFLOP/s, both 1.99×. On RTX 2080 Ti the Turing fork reports cuBLAS FP16 GEMM with FP32 accumulate going from 88.4% to 120.0% of a 56.9 TF/s peak at 1024³ (50.3 to 68.3 TF/s), and 97.9% to 160.6% at 2048³ (55.7 to 91.4 TF/s) — a 1.36× to 1.64× gain depending on problem size. Paths that were not rate-limited do not move: FP32 FFMA stays at 79.1 TF/s, INT8 S8/S32 stays around 660 TF/s, and the E4M3 FP8 CUTLASS GEMM measured 1.0029× on the 4070 Ti SUPER.",
  },
  {
    q: "Does it work on Windows?",
    a: "These three forks are Linux kernel modules. The RTX 3070 Ti report notes that the same unlock worked from a UEFI port on Windows, but that is a separate implementation, not something this module does. Nothing here should be read as a Windows tool.",
  },
  {
    q: "Is it safe? Will it damage my card?",
    a: "The upstreams do not claim it is risk-free. The unlock writes speed-select registers and performs an FLR before the driver binds, which is why a stock boot entry must be kept available and why the AD103 path is described as experimental. Display handoff was not validated on the RTX 4090, so a display card can stay blank through boot until nvidia-drm starts. If a card's firmware never stops, power off before retrying.",
  },
  {
    q: "Why do I need the initramfs at all?",
    a: "Because the override has to happen before the NVIDIA driver binds the card. Loading the module manually after the driver is bound cannot unlock anything — on Turing the module refuses outright and logs `unlock failed (-16)`, which is EBUSY. The packages put the module and its firmware into the initramfs and load it there, ahead of nvidia.",
  },
  {
    q: "Do I need a patched NVIDIA driver?",
    a: "No. The Ada path explicitly requires no patched NVIDIA driver and no UEFI application — the unmodified driver binds after the payload has run. The Ampere module works the same way, loading before nvidia rather than replacing it. The Turing module is also a separate kernel module loaded ahead of nvidia; its README states the proprietary and the open driver both work, tested with 575.51.03.",
  },
  {
    q: "What is the licence situation?",
    a: "The kernel module and local packaging are GPL-2.0-only. The generated payload derives from the pinned CMP reference. NVIDIA firmware remains under its own terms — see firmware/NOTICE.md and licenses/ in the upstream repositories for attribution and notices.",
  },
  {
    q: "How do I turn it off?",
    a: "Remove the kernel parameter: `gpu_unlock.targets=` on Ampere/Ada, `turing_unlock.targets=` on RTX 20 series. For a one-off boot, delete it in the bootloader's edit screen. Removing the packages also removes the module and the initramfs drop-ins.",
  },
];
