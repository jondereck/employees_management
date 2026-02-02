import { prisma } from "@/lib/prisma";
import { streamReply } from "../utils";

function calculateAge(birthday: Date) {
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const m = today.getMonth() - birthday.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthday.getDate())) {
    age--;
  }
  return age;
}

export async function handleAgeDistribution(context: any) {
  const employees = await prisma.employee.findMany({
    where: {
      isArchived: false,
   
    },
    select: { birthday: true },
  });

  const ages = employees.map(e => calculateAge(e.birthday!)).sort((a, b) => a - b);

  if (ages.length === 0) {
    return streamReply("No age data available.", context, null);
  }

  const percentile = (p: number) =>
    ages[Math.floor((p / 100) * ages.length)];

  const p25 = percentile(25);
  const p50 = percentile(50);
  const p75 = percentile(75);

  const distribution: Record<string, number> = {
    "Below 20": ages.filter(a => a < 20).length,
    "20–29": ages.filter(a => a >= 20 && a <= 29).length,
    "30–39": ages.filter(a => a >= 30 && a <= 39).length,
    "40–49": ages.filter(a => a >= 40 && a <= 49).length,
    "50–59": ages.filter(a => a >= 50 && a <= 59).length,
    "60–69": ages.filter(a => a >= 60 && a <= 69).length,
    "70+": ages.filter(a => a >= 70).length,
  };

  let reply = `**Age Distribution**\n\n`;
  for (const [range, count] of Object.entries(distribution)) {
    reply += `• ${range}: **${count}**\n`;
  }

  reply += `\n**Percentiles**\n`;
  reply += `• 25th percentile: **${p25}**\n`;
  reply += `• Median (50th): **${p50}**\n`;
  reply += `• 75th percentile: **${p75}**\n`;

  return streamReply(reply, context, null);
}
