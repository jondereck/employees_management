const { getBackup } = require("@vorlefan/prisma-backup");
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

async function main() {
  try {
    await getBackup({
      onCurrentModel: async function ({ instance, currentModel, currentFile }) {
        if (currentFile.name === "department") {
          const data = currentModel;

          // Check if a bookmark with the same unique identifier (e.g., id) exists
          const existingDepartment = await db.department.findUnique({
            where: {
              id: data.id, // Assuming id is the unique identifier
            },
          });

          if (!existingDepartment) {
            // Insert the bookmark into the database
            const newBookmark = await db.department.create({
              data: {
                userId: data.userId,
                name: data.name,
              },
            });
            console.log('Restored bookmarks', newBookmark);
          } else {
            console.log(`Department already exist. Skipping ${data.name}...`)
          }


        } else if (currentFile.name === "billboard") {
          const data = currentModel;

          // Check if a bookmark with the same unique identifier (e.g., id) exists
          const existingBillboard = await db.billboard.findUnique({
            where: {
              id: data.id, // Assuming id is the unique identifier
            },
          });

          if (!existingBillboard) {
            // Insert the bookmark into the database
            const newBillboard = await db.billboard.create({
              data: {
                userId: data.userId,
                departmentId: data.departmentId,
                label: data.label,
                imageUrl: data.imageUrl,

              },
            });
            console.log('Restored Billboard', newBillboard);
          } else {
            console.log(`Billboard already exist. Skipping ${data.label}...`)
          }


        } else if (currentFile.name === "offices") {
          const data = currentModel;
        
          // Check if an office with the same unique identifier (e.g., id) exists
          const existingOffice = await db.offices.findUnique({
            where: {
              id: data.id, // Assuming id is the unique identifier
            },
          });
        
          if (!existingOffice) {
            // Insert the office into the database
            const newOffice = await db.offices.create({
              data: {
                departmentId: data.departmentId,
                billboardId: data.billboardId,
                name: data.name,
                // Add other fields as needed based on your Prisma schema
              },
            });
            console.log('Restored Office', newOffice);
          } else {
            console.log(`Office already exists. Skipping ${data.name}...`);
          }
        } else if (currentFile.name === "eligibility") {
          const data = currentModel;
        
          // Check if an eligibility with the same unique identifier (e.g., id) exists
          const existingEligibility = await db.eligibility.findUnique({
            where: {
              id: data.id, // Assuming id is the unique identifier
            },
          });
        
          if (!existingEligibility) {
            // Insert the eligibility into the database
            const newEligibility = await db.eligibility.create({
              data: {
                departmentId: data.departmentId,
                // Add other fields as needed based on your Prisma schema
                eligibilityTypes: data.eligibilityTypes,
                customType: data.customType,
                value: data.value,
              },
            });
            console.log('Restored Eligibility', newEligibility);
          } else {
            console.log(`Eligibility already exists. Skipping ${data.value}...`);
          }
        } else if (currentFile.name === "employeeType") {
          const data = currentModel;
        
          // Check if an employee type with the same unique identifier (e.g., id) exists
          const existingEmployeeType = await db.employeeType.findUnique({
            where: {
              id: data.id, // Assuming id is the unique identifier
            },
          });
        
          if (!existingEmployeeType) {
            // Insert the employee type into the database
            const newEmployeeType = await db.employeeType.create({
              data: {
                departmentId: data.departmentId,
                // Add other fields as needed based on your Prisma schema
                name: data.name,
                value: data.value,
              },
            });
            console.log('Restored EmployeeType', newEmployeeType);
          } else {
            console.log(`EmployeeType already exists. Skipping ${data.name}...`);
          }
        } else if (currentFile.name === "image") {
          const data = currentModel;
        
          // Check if an image with the same unique identifier (e.g., id) exists
          const existingImage = await db.image.findUnique({
            where: {
              id: data.id, // Assuming id is the unique identifier
            },
          });
        
          if (!existingImage) {
            // Insert the image into the database
            const newImage = await db.image.create({
              data: {
                employeeId: data.employeeId,
                employee:data.employee,
                url: data.url,
              },
            });
            console.log('Restored Image', newImage);
          } else {
            console.log(`Image already exists. Skipping ${data.url}...`);
          }
        } else if (currentFile.name === "employee") {
  const data = currentModel;

  // Check if an employee with the same unique identifier (e.g., id) exists
  const existingEmployee = await db.employee.findUnique({
    where: {
      id: data.id, // Assuming id is the unique identifier
    },
  });

  if (!existingEmployee) {
    // Insert the employee into the database
    const newEmployee = await db.employee.create({
      data: {
        departmentId: data.departmentId,
        officeId: data.officeId,
        lastName: data.lastName,
        firstName: data.firstName,
        middleName: data.middleName,
        suffix: data.suffix,
        gender: data.gender,
        contactNumber: data.contactNumber,
        position: data.position,
        birthday: new Date(data.birthday), // Convert to Date object if needed
        age: data.age,
        gsisNo: data.gsisNo,
        tinNo: data.tinNo,
        philHealthNo: data.philHealthNo,
        pagIbigNo: data.pagIbigNo,
        salary: data.salary,
        dateHired: new Date(data.dateHired), // Convert to Date object if needed
        employeeTypeId: data.employeeTypeId,
        eligibilityId: data.eligibilityId,
        isFeatured: data.isFeatured,
        isArchived: data.isArchived,
        image: data.image,
        // Add other fields as needed based on your Prisma schema
      },
    });


 
  } else {
    console.log(`Employee already exists. Skipping ${data.lastName} ${data.firstName}...`);
  }
}



         
        
        
      },
      folder: "/backups",
      backupFolderName: "17-06-2023-11-21", // Specify the name of the folder you want to restore from
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

main();