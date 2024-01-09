// import React, { useEffect, useState } from 'react';
// import axios from 'axios';

// interface AddressSelectorProps {
//   loading: boolean;
//   onSelectChange: (selectedValue: string) => void;
// }

// const AddressSelector: React.FC<AddressSelectorProps> = ({ loading, onSelectChange }) => {
//   const [regions, setRegions] = useState([]);
//   const [provinces, setProvinces] = useState([]);
//   const [cities, setCities] = useState([]);
//   const [barangays, setBarangays] = useState([]);

//   const [selectedRegion, setSelectedRegion] = useState('');
//   const [selectedProvince, setSelectedProvince] = useState('');
//   const [selectedCity, setSelectedCity] = useState('');
//   const [selectedBarangay, setSelectedBarangay] = useState('');
//   const handleRegionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
//     const value = event.target.value;
//     setSelectedRegion(value);
//     setSelectedProvince('');
//     setSelectedCity('');
//     setSelectedBarangay('');
//     onSelectChange(value);
//   };

//   const handleProvinceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
//     const value = event.target.value;
//     setSelectedProvince(value);
//     setSelectedCity('');
//     setSelectedBarangay('');
//     onSelectChange(value);
//   };

//   const handleCityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
//     const value = event.target.value;
//     setSelectedCity(value);
//     setSelectedBarangay('');
//     onSelectChange(value);
//   };

//   const handleBarangayChange = (
//     event: React.ChangeEvent<HTMLSelectElement>
//   ) => {
//     const value = event.target.value;
//     setSelectedBarangay(value);
//     onSelectChange(value);
//   };

//   // Fetch regions on component mount
//   useEffect(() => {
//     const fetchRegions = async () => {
//       try {
//         const response = await axios.get('/ph-json/region.json');
//         setRegions(response.data);
//       } catch (error) {
//         console.error('Error fetching regions', error);
//       }
//     };

//     fetchRegions();
//   }, []);

//   // Fetch provinces when selectedRegion changes
//   useEffect(() => {
//     const fetchProvinces = async () => {
//       try {
//         if (selectedRegion) {
//           const response = await axios.get(`ph-json/province.json?region_code=${selectedRegion}`);
//           setProvinces(response.data);
//         }
//       } catch (error) {
//         console.error('Error fetching provinces', error);
//       }
//     };

//     fetchProvinces();
//   }, [selectedRegion]);

//   // Fetch cities when selectedProvince changes
//   useEffect(() => {
//     const fetchCities = async () => {
//       try {
//         if (selectedProvince) {
//           const response = await axios.get(`ph-json/city.json?province_code=${selectedProvince}`);
//           setCities(response.data);
//         }
//       } catch (error) {
//         console.error('Error fetching cities', error);
//       }
//     };

//     fetchCities();
//   }, [selectedProvince]);

//   // Fetch barangays when selectedCity changes
//   useEffect(() => {
//     const fetchBarangays = async () => {
//       try {
//         if (selectedCity) {
//           const response = await axios.get(`/ph-json/barangay.json?city_code=${selectedCity}`);
//           setBarangays(response.data);
//         }
//       } catch (error) {
//         console.error('Error fetching barangays', error);
//       }
//     };

//     fetchBarangays();
//   }, [selectedCity]);

//   // Handle selection changes and trigger callback
//   const handleRegionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
//     const value = event.target.value;
//     setSelectedRegion(value);
//     setSelectedProvince('');
//     setSelectedCity('');
//     setSelectedBarangay('');
//     onSelectChange(value);
//     console.log('Selected Region:', value);
//   };

//   const handleProvinceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
//     const value = event.target.value;
//     setSelectedProvince(value);
//     setSelectedCity('');
//     setSelectedBarangay('');
//     onSelectChange(value);
//   };

//   const handleCityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
//     const value = event.target.value;
//     setSelectedCity(value);
//     setSelectedBarangay('');
//     onSelectChange(value);
//   };

//   const handleBarangayChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
//     const value = event.target.value;
//     setSelectedBarangay(value);
//     onSelectChange(value);
//   };

//   return (
//     <div>
//       <select value={selectedRegion} onChange={handleRegionChange} disabled={loading}>
//         <option value="" disabled>Select Region</option>
//         {regions.map((region) => (
//           <option key={region.region_code} value={region.region_code}>{region.region_name}</option>
//         ))}
//       </select>

//       <select value={selectedProvince} onChange={handleProvinceChange} disabled={loading}>
//         <option value="" disabled>Select Province</option>
//         {provinces.map((province) => (
//           <option key={province.province_code} value={province.province_code}>{province.province_name}</option>
//         ))}
//       </select>

//       <select value={selectedCity} onChange={handleCityChange} disabled={loading}>
//         <option value="" disabled>Select City/Municipality</option>
//         {cities.map((city) => (
//           <option key={city.city_code} value={city.city_code}>{city.city_name}</option>
//         ))}
//       </select>

//       <select value={selectedBarangay} onChange={handleBarangayChange} disabled={loading}>
//         <option value="" disabled>Select Barangay</option>
//         {barangays.map((barangay) => (
//           <option key={barangay.brgy_code} value={barangay.brgy_code}>{barangay.brgy_name}</option>
//         ))}
//       </select>
//     </div>
//   );
// };

// export default AddressSelector;
