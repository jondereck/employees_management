// pages/api/geo.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { searchRegion, searchProvince, searchMunicipality, searchBaranggay } from 'ph-geo-admin-divisions';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;

  try {
    let result;

    switch (action) {
      case 'regions':
        result = await searchRegion({});
        break;
      case 'provinces':
        const regionId = typeof req.query.regionId === 'string' ? req.query.regionId : undefined;
        result = await searchProvince({ regionId });
        break;
      case 'municipalities':
        const provinceId = typeof req.query.provinceId === 'string' ? req.query.provinceId : undefined;
        result = await searchMunicipality({ provinceId });
        break;
      case 'barangays':
        const municipalityId = typeof req.query.municipalityId === 'string' ? req.query.municipalityId : undefined;
        result = await searchBaranggay({ municipalityId });
        break;
      default:
        throw new Error('Invalid action');
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
