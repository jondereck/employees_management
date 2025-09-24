import prismadb from "@/lib/prismadb";

export default async function getChangeRequests(departmentId: string) {
const items = await prismadb.changeRequest.findMany({
where: { departmentId, status: "PENDING" },
orderBy: { createdAt: "desc" },
select: {
id: true,
departmentId: true,
employeeId: true,
entityType: true,
entityId: true,
action: true,
status: true,
oldValues: true,
newValues: true,
note: true,
submittedName: true,
submittedEmail: true,
createdAt: true,
employee: {
select: {
id: true,
firstName: true,
middleName: true,
lastName: true,
suffix: true,
employeeNo: true,
offices: { select: { name: true } },
},
},
},
});


return items;
}