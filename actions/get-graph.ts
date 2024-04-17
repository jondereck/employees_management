import prismadb from "@/lib/prismadb";

interface GraphData {
  name: string;
  total: number;
}

export const getGraph = async (departmentId: string) => {
  const totalEmployees = await prismadb.employee.findMany({
    where: {
      departmentId: departmentId,
      isArchived: false
    },
  });

  const monthlyEmployee: { [key: number]: number } = {};

  // Iterate through each employee to count their addition month
  for (const employee of totalEmployees) {
    const month = employee.createdAt.getMonth();
    monthlyEmployee[month] = (monthlyEmployee[month] || 0) + 1; // Increment the count for the month
    
  }
  

  const graphData: GraphData[] = [
    { name: "Jan", total: 0 },
    { name: "Feb", total: 0 },
    { name: "Mar", total: 0 },
    { name: "Apr", total: 0 },
    { name: "May", total: 0 },
    { name: "Jun", total: 0 },
    { name: "Jul", total: 0 },
    { name: "Aug", total: 0 },
    { name: "Sep", total: 0 },
    { name: "Oct", total: 0 },
    { name: "Nov", total: 0 },
    { name: "Dec", total: 0 },
  ];

  // Update the graph data with the total employees added for each month
  for (const month in monthlyEmployee) {
    graphData[parseInt(month)].total = monthlyEmployee[parseInt(month)];
  }
  console.log(graphData);

  return graphData;
};
