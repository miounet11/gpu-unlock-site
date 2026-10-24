// Reconstructed from the three upstream READMEs. Command lines are copied from them; the prose is
// condensed, not invented. Where the upstreams differ the relevant fork is named explicitly.
//
// Turing is NOT a variant of the Ampere/Ada flow: different module (turing_unlock), different
// kernel parameter (turing_unlock.targets=), different payload layout per chip. Mixing the two
// sets of commands is the most likely way to waste a boot cycle, so the steps are separate.

export const REQUIREMENTS: string[] = [
  "Linux with kernel headers and a working DKMS toolchain (all three forks).",
  "GPL-2.0-only source built locally — the pinned NVIDIA firmware is downloaded and generated on your own machine.",
  "An unmodified stock boot entry kept available, so a failed unlock is recoverable.",
  "A card whose PCI ID is in the module's accepted list (see the cards index).",
];

export interface InstallStep {
  id: string;
  title: string;
  body: string;
  code?: string;
  note?: string;
}

export const INSTALL_STEPS: InstallStep[] = [
  {
    id: "pick-fork",
    title: "Pick the fork that matches your card",
    body:
      "The Ampere fork (Zagitta/gpu-unlock, v1.0.0) covers GA102, GA103, GA104 and GA106. The Ada fork (JustAResearcher/gpu-unlock-ada, v1.1.1) is that same module with AD102 (RTX 4090) and an experimental AD103 canary added, so it also handles the Ampere device list. The Turing fork (nlzy/turing-unlock, v2.0.0) is a separate module for the RTX 20 series: TU102, TU104 and TU106.",
    note:
      "The Ada fork keeps the original GeForce/CMP GA102 and GA104 lists plus the newer GA103/GA106 list. Professional RTX A-series and data-centre parts are not accepted by any of them. Turing and Ampere/Ada modules are not interchangeable — a TU102 card will not be touched by `gpu_unlock`.",
  },
  {
    id: "clone",
    title: "Clone and build the packages locally",
    body:
      "None of the three forks ships prebuilt binaries: each builds on the target machine, because the firmware generation step is pinned to the NVIDIA firmware you already have installed.",
    code: "# Ampere or Ada (RTX 30 / 40 series)\ngit clone https://github.com/Zagitta/gpu-unlock.git\n# or: git clone https://github.com/JustAResearcher/gpu-unlock-ada.git\n\n# Turing (RTX 20 series)\ngit clone https://github.com/nlzy/turing-unlock.git\ncd turing-unlock\nmake install",
    note:
      "All three forks use the same `make install` front end, which detects the distribution family. Explicit targets are `make install-arch`, `make install-deb` and `make install-rpm`. Kernel headers and a DKMS toolchain must already be present. The Turing build downloads two pinned NVIDIA files and verifies their SHA-256 — they stay in `~/.cache/turing-unlock/inputs`, and `make inputs` fetches them ahead of time.",
  },
  {
    id: "initramfs",
    title: "Let the package wire the module into the initramfs",
    body:
      "The unlock only applies if the module loads before the NVIDIA driver binds the card — `gpu_unlock` on Ampere/Ada, `turing_unlock` on the RTX 20 series. Loading it manually afterwards cannot unlock it, because the module refuses a card that already has a driver bound (`-EBUSY`). Each package therefore puts its module and firmware into the initramfs and loads it there.",
    code:
      "# mkinitcpio: /etc/mkinitcpio.conf.d/zz-gpu-unlock.conf\n# initramfs-tools: /usr/share/initramfs-tools/modules.d/gpu-unlock.conf\n# dracut: /usr/lib/dracut/dracut.conf.d/gpu-unlock.conf",
    note:
      "With initramfs-tools and dracut the module is rebuilt for every installed kernel that has headers, and images are rebuilt on install and on removal. Kernels installed later get the module from their own install hooks. mkinitcpio ignores drop-ins for an image built with `-c <config>` or a preset `_config` — put `gpu_unlock` (or `turing_unlock`) right before `nvidia` in that config's MODULES yourself.",
  },
  {
    id: "opt-in",
    title: "Opt in on the kernel command line",
    body:
      "The module does nothing unless the kernel command line asks for it. Set `gpu_unlock.targets=` to `all` for the Ampere path, or to explicit PCI addresses.",
    code: "gpu_unlock.targets=all",
    note:
      "There is no `softdep nvidia pre:` rule on purpose: kmod honours only the first `softdep nvidia` line it reads, so another package's rule would silently win. Boot order is handled by the initramfs drop-in instead.",
  },
  {
    id: "turing-opt-in",
    title: "Turing uses a different parameter name",
    body:
      "The RTX 20 series module is `turing_unlock`, so the option is `turing_unlock.targets=` — not `gpu_unlock.targets=`. It accepts `all` or a comma-separated list of PCI addresses printed by `lspci -D`; case does not matter. Without the option the module loads and returns without touching anything.",
    code:
      "# all accepted Turing cards\nturing_unlock.targets=all\n\n# one card, by PCI address\nturing_unlock.targets=0000:21:00.0\n\n# add it per bootloader\n# GRUB (Debian/Ubuntu): edit GRUB_CMDLINE_LINUX_DEFAULT in /etc/default/grub, then sudo update-grub\n# GRUB (Arch): same file, then sudo grub-mkconfig -o /boot/grub/grub.cfg\n# Fedora/RHEL: sudo grubby --update-kernel=ALL --args=\"turing_unlock.targets=all\"\n# systemd-boot / UKI: add it to the boot entry or /etc/kernel/cmdline",
    note:
      "Targets are matched by PCI address, and the module serialises cards behind one mutex, so they are unlocked one at a time. If a driver already owns the card, the module leaves it alone and logs `unlock failed (-16)` (EBUSY) — that is a load-order problem, not a card problem. The module does a PCIe FLR first if the card state needs it. On success the card is not reset; a failed step may reset it, and the screen then stays blank until `nvidia-drm` takes over.",
  },
  {
    id: "ad103",
    title: "AD103 needs two opt-ins and one exact address",
    body:
      "RTX 4070 Ti SUPER (`10de:2705`) is experimental and validated on a single card. It requires both `gpu_unlock.ad103_experimental=1` and `gpu_unlock.targets=` set to that card's single exact PCI address. `targets=all` never selects it.",
    code: "gpu_unlock.ad103_experimental=1 gpu_unlock.targets=0000:21:00.0",
    note:
      "Other Ada IDs, professional A-series and data-centre parts are not accepted. Shared firmware across Ada chips does not establish support for untested cards.",
  },
  {
    id: "resume",
    title: "Know what happens across suspend",
    body:
      "This applies to `gpu_unlock` (Ampere/Ada) only: it reapplies the override on resume, which can reset a display card. Add `gpu_unlock.resume=0` to the kernel command line — or write `0` to `/sys/module/gpu_unlock/parameters/resume` — to turn that off. Hibernation is not covered either way.",
    note:
      "`turing_unlock` has no resume parameter and no resume hook; it runs once from the initramfs and has no module parameters besides `targets`.",
  },
  {
    id: "make-persistent",
    title: "Persist the boot entry only after a cold boot works",
    body:
      "Validate one cold boot and one warm reboot on the exact card first. Only then make the bootloader entry persistent. Keep an unmodified stock entry available, and re-verify `gpu_unlock: unlocked`, the rate readback and GPU health after each boot.",
    note:
      "The tested canary uses a kernel-version-specific image; regenerate and revalidate it before removing its pinned kernel during an upgrade.",
  },
  {
    id: "avoid",
    title: "Do not let the driver load early",
    body:
      "Avoid `nvidia-smi`, CUDA, NVML and `nvidia-modprobe` before a manual cold-card attempt: they can load NVIDIA by name, and ordinary modprobe blacklist rules do not block explicit named loads. The packaged initramfs flow avoids the need for manual firmware staging.",
  },
];

export interface FailureMode {
  symptom: string;
  cause: string;
}

export const FAILURE_MODES: FailureMode[] = [
  {
    symptom: "Card stays unlocked but tensor throughput is unchanged",
    cause:
      "Some cards complete the unlock without gaining the rate (RTX 3080 Ti 20 GB OEM reports BF16 staying at half rate). Verify with a same-card stock-vs-unlocked benchmark rather than assuming the unlock implies the speedup.",
  },
  {
    symptom: "Display stays blank after the unlock",
    cause:
      "Expected during handoff: the firmware framebuffer is removed just before FLR and the display stays blank until `nvidia-drm` takes over. Display handoff was not part of the RTX 4090 validation.",
  },
  {
    symptom: "`gpu_unlock` appears in the log but the card is not unlocked",
    cause:
      "The module loaded after NVIDIA had already bound the card, or `gpu_unlock.targets=` is missing/wrong. The override must run from the initramfs, before the driver binds.",
  },
  {
    symptom: "`turing_unlock` logs nothing at all on an RTX 20 card",
    cause:
      "`turing_unlock.targets=` is missing, so the module returned immediately: it does nothing without the option. Using `gpu_unlock.targets=` instead produces exactly this silence, because the Ampere/Ada module never touches TU102/TU104/TU106.",
  },
  {
    symptom: "`turing_unlock` logs `unlock failed (-16)`",
    cause:
      "EBUSY: a driver had already bound the card when the module ran. The unlock must happen from the initramfs, before `nvidia` binds; check that the package's initramfs drop-in is present and that the image was rebuilt.",
  },
  {
    symptom: "`turing_unlock` reports unlock failed",
    cause:
      "The module logs the error code and leaves the card alone. A failed step may reset the card, which blanks the display until `nvidia-drm` loads. If the GPU firmware does not stop, the module keeps its DMA buffers until the next power off — power off before retrying.",
  },
  {
    symptom: "Firmware on a card never stops",
    cause:
      "The module logs it and keeps the DMA buffers that firmware may still use until the next power off. Power off before trying again.",
  },
];
