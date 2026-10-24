import { DEVICES, acceptedCount } from "@/data/devices";
import { BENCH_RUNS } from "@/data/benchmarks";
import { REPOS, SITE } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const lines: string[] = [];

  lines.push("# GPU Unlock");
  lines.push("");
  lines.push(
    "> Documentation for three upstream NVIDIA kernel modules that enable the SM speed-select override: Zagitta/gpu-unlock (Ampere), JustAResearcher/gpu-unlock-ada (Ada) and nlzy/turing-unlock (Turing, RTX 20 series). Every number on this site comes from those repositories' evidence folders or README tables.",
  );
  lines.push("");
  lines.push("Key facts:");
  lines.push(`- ${acceptedCount()} PCI device IDs are accepted across AD102, AD103, GA102, GA103, GA104, GA106, TU102, TU104 and TU106.`);
  lines.push("- Exactly 3 cards have published same-card stock-vs-unlocked measurements: RTX 4090, RTX 4070 Ti SUPER and RTX 2080 Ti.");
  lines.push("- Peak tensor gain is 2x, and only on f16/f32 and bf16/f32 on RTX 4090. FP32, INT8 and FP8 paths were never rate-limited.");
  lines.push("- Linux only. The module must load before the stock NVIDIA driver, via initramfs.");
  lines.push("- Turing is a separate module (`turing_unlock`) with its own parameter `turing_unlock.targets=`; `gpu_unlock.targets=` does nothing on RTX 20 series cards.");
  lines.push("");
  lines.push("## Pages");
  lines.push(`- [Home](${SITE}/en): overview, headline numbers, quick table`);
  lines.push(`- [Cards](${SITE}/en/gpus): every device the module matches, with status per card`);
  lines.push(`- [Benchmarks](${SITE}/en/benchmarks): full stock-vs-unlocked rows, including the rows that did not move`);
  lines.push(`- [Install](${SITE}/en/install): initramfs ordering, kernel parameters, verification, rollback`);
  lines.push(`- [FAQ](${SITE}/en/faq): Windows support, safety, driver requirements, failure modes`);
  lines.push("");
  lines.push("## Confirmed cards");
  lines.push("");
  for (const d of DEVICES.filter((x) => x.status === "measured")) {
    lines.push(`### ${d.name} (${d.chip}, ${d.pciId})`);
    lines.push(`- Status: measured on the same card`);
    lines.push(`- Gain: +${d.gainMin}${d.gainMax && d.gainMax !== d.gainMin ? `-${d.gainMax}` : ""}% on tensor f16/f32 paths`);
    lines.push(`- Page: ${SITE}/en/gpus/${d.slug}`);
    lines.push(`- Evidence: ${d.sources[0]}`);
    lines.push("");
  }
  lines.push("## Benchmark rows");
  lines.push("");
  for (const run of BENCH_RUNS) {
    lines.push(`### ${run.card} (${run.chip})`);
    for (const r of run.rows) {
      lines.push(`- ${r.mode}: ${r.stock} -> ${r.unlocked} ${r.unit} (${r.ratio}x)`);
    }
    lines.push("");
  }
  lines.push("## Source repositories");
  lines.push(`- Ampere module: ${REPOS.ampere}`);
  lines.push(`- Ada module: ${REPOS.ada}`);
  lines.push(`- Turing module: ${REPOS.turing}`);
  lines.push(`- Usage notes and install walkthrough: ${REPOS.usage}`);
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
