import prismadb from "@/lib/prismadb";

interface GraphData {
  name: string; // e.g., "Jan 2024"
  total: number;
}

export const getGraph = async (departmentId: string) => {
  const totalEmployees = await prismadb.employee.findMany({
    where: {
      departmentId: departmentId,
      isArchived: false,
    },
  });

  const monthlyData: { [key: string]: number } = {}; // key format: "Jan 2024"

  for (const employee of totalEmployees) {
    const date = employee.createdAt;
    const month = date.toLocaleString("default", { month: "short" }); // "Jan"
    const year = date.getFullYear(); // e.g., 2024
    const label = `${month} ${year}`; // e.g., "Jan 2024"

    monthlyData[label] = (monthlyData[label] || 0) + 1;
  }

  // Convert to array and sort chronologically
  const graphData: GraphData[] = Object.entries(monthlyData)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => {
      const [monthA, yearA] = a.name.split(" ");
      const [monthB, yearB] = b.name.split(" ");
      const dateA = new Date(`${monthA} 1, ${yearA}`);
      const dateB = new Date(`${monthB} 1, ${yearB}`);
      return dateA.getTime() - dateB.getTime();
    });

  return graphData;
};
