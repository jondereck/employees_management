// pages/api/searchEmployees.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import prismadb from '@/lib/prismadb';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { searchItem } = req.query;

    try {
      const employees = await prismadb.employee.findMany({
        where: {
          OR: [
            { lastName: { contains: searchItem as string } },
            // Add other search conditions as needed
          ],
        },
      });

      res.status(200).json(employees);
    } catch (error) {
      console.error('Error searching employees:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}
