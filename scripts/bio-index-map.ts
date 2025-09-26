// scripts/build-office-index-map.ts
import fs from "fs";
import path from "path";
import prisma from "@/lib/prismadb";

function norm(s: string) { return s.trim().toLowerCase().replace(/\s+/g, " "); }

async function main() {
  const csvPath = path.resolve("data/office_index.csv");
  const csv = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean).slice(1);
  const byName = new Map<string, string>(); // normName -> code
  for (const line of csv) {
    const [name, code] = line.split(",").map(s => s.trim());
    if (name && code) byName.set(norm(name), code);
  }

  const offices = await prisma.offices.findMany({ select: { id: true, name: true } });

  const lines: string[] = [];
  lines.push("export const OFFICE_INDEX_CODE_BY_ID: Record<string,string> = {");
  for (const o of offices) {
    const code = byName.get(norm(o.name)) ?? "";
    lines.push(`  "${o.id}": "${code}", // ${o.name}`);
  }
  lines.push("};");

  const out = path.resolve("lib/bio-index-map.ts");
  fs.writeFileSync(out, lines.join("\n"));
  console.log(`Wrote ${out}`);
}
main().finally(() => prisma.$disconnect());
