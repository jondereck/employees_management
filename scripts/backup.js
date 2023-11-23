const { PrismaClient } = require("@prisma/client");
const { runBackup } = require("@vorlefan/prisma-backup");

const prisma = new PrismaClient();

async function main() {
  try {
    const timestamp = new Date();
    const year = timestamp.getFullYear();
    const month = String(timestamp.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
    const day = String(timestamp.getDate()).padStart(2, '0');
    const hours = String(timestamp.getHours()).padStart(2, '0');
    const minutes = String(timestamp.getMinutes()).padStart(2, '0');
    
    const folderName = `${hours}-${minutes}-${year}-${month}-${day}`;

    const backupProps = {
      // encrypt: true,
      // password: 'test', 
      folder: 'backups',
      models: {
          Department: await prisma.department.findMany(),
          Billboard: await prisma.billboard.findMany(),
          Offices: await prisma.offices.findMany(),
          EmployeeType: await prisma.employeeType.findMany(),
          Eligibility: await prisma.eligibility.findMany(),
          Employee: await prisma.employee.findMany(),
          Image: await prisma.image.findMany(),
      },
      onRoute: (route) => {
          // Define the route if needed
      },
      backupFolderName: folderName, // Use the variable directly
    };

    // Call runBackup with the backupProps
    await runBackup(backupProps);

    // Close the Prisma connection
    await prisma.$disconnect();
  } catch (error) {
    console.error("Error creating a backup", error);
  }
}

// Call the async function to start the backup process
main();
