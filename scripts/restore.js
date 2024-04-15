const { PrismaClient } = require("@prisma/client");
const { getBackup } = require("@vorlefan/prisma-backup");

const prisma = new PrismaClient();

async function restoreModel(model, data) {
  // Assuming that your model has a `create` or `createMany` method
  // Adjust this based on your actual Prisma model methods
  await model.createMany({
    data,
    skipDuplicates: true, // Skip if data already exists
  });
}

async function main() {
  try {
    const backupFolderName = '07-52-2024-04-03'; // Provide the actual backup folder name

    const getBackupProps = {
      folder: 'backups',
      backupFolderName,
      onRoute: (route) => {
        // Define the route if needed
      },
      onCurrentModel: async ({ instance, currentModel, currentFile }) => {
        const modelName = currentFile.name;

        switch (modelName) {
          case 'Department':
            await restoreModel(prisma.department, currentModel);
            break;
          case 'Billboard':
            await restoreModel(prisma.billboard, currentModel);
            break;
          case 'Offices':
            await restoreModel(prisma.offices, currentModel);
            break;
          case 'EmployeeType':
            await restoreModel(prisma.employeeType, currentModel);
            break;
          case 'Eligibility':
            await restoreModel(prisma.eligibility, currentModel);
            break;
          case 'Employee':
            await restoreModel(prisma.employee, currentModel);
            break;
          case 'Image':
            await restoreModel(prisma.image, currentModel);
            break;
          // Add more cases for other models as needed
          default:
            console.warn(`Unknown model: ${modelName}`);
        }
      },
    };

    await getBackup(getBackupProps);

    // Close the Prisma connection
    await prisma.$disconnect();
  } catch (error) {
    console.error("Error restoring backup", error);
  }
}

// Call the async function to start the restore process
main();
