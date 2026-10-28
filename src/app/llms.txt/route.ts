import { MODULES } from "@/data/modules";
import { REFERENCE_SITE, REPOS, SITE } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const lines: string[] = [];

  lines.push("# GPU Unlock — build and install");
  lines.push("");
  lines.push(
    "> Install notes for three upstream NVIDIA kernel modules that enable the SM speed-select override: Zagitta/gpu-unlock (Ampere), JustAResearcher/gpu-unlock-ada (Ada) and nlzy/turing-unlock (Turing, RTX 20 series). This file lists the pages, the modules and the boot order; the card and measurement pages carry the accepted device IDs and the same-card numbers.",
  );
  lines.push("");
  lines.push("Key facts:");
  lines.push(
    "- Three upstream repositories ship two module binaries: `gpu_unlock` (from the Ampere repo, and from the Ada repo that supersedes it) and `turing_unlock` (from the Turing repo).",
  );
  lines.push(
    `- Each module has its own kernel parameter: \`gpu_unlock.targets=\` and \`turing_unlock.targets=\`. They are not interchangeable.`,
  );
  lines.push("- Linux only. The module must load before the stock NVIDIA driver, via the initramfs.");
  lines.push("- The module is not a driver: it writes speed-select registers, then the stock NVIDIA driver binds the card as usual.");
  lines.push("- The Windows route is a separate project: a UEFI application unlocks the card and chain-loads the Windows Boot Manager, so no Linux boot is involved.");
  lines.push("");
  lines.push("## Pages");
  lines.push(`- [Home](${SITE}/en): the module table, the build commands and the verification steps`);
  lines.push(`- [Install](${SITE}/en/install): initramfs ordering, kernel parameters, verification, rollback`);
  lines.push(`- [Windows](${SITE}/en/windows): UEFI unlock that returns the card to Windows, the installer and its limits`);
  lines.push(`- [Cards](${SITE}/en/gpus): every accepted PCI ID with its status, plus one page per card`);
  lines.push(`- [Benchmarks](${SITE}/en/benchmarks): same-card stock-vs-unlocked measurements, including modes that did not change`);
  lines.push(`- [FAQ](${SITE}/en/faq): module choice, safety, driver requirements, failure modes`);
  lines.push(
    `- [Answers](${SITE}/en/answers): one page per question, each led by a direct answer and the measurements behind it`,
  );
  lines.push(
    `- [Full corpus](${SITE}/llms-full.txt): every question and answer in one file, for retrieval`,
  );
  lines.push(
    `- [Use cases](${SITE}/en/use-cases): local LLM inference, fine-tuning, Stable Diffusion and quantised inference, each judged by the paths it runs through`,
  );
  lines.push(
    `- [By chip](${SITE}/en/chips): support is decided per chip, so each chip page lists the cards built on it and which of them were measured`,
  );
  lines.push(
    `- [About](${SITE}/en/about): who publishes this, how the numbers are taken, and what the site does not claim`,
  );
  lines.push(
    `- [Changelog](${SITE}/en/changelog): pinned module revisions and the commit each comes from`,
  );
  lines.push(`- [Card reference](${REFERENCE_SITE}/en): the companion site, which maintains its own card coverage`);
  lines.push("");
  lines.push("## Modules");
  lines.push("");
  for (const m of MODULES) {
    lines.push(`### ${m.id} — ${m.module}`);
    lines.push(`- Chip families: ${m.chips}`);
    lines.push(`- Kernel parameter: \`${m.parameter}\``);
    lines.push(`- Upstream release: ${m.version}`);
    lines.push(`- Repository: ${m.repo}`);
    lines.push(`- Build: ${m.commands.join(" && ")}`);
    lines.push("");
  }
  lines.push("## Boot order");
  lines.push("");
  lines.push("1. The module has to be in the initramfs, not loaded afterwards.");
  lines.push("2. It has to load before the NVIDIA driver binds the card.");
  lines.push("3. The kernel parameter opts a card in; without it the module leaves the card alone.");
  lines.push("4. Only then make the boot entry persistent, and keep a stock entry to fall back to.");
  lines.push("");
  lines.push("## Source repositories");
  lines.push(`- Ampere module: ${REPOS.ampere}`);
  lines.push(`- Ada module: ${REPOS.ada}`);
  lines.push(`- Turing module: ${REPOS.turing}`);
  lines.push(`- Install walkthrough: ${REPOS.usage}`);
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
