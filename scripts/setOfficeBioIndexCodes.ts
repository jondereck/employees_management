// scripts/setOfficeBioIndexCodes.ts
import prismadb from "@/lib/prismadb";

// --- toggles ---
const FORCE_OVERWRITE = true;   // <— set to true para i-update kahit may laman na
const DRY_RUN = false;          // <— set to true para walang DB writes (preview only)

// Helper: case-insensitive RegExp
function ci(pattern: string) {
  return new RegExp(pattern, "i");
}

// Optional: normalize numeric strings (remove spaces, keep digits)
function normCode(s: string | null | undefined) {
  return (s ?? "").toString().replace(/\D+/g, "");
}

// Rules
const ruleDefs: Array<{ tests: RegExp[]; code: string }> = [
  { tests: [ci("^\\s*Bureau of Internal Revenue"), ci("\\bBIR\\b")], code: "4180000" },
  { tests: [ci("^\\s*Public Employment Service Office"), ci("\\bPESO\\b")], code: "120000" },
  { tests: [ci("^\\s*Bids? and Awards Committee"), ci("\\bBAC\\b")], code: "6190000" },
  { tests: [ci("^\\s*Business Permit and Licensing Office"), ci("\\bBPLO\\b")], code: "4910000" },
  { tests: [ci("^\\s*Commission on Audit"), ci("\\bCOA\\b")], code: "418000" },
  { tests: [ci("^\\s*Commission on (Elections?|Election)"), ci("\\bCOMELEC\\b")], code: "4180000" },
  { tests: [ci("^\\s*Contract of Service"), ci("\\bCoS\\b"), ci("\\bCOS\\b")], code: "6660000" },
  { tests: [ci("^\\s*Department of Interior and Local Government"), ci("\\bDILG\\b")], code: "4180000" },
  { tests: [ci("^\\s*Department of Trade and Industry"), ci("\\bDTI\\b")], code: "4180000" },
  { tests: [ci("^\\s*General Service Office"), ci("\\bGSO\\b")], code: "3620000" },
  { tests: [ci("^\\s*Human Resource Management Office"), ci("\\bHRMO\\b")], code: "8540000" },
  { tests: [ci("^\\s*Land Transportation Office"), ci("\\bLTO\\b")], code: "4180000" },
  { tests: [ci("^\\s*Local Disaster Risk Reduction and Management Office"), ci("\\bLDRRMO\\b")], code: "5010000" },
  { tests: [ci("^\\s*Local Youth Development Office")], code: "5900000" },
  { tests: [ci("^\\s*Market Office")], code: "2580000" },
  { tests: [ci("^\\s*Slaughterhouse Office")], code: "2610000" },
  { tests: [ci("^\\s*Municipal Accounting Office")], code: "3280000" },
  { tests: [ci("^\\s*Municipal Agriculture Office")], code: "7840000" },
  { tests: [ci("^\\s*Municipal Assessor Office")], code: "7120000" },
  { tests: [ci("^\\s*Municipal Budget Office")], code: "3070000" },
  { tests: [ci("^\\s*Municipal Civil Registrar")], code: "6190000" },
  { tests: [ci("^\\s*Municipal Engineering Office")], code: "7520000" },
  { tests: [ci("^\\s*Municipal Environment.*Natural Resources Office"), ci("\\bMENRO\\b")], code: "6310000" },
  { tests: [ci("^\\s*Municipal Information Office")], code: "2840000" },
  { tests: [ci("^\\s*Municipal Legal Office")], code: "6350000" },
  { tests: [ci("^\\s*Municipal Library")], code: "1740000" },
  { tests: [ci("^\\s*Municipal Planning and Development Office"), ci("\\bMPDO\\b")], code: "8350000" },
  { tests: [ci("^\\s*Municipal Social Welfare and Development Office"), ci("\\bMSWDO\\b")], code: "5900000" },
  { tests: [ci("^\\s*Municipal Special Action Team"), ci("\\bMSAT\\b")], code: "5020000" },
  { tests: [ci("^\\s*Municipal Tourism Office")], code: "6900000" },
  { tests: [ci("^\\s*Municipal Treasurer'?s Office"), ci("\\bTreasurer\\b")], code: "4910000" },
  { tests: [ci("^\\s*Office of the Administrator( Office)?$")], code: "1810000" },
  { tests: [ci("^\\s*Office of the Mayor$")], code: "1200000" },
  { tests: [ci("^\\s*Office of the SB Secretary$")], code: "1740000" },
  { tests: [ci("^\\s*Office of the Vice Mayor$")], code: "1470000" },
  { tests: [ci("^\\s*Public Order and Safety Office"), ci("\\bPOSO\\b")], code: "8230000" },
  // RHU variants share one code
  { tests: [ci("^\\s*Rural Health Unit\\s*I\\b"), ci("\\bRHU\\s*I\\b")], code: "2050000" },
  { tests: [ci("^\\s*Rural Health Unit\\s*II\\b"), ci("\\bRHU\\s*II\\b")], code: "2050000" },
  { tests: [ci("^\\s*Rural Health Unit\\s*III\\b"), ci("\\bRHU\\s*III\\b")], code: "2050000" },
  { tests: [ci("^\\s*Sangguniang Bayan Legislative")], code: "715000" },
  { tests: [ci("^\\s*Security Service Office")], code: "8790000" }, // 7 digits per your list
  { tests: [ci("^\\s*The People'?s Law Enforcement Board"), ci("\\bPLEB\\b")], code: "1200000" },

  // Redundant 418000* mappers kept intentionally
  { tests: [ci("^\\s*Commission on Audit"), ci("\\bCOA\\b")], code: "4180000" },
  { tests: [ci("^\\s*Commission on Elections?"), ci("\\bCOMELEC\\b")], code: "4180000" },
  { tests: [ci("^\\s*Department of Trade and Industry"), ci("\\bDTI\\b")], code: "4180000" },
  { tests: [ci("^\\s*Department of Interior and Local Government"), ci("\\bDILG\\b")], code: "4180000" },
  { tests: [ci("^\\s*Land Transportation Office"), ci("\\bLTO\\b")], code: "4180000" },
];

const rules = ruleDefs.map(({ tests, code }) => ({
  test: (s: string) => tests.some(r => r.test(s)),
  code: normCode(code),
}));

async function main() {
  const offices = await prismadb.offices.findMany({
    select: { id: true, name: true, bioIndexCode: true },
  });

  let updated = 0, skippedNoRule = 0, skippedSame = 0;

  for (const o of offices) {
    const hit = rules.find(r => r.test(o.name));
    if (!hit) {
      console.log(`SKIP (no rule): ${o.name}`);
      skippedNoRule++;
      continue;
    }

    const current = normCode(o.bioIndexCode);
    const target = hit.code;

    // If not forcing and may laman na, skip; else update only if different
    if (!FORCE_OVERWRITE && current) {
      console.log(`SKIP (has value, FORCE_OVERWRITE=false): ${o.name} (${current})`);
      continue;
    }

    if (current === target) {
      skippedSame++;
      continue; // no-op
    }

    console.log(`UPDATE ${o.name}: ${current || "(empty)"} -> ${target}`);

    if (!DRY_RUN) {
      await prismadb.offices.update({
        where: { id: o.id },
        data: { bioIndexCode: target },
      });
    }
    updated++;
  }

  console.log(`Done. Updated: ${updated}, Same/no-op: ${skippedSame}, No rule: ${skippedNoRule}${DRY_RUN ? " (DRY RUN)" : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prismadb.$disconnect();
  });
