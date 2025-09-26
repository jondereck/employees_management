require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function norm(s){return String(s||"").trim().toLowerCase().replace(/\s+/g," ");}

(async () => {
  try {
    const offices = await prisma.offices.findMany({ select: { id: true, name: true }, orderBy:{name:"asc"} });
    const dataDir = path.resolve("data");
    const csvPath = path.join(dataDir, "office_index.csv");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    // If CSV missing, create a fill-in template and exit
    if (!fs.existsSync(csvPath)) {
      const lines = ["name,code"];
      for (const o of offices) lines.push(`${o.name},`);
      fs.writeFileSync(csvPath, lines.join("\n"));
      console.log(`Created ${csvPath}. Please open it and fill the "code" for each office (e.g., HRMO -> 854000). Then run this script again.`);
      return;
    }

    // Read filled CSV
    const raw = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
    raw.shift(); // header
    const nameToCode = new Map();
    for (const line of raw) {
      const [name, code] = line.split(",").map(s => (s||"").trim());
      if (!name) continue;
      if (code) nameToCode.set(norm(name), code);
    }

    // Build ID-keyed map file
    const outLines = [];
    outLines.push("export const OFFICE_INDEX_CODE_BY_ID: Record<string, string> = {");
    for (const o of offices) {
      const code = nameToCode.get(norm(o.name)) || "";
      outLines.push(`  "${o.id}": "${code}", // ${o.name}`);
    }
    outLines.push("};\n");

    const outDir = path.resolve("lib");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, "bio-index-map.ts");
    fs.writeFileSync(outFile, outLines.join("\n"));
    console.log(`Wrote ${outFile}. Fill any empty codes in CSV and rerun if needed.`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
