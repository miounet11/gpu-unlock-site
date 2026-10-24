// The three upstream kernel modules this project installs.
//
// The two sites split the work: gpu-unlock.com is the project hub — which module to build,
// how to install it, how to verify it — while gpuunlock.com is the reference that records
// what each module accepts and what was measured on the same card. The table here is about
// building and installing, not about card evidence, so the card list stays on the
// reference site.

// Relative import on purpose: the node test runner loads this file directly and cannot
// resolve the "@/" path alias.
import { REPOS } from "../lib/site.ts";

export interface Module {
  /** Stable key, used for anchors and for the message keys under home.modules.*. */
  id: "ampere" | "ada" | "turing";
  /** The kernel module's own name, as it appears in dmesg and in modprobe. */
  module: string;
  /** The kernel command line parameter that opts a card in. */
  parameter: string;
  /** Upstream release this site installs. */
  version: string;
  /** Chip families the module covers. */
  chips: string;
  /** Which upstream repository carries it. */
  repo: string;
  /** The repository name, shown in the table. */
  repoName: string;
  /** Message key under home.modules.<id>.* for the one-line summary. */
  summaryKey: string;
  /** Copy-pasteable commands, in shell, not translated. */
  commands: string[];
}

export const MODULES: Module[] = [
  {
    id: "ampere",
    module: "gpu_unlock",
    parameter: "gpu_unlock.targets=",
    version: "v1.0.0",
    chips: "GA102, GA103, GA104, GA106",
    repo: REPOS.ampere,
    repoName: "Zagitta/gpu-unlock",
    summaryKey: "ampere",
    commands: [
      "git clone https://github.com/Zagitta/gpu-unlock.git",
      "cd gpu-unlock",
      "sudo make install",
    ],
  },
  {
    id: "ada",
    module: "gpu_unlock",
    parameter: "gpu_unlock.targets=",
    version: "v1.1.1",
    chips: "AD102, AD103, plus the Ampere lists",
    repo: REPOS.ada,
    repoName: "JustAResearcher/gpu-unlock-ada",
    summaryKey: "ada",
    commands: [
      "git clone https://github.com/JustAResearcher/gpu-unlock-ada.git",
      "cd gpu-unlock-ada",
      "sudo make install",
    ],
  },
  {
    id: "turing",
    module: "turing_unlock",
    parameter: "turing_unlock.targets=",
    version: "v2.0.0",
    chips: "TU102, TU104, TU106",
    repo: REPOS.turing,
    repoName: "nlzy/turing-unlock",
    summaryKey: "turing",
    commands: [
      "git clone https://github.com/nlzy/turing-unlock.git",
      "cd turing-unlock",
      "sudo make install",
    ],
  },
];

/** The module a given chip family belongs to. Used to route a reader to the right build. */
export function moduleForChip(chip: string): Module | undefined {
  if (chip.startsWith("TU")) return MODULES.find((m) => m.id === "turing");
  if (chip.startsWith("AD")) return MODULES.find((m) => m.id === "ada");
  return MODULES.find((m) => m.id === "ampere");
}
