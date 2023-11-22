
const { PrismaClient } = require("@prisma/client");
const { runBackup } = require("@vorlefan/prisma-backup");

const db = new PrismaClient();
async function main() {
  try {
    const timestamp = new Date();
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hours = String(timestamp.getHours()).padStart(2, '0');
    const minutes = String(timestamp.getMinutes()).padStart(2, '0');
    
    const folderName = `${hours}-${minutes}-${year}-${month}-${day}`;

    // prisma models
    const department = await db.department.findMany();
    const billboard = await db.billboard.findMany();
    const offices = await db.offices.findMany();
    const employeeType = await db.employeeType.findMany();
    const eligibility = await db.eligibility.findMany();
    const images = await db.image.findMany();
    const employees = await db.employee.findMany({
      include: {
        images: true, // Include related images
      },
    });

    await runBackup({
      models: {
        department: department,
        billboard: billboard,
        offices: offices,
        employeeType: employeeType,
        eligibility: eligibility,
        image: images,
        employees: employees,
      },
      folder: "/backups",
      backupFolderName: folderName
    });

    await db.$disconnect;

  } catch (error) {
    console.error("Error creating a backup", error)
  }
}

main();