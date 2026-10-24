// Reconstructed from the three upstream READMEs. Command lines are copied from them; the prose is
// condensed, not invented. Where the upstreams differ the relevant fork is named explicitly.
//
// Turing is NOT a variant of the Ampere/Ada flow: different module (turing_unlock), different
// kernel parameter (turing_unlock.targets=), different payload layout per chip. Mixing the two
// sets of commands is the most likely way to waste a boot cycle, so the steps are separate.
//
// Only structure and command lines live here. Every sentence a reader sees comes from
// messages/<locale>.json under the `install` namespace, keyed by the ids below, so the page is
// translated instead of half-English. Commands stay verbatim in every locale: an option name or a
// path that has been translated is a command that fails.

export interface InstallStep {
  /** Matches install.steps.<id> in the message files and produces the #step-<id> anchor. */
  id: string;
  code?: string;
}

export const INSTALL_STEPS: InstallStep[] = [
  { id: "pick-fork" },
  {
    id: "clone",
    code:
      "# Ampere or Ada (RTX 30 / 40 series)\ngit clone https://github.com/Zagitta/gpu-unlock.git\n# or: git clone https://github.com/JustAResearcher/gpu-unlock-ada.git\n\n# Turing (RTX 20 series)\ngit clone https://github.com/nlzy/turing-unlock.git\ncd turing-unlock\nmake install",
  },
  {
    id: "initramfs",
    code:
      "# mkinitcpio: /etc/mkinitcpio.conf.d/zz-gpu-unlock.conf\n# initramfs-tools: /usr/share/initramfs-tools/modules.d/gpu-unlock.conf\n# dracut: /usr/lib/dracut/dracut.conf.d/gpu-unlock.conf",
  },
  { id: "opt-in", code: "gpu_unlock.targets=all" },
  {
    id: "turing-opt-in",
    code:
      "# all accepted Turing cards\nturing_unlock.targets=all\n\n# one card, by PCI address\nturing_unlock.targets=0000:21:00.0\n\n# add it per bootloader\n# GRUB (Debian/Ubuntu): edit GRUB_CMDLINE_LINUX_DEFAULT in /etc/default/grub, then sudo update-grub\n# GRUB (Arch): same file, then sudo grub-mkconfig -o /boot/grub/grub.cfg\n# Fedora/RHEL: sudo grubby --update-kernel=ALL --args=\"turing_unlock.targets=all\"\n# systemd-boot / UKI: add it to the boot entry or /etc/kernel/cmdline",
  },
  {
    id: "ad103",
    code: "gpu_unlock.ad103_experimental=1 gpu_unlock.targets=0000:21:00.0",
  },
  { id: "resume" },
  { id: "make-persistent" },
  { id: "avoid" },
];

/**
 * Order of the failure entries under install.failures.*. The list is here rather than in the
 * message files so all seven locales are forced to carry the same entries.
 */
export const FAILURE_MODE_KEYS = [
  "tensor-unchanged",
  "blank-display",
  "unlocked-log-only",
  "turing-silent",
  "turing-ebusy",
  "turing-unlock-failed",
  "firmware-never-stops",
] as const;

/** Order of the entries under install.requirements.*, same contract as the failure list. */
export const REQUIREMENT_KEYS = [
  "linux-headers",
  "source-build",
  "stock-entry",
  "accepted-pci-id",
] as const;
