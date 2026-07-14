import prismadb from "../lib/prismadb";

async function main() {
  const [employees, offices, divisions, plantilla, withDiv, withPlant] =
    await Promise.all([
      prismadb.employee.count(),
      prismadb.offices.count(),
      prismadb.officeDivision.count(),
      prismadb.plantillaPosition.count(),
      prismadb.employee.count({ where: { officeDivisionId: { not: null } } }),
      prismadb.employee.count({ where: { plantillaPositionId: { not: null } } }),
    ]);

  console.log(
    JSON.stringify(
      { employees, offices, divisions, plantilla, withDiv, withPlant },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismadb.$disconnect();
  });
