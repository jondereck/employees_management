import {
  searchRegion,
  searchMunicipality,
  searchProvince,
  searchBaranggay,
} from 'ph-geo-admin-divisions';

const formatDivision = () => {
  const barangays = searchBaranggay({});
  const regions = searchRegion({});
  const municipalities = searchMunicipality({});
  const provinces = searchProvince({});

  console.log('barangays', barangays);
    console.log('regions', regions);
    console.log('municipalities', municipalities);
    console.log('provinces', provinces);

  const formattedAddresses = barangays.map((barangay) => {
    const municipal = municipalities.find(
      (municipal) => municipal.municipalityId === barangay.municipalityId
    );
    const municipalName = municipal ? municipal.name : '';
    const province = provinces.find(
      (province) => province.provinceId === barangay.provinceId
    );
    const provinceName = province ? province.name : '';
    const region = regions.find((region) => region.regionId === barangay.regionId);
    const regionName = region ? region.name : '';

    return {
      value: barangay.psgcId,
      barangay: barangay.name,
      municipality:municipalName,
      province: provinceName,
      region: regionName,
    };
  });

  return {
    barangays: formattedAddresses,
  };
};

const useAddresses = () => {
  const formattedDivisions = formatDivision();

  const getAll = () => formattedDivisions;

  const getByValue = (value: string) => {
    const { barangays } = formattedDivisions;
    const location = barangays.find((barangay) => barangay.value === value);

    // Return an array to match the expected usage
    return location ? [location] : [];
  };

  return {
    getAll,
    getByValue,
  };
};

export default useAddresses;
