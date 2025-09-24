import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Respect local calendar day, then pin to 12:00 UTC to avoid tz shift
function toUTCNoonFromLocalDate(d: Date): Date {
  const y = d.getFullYear();     // local parts
  const m = d.getMonth();
  const day = d.getDate();
  return new Date(Date.UTC(y, m, day, 12, 0, 0)); // 12:00Z
}

// --- tiny args parser: --key=value or --flag
const ARGS = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  })
);
// Flags
const APPLY = ARGS.apply === "true" || ARGS.apply === ""; // write changes only if --apply is present
const EMPLOYEE_ID = ARGS.employeeId || ARGS.employee || ""; // --employeeId=UUID
const LIMIT = ARGS.limit ? Number(ARGS.limit) : undefined;  // --limit=10 (optional)

function fmtSec(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
function progress(i: number, total: number, startedAt: number) {
  const done = i;
  const pct = Math.min(100, (done / total) * 100);
  const elapsed = (Date.now() - startedAt) / 1000;
  const rate = done > 0 ? done / elapsed : 0;
  const remaining = rate > 0 ? (total - done) / rate : 0;
  const barLen = 26;
  const fill = Math.round((pct / 100) * barLen);
  const bar = "█".repeat(fill) + "░".repeat(barLen - fill);
  return `[${bar}] ${pct.toFixed(1)}%  ${done}/${total}  ETA ${fmtSec(remaining)}  Elapsed ${fmtSec(elapsed)}`;
}

async function fetchEmployees() {
  if (EMPLOYEE_ID) {
    const one = await prisma.employee.findMany({
      where: { id: EMPLOYEE_ID },
      select: {
        id: true,
        dateHired: true,
        position: true,
        offices: { select: { name: true } },
        employeeType: { select: { name: true } },
      },
      take: 1,
    });
    return one;
  }

  const many = await prisma.employee.findMany({
    select: {
      id: true,
      dateHired: true,
      position: true,
      offices: { select: { name: true } },
      employeeType: { select: { name: true } },
    },
    ...(LIMIT ? { take: LIMIT } : {}),
  });
  return many;
}

async function run() {
  const employees = await fetchEmployees();
  const total = employees.length;

  if (total === 0) {
    console.log(EMPLOYEE_ID ? `No employee found for id ${EMPLOYEE_ID}` : "No employees found.");
    return;
  }

  console.log(
    `Backfill HIRED for ${total} employee(s) — ` +
    (APPLY ? "APPLYING changes to DB" : "DRY-RUN (no writes)")
  );

  const startedAt = Date.now();
  let created = 0, updated = 0, skipped = 0;

  let i = 0;
  for (const e of employees) {
    i++;
    try {
      if (!e.dateHired) { skipped++; }
      else {
        const occurredAt = toUTCNoonFromLocalDate(e.dateHired);
        const details = `Hired as ${e.position} (${e.employeeType?.name ?? "—"}) in ${e.offices?.name ?? "—"}.`;

        const existing = await prisma.employmentEvent.findFirst({
          where: { employeeId: e.id, type: "HIRED", deletedAt: null },
          select: { id: true, occurredAt: true, details: true },
        });

        if (!existing) {
          if (APPLY) {
            await prisma.employmentEvent.create({
              data: { employeeId: e.id, type: "HIRED", occurredAt, details },
            });
          }
          created++;
          if (!APPLY) {
            console.log(`\n[DRY] CREATE HIRED for ${e.id} -> occurredAt=${occurredAt.toISOString()} details="${details}"`);
          }
        } else {
          if (APPLY) {
            await prisma.employmentEvent.update({
              where: { id: existing.id },
              data: { occurredAt, details },
            });
          }
          updated++;
          if (!APPLY) {
            console.log(`\n[DRY] UPDATE HIRED ${existing.id} for ${e.id} -> occurredAt=${occurredAt.toISOString()} details="${details}"`);
          }
        }
      }
    } catch (err) {
      skipped++;
      console.log(`\n[WARN] Skipped ${e.id}: ${(err as Error).message}`);
    }

    process.stdout.write("\r" + progress(i, total, startedAt));
  }

  process.stdout.write("\n");
  console.log(`Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
}

run()
  .catch((err) => { console.error("\nBackfill failed:", err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
