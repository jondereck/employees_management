// Import necessary libraries or database connections
import { NextApiRequest, NextApiResponse } from 'next';

// Example of version information
const versionInfo = {
  version: 2, // Example version number
  lastUpdated: Date.now(), // Example timestamp
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    res.status(200).json(versionInfo);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
