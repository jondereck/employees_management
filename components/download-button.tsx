'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';
import { FaFileExcel } from 'react-icons/fa';
import Modal from './ui/modal';

export default function DownloadStyledExcel() {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'retired'>('all');


  const columnOrder = [
    { name: 'Employee No', key: 'employeeNo' },
    { name: 'Last Name', key: 'lastName' },
    { name: 'First Name', key: 'firstName' },
    { name: 'Middle Name', key: 'middleName' },
    { name: 'Suffix', key: 'suffix' },
    { name: 'Nickname', key: 'nickname' },
    { name: 'Office', key: 'officeId' },
    { name: 'Position', key: 'position' },
    { name: 'Employee Type', key: 'employeeTypeId' },
    { name: 'Eligibility', key: 'eligibilityId' },
    { name: 'Gender', key: 'gender' },
    { name: 'Contact Number', key: 'contactNumber' },
    { name: 'Education', key: 'education' },
    { name: 'Birthday', key: 'birthday' }, // Will format the birthday
    { name: 'Age', key: 'age' }, // Calculated from birthday
    { name: 'Latest Appointment', key: 'latestAppointment' },
    { name: 'Date Hired', key: 'dateHired' }, // Will format the date
    { name: 'Year(s) of Service', key: 'yearsOfService' },
    { name: 'Salary', key: 'salary' },
    { name: 'Salary Grade', key: 'salaryGrade' },
    { name: 'Retired', key: 'isArchived' },
    { name: 'House No', key: 'houseNo' },
    { name: 'Street', key: 'street' },
    { name: 'Barangay', key: 'barangay' },
    { name: 'City', key: 'city' },
    { name: 'Province', key: 'province' },
    { name: 'GSIS No', key: 'gsisNo' },
    { name: 'TIN No', key: 'tinNo' },
    { name: 'PhilHealth No', key: 'philHealthNo' },
    { name: 'PagIbig No', key: 'pagIbigNo' },
    { name: 'Terminate Date', key: 'terminateDate' },
    { name: 'Member Policy No', key: 'memberPolicyNo' },
    { name: 'Emergency Contact Name', key: 'emergencyContactName' },
    { name: 'Emergency Contact Number', key: 'emergencyContactNumber' },


  ];

  const isAllSelected = selectedColumns.length === columnOrder.length;

  const defaultKeys = [
    'lastName',
    'firstName',
    'middleName',
    'officeId',
    'position',
    'employeeTypeId',
  ];


  useEffect(() => {
    setSelectedColumns(defaultKeys);
  }, []);


  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
    );
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(columnOrder.map(col => col.key));
    }
  };

  const openModal = () => {
    setSelectedColumns(columnOrder.map(col => col.key));
    setModalOpen(true);
  };

  // Office ID to Name Mapping
  const officeMapping: Record<string, string> = {
    '6d0731ae-e589-46a3-8512-6faad043c3f5': 'Accounting Office',
    'eeaec218-29b9-478f-ba93-b2c530dfb218': 'Bids and Awards Committee (BAC)',
    '761cf73e-1f01-4139-9e93-05f97e6dfbb6': 'BIR Office',
    '8ab9531a-a407-4540-82b0-36724a343f13': 'Commission on Election (COMELEC)',
    '7ec6013e-3dd6-4ee8-8c3b-7e9232b87ca5': 'Contract of Service (CoS)',
    'af7e4d29-7ac6-420c-85b7-f11666b1b038': 'Department of Interior and Local Government (DILG)',
    'fab8fbe1-21ed-40bf-9e7a-0ad6e9903650': 'Department of Trade and Industry (DTI)',
    '484f6b4c-b65d-4a73-9b0f-8b2f35a43090': 'Human Resource Management Office',
    '62006d10-e81b-4a41-8738-187dc086c71a': 'Information Office',
    '668b837c-044d-4f5a-b7ce-6f74d8d6700e': 'Legal Office',
    'c2ece52a-2543-4c1b-b2f9-ded38a0b4574': 'Lingayen Tourism and Cultural Affairs Office (LTCAO)',
    '446bedcb-43be-4fda-9e2f-15beccbd8512': 'Market & Slaughterhouse',
    '405b5f95-cf89-4a0e-9ad2-ce0013e72a14': 'Municipal Library',
    '06fd85c7-1c44-4426-b2b6-6d6b8414c977': 'Municipal Special Action Team (MSAT)',
    '33a365ef-8577-4bb6-bcdd-86874fe40fdf': 'Public Order and Safety Office (POSO)',
    '50777e10-f457-44b2-8dc4-abd7a3418b7b': 'Public Employment Service Office (PESO)',
    'd0f8c5c2-9d5b-4f2c-9fd1-7ba52565d2ae': 'Rural Health Unit III (RHU III)',
    'b9d64d84-1380-475f-a640-42266df44a67': 'Security Service Office',
    '2ae7f14b-0caf-4a36-99b4-b9d7e8730b9e': 'Sangguniang Bayan Legislative',
    'c16d3d3f-56f9-4131-aa92-70b81e9e1ee0': 'Vice Mayor\'s Office',
    'e05c837d-09cd-473d-9cc4-ac78ce0c52d5': 'Local Disaster Risk Reduction and Management Council (LDRRMC)',
    'b42ded0f-a8f6-403f-9d51-111e56aad817': 'Budget Office',
    'cdfeb9d3-8b71-4c3f-a74a-ec65165485b3': 'Municipal Social Welfare and Development Office (MSWDO)',
    '7b82a0aa-28e8-42ed-a1b2-ca8c0176763c': 'Municipal Environment & Natural Resources Office (MENRO)',
    '68b7538d-4087-40d5-89a1-a7251edda262': 'Municipal Treasurer\'s Office',
    'c0d572d5-ee02-45b0-be97-91170f932f6e': 'Municipal Engineering Office',
    '66a9081c-d9dd-409a-82e4-fc9f6d74716e': 'Rural Health Unit I (RHU I)',
    'cdbad613-6246-4c0c-af7d-d56ef05be026': 'Sangguniang Bayan Secretariat',
    '1396e946-0368-48c5-8d2b-d8577d79fa3f': 'General Service Office (GSO)',
    'dc44058c-04cd-40a2-896c-ad4ae8f10028': 'Business Permit and Licensing Office (BPLO)',
    '2e700cc6-bee2-493d-afae-af2a30d1948a': 'Municipal Cemetery',
    'add0489f-80fb-4fa3-93a8-5e6adcc27ffe': 'Mayors Office',
    'f5552370-10f0-4618-b93a-4efd46e6509d': 'Municipal Assessor\'s Office',
    '27c18dad-01cb-49e9-9436-293b7add9ec1': 'Municipal Administrator\'s Office',
    '964fe64b-e589-4a15-9b5f-cb7866631da6': 'Commission on Audit (CoA)',
    '11805d7a-f985-475b-9e0c-636d240e6206': 'Municipal Agriculture\'s Office',
    '4bd9b7a4-3e47-4786-92dd-b4759ccb7355': 'Rural Health Unit II (RHU II)',
    '1e24c72d-7cea-48d7-a79e-b16ad34c78bb': 'Municipal Civil Registrar',
    'a48c1c57-4a64-4028-be60-84d37920a843': 'Municipal Planning and Development Office (MPDO)',
  };


  // Eligibility ID to Name Mapping
  const eligibilityMapping: Record<string, string> = {
    '0563234c-a573-46c0-b978-1bf606322546': 'Nursing Licensure Exam',
    '1c1f5a52-24e6-463d-97a4-d462e5fa8be1': 'Medical Technologist',
    '1e8dc295-1bd9-4497-a6a0-c7747e3faaa5': 'Civil Engineers Licensure Examination',
    '24fecd96-eeef-460a-91c5-a8c944e295e6': 'Board of Midwifery',
    '28a95ea5-bfba-4d14-85e0-55dafc9db7d0': 'NC II; NAPOLCOM',
    '2ac18e3a-bf06-44f9-aad3-2c33b5418e38': 'Fisheries Tech. Examination',
    '3a022388-b4fa-4d9d-840d-3c0f7894cbc2': 'CSC MC #42 s. 1993',
    '5326705b-bff1-4aac-aefc-2e3666cc1f5d': 'RA 1080 (Civil Eng\'g Board Exam.)',
    '56b1dc52-4acd-4e4b-a158-231f846e525c': 'Veterinary Board',
    '5be6021b-db4e-4a7b-a826-ded2b9fcc647': 'CS Sub-Professional',
    '5dddc5d0-d58a-48d3-b4e0-d36f314f9f28': 'TESDA Eligibility',
    '67754e2c-c6f7-4c34-9f88-1fb57b934e83': 'None',
    '69f6685c-aa7e-4b28-a745-1a4011ca0ab1': 'Midwifery Licensure Examination',
    '704fc8ef-425a-445f-9083-b47c37586c94': 'NC II',
    '76ad9350-3e0f-47b4-8aeb-84f4835908c1': 'Registered Midwife',
    '8320261d-fc57-4cfb-b869-58c259b2a9fe': 'Electrical Engineer Licensure Exam',
    '4f63b575-f83b-470c-a6c7-ede959e3c78a': 'Agriculturists Licensure Examination',
    'f622687f-79c6-44e8-87c6-301a257582b2': 'Nursing Licensure Exam',
    'e3d86972-0578-45b6-bdf0-399089720c76': 'CPA Board Passer',
    '8ca8bed6-609c-4dad-8c93-184865b46fe5': 'Licensure Exam for Teachers',
    'bdee84a0-800a-4c90-91d6-e72ad05fe5ce': 'Phil. Veterans Affairs Member',
    'beb2c810-6dfc-40e8-b8c1-488f1db9a7c6': 'License Exam. for Architects; License Exam for Environmental Planner',
    '4b6ff472-85d6-44a0-b225-2d08fe73a08a': 'Criminologist Licensure Examination',
    '516b58cd-87ce-47ac-8f5b-c881ecfaebce': 'Nutritionist-Dietitian Board Examination',
    'd9c89ef9-66a8-4239-a8f3-df5fd4a29b39': 'Veterinarians Licensure Exam',
    '8e0a4be9-014d-4960-88ff-04c54b22d9b5': 'Sub-Professional',
    'dbef755a-bfce-41a0-a1dd-23fc848aa746': 'CS Professional',
    '91fcb7cb-1c7c-43a9-add2-74d50ee48358': 'Licensure Exam. For Social work',
    '93bd2733-6afa-4521-bd0c-efb0204ef40a': 'Registered Dentist',
    '96e6475c-b091-4507-a253-ef970e96e650': 'PD 907 (Honor Grad. Eligibility)',
    '97e5002a-afa1-46d4-8314-26ab6c5ed912': 'Medical Board',
    '9a1f4217-405b-44c3-baf8-90c73c0754a6': 'PD No. 907',
    '9e47b2a9-3a3d-41ea-98b6-bc812d35458e': 'Nursing Board Passer; Fire Officer Examination',
    'a2ec66e2-a6da-4a8a-b728-cb45954749d7': 'RA 1080 (Nursing Board)',
    'a67797d9-51f3-4409-852a-d44aa0e4ad62': 'PRC',
    'a6cc6d54-f066-4c17-b8bc-f695883a5f2f': 'Barangay Official Eligibility',
    'a9008832-0077-4240-a5a6-815f3ffa35ad': 'Nursing Board Passer',
    'aa9bc0c4-b04e-4a38-8369-8fc8b75e486b': 'RA 1080',
    'b378748c-c45f-463f-94fc-258310b627c5': 'PD 207 (Honor Graduate Eligibility)',
    'b8a5e471-6a5d-4e5c-af78-48eac5374499': 'Board of Social Workers',
  };


  // Appointment ID to Name Mapping
  const appointmentMapping: Record<string, string> = {
    '07eb3541-f2c8-4482-843e-0aacc0197992': 'Casual',
    '10f6c11b-a1b4-4664-947b-5474380a7fbb': 'Coterminous',
    '02f35663-5a8e-4dd9-a9f2-492bae41155e': 'Elected',
    'aeaf6a42-2586-46c3-bb2a-0464be2e5ba7': 'Permanent',
    'd5c55388-fd2b-4bc5-817a-c2a987e97be8': 'Job Order',
    'f7e70b61-6753-47f3-a3c8-ec6f1d00f7e0': 'Others',
    '03f95fcf-16f3-442a-9678-27a44aa1a8e7': 'Contract of Service',
  };



  const handleDownload = async (selectedKeys: string[]) => {
    setLoading(true);
    const toastId = toast.loading('Generating Excel file...');

    const hiddenFields = [
      'departmentId',
      'id',
      'isFeatured',
      'isHead',
      'isAwardee',
      'createdAt',
      'updatedAt',
      'employeeLink',
      'prefix',
      'region'
    ];



    try {
      const response = await fetch('/api/backup-employee?' + new Date().getTime(), {
        cache: 'no-store', // explicitly avoid caching
      });
      if (!response.ok) throw new Error('Failed to fetch employee data');

      const data = await response.json();
      if (data.length === 0) throw new Error('No employee data found.');

      // Map officeId to office name
      const updatedData = data.map((row: any) => {


        // Replace Office ID with Name
        if (row.officeId && officeMapping[row.officeId]) {
          row.officeId = officeMapping[row.officeId];
        }
        // Replace Eligibility ID with Name
        if (row.eligibilityId && eligibilityMapping[row.eligibilityId]) {
          row.eligibilityId = eligibilityMapping[row.eligibilityId];
        }
        // Replace Appointment ID with Name
        if (row.employeeTypeId
          && appointmentMapping[row.employeeTypeId]) {
          row.employeeTypeId = appointmentMapping[row.employeeTypeId];
        }

        // Format dates
        if (row.birthday) {
          row.birthday = new Date(row.birthday).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
        }

        if (row.dateHired) {
          row.dateHired = new Date(row.dateHired).toLocaleDateString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
        }

        return row;
      });

      let filteredEmployees = updatedData;

      if (statusFilter === 'active') {
        filteredEmployees = filteredEmployees.filter((emp: any) => emp.isArchived === false);
      } else if (statusFilter === 'retired') {
        filteredEmployees = filteredEmployees.filter((emp: any) => emp.isArchived === true);
      }

      //Filter out hidden columns
      const visibleColumns = columnOrder.filter(
        col => !hiddenFields.includes(col.key) && selectedKeys.includes(col.key)
      );

      //Use display names for headers (important)
      const headers = visibleColumns.map(col => col.name);

      //Map data using display names as keys
      const filteredData = filteredEmployees.map((row: any) => {
        const newRow: Record<string, any> = {};
        visibleColumns.forEach((col) => {
          newRow[col.name] = row[col.key];
        });
        return newRow;
      });


      //Sort the data by 'Office' and 'Last Name'
      const sortedData = filteredData.sort((a: any, b: any) => {
        // First, sort by 'Office' (alphabetically)
        if (a['Office'] < b['Office']) return -1;
        if (a['Office'] > b['Office']) return 1;

        // If 'Office' is the same, sort by 'Last Name' (alphabetically)
        if (a['Last Name'] < b['Last Name']) return -1;
        if (a['Last Name'] > b['Last Name']) return 1;

        return 0;
      });

      // Convert to worksheet
      const worksheet = XLSX.utils.json_to_sheet(sortedData, { header: headers, skipHeader: false });

      // Freeze the top row
      worksheet['!freeze'] = { xSplit: 1, ySplit: 1 };


      headers.forEach((header, colIdx) => {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colIdx });
        worksheet[cellAddress].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
          fill: { fgColor: { rgb: '28a745' } }, // green background
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } },
          },
        };
      });

      filteredData.forEach((row: any, rowIndex: any) => {
        headers.forEach((header, colIndex) => {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
          const cell = worksheet[cellAddress];

          if (cell) {
            cell.s = {
              font: { sz: 11, color: { rgb: '000000' } },
              alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } },
              },
            };
          }
        });
      });

      for (let i = 0; i < filteredData.length; i++) {
        const rowNumber = i + 2; // Excel rows start at 1, plus 1 for header

        const birthdateCell = `N${rowNumber}`;
        const ageCell = `O${rowNumber}`;
        const hiredDateCell = `Q${rowNumber}`;
        const serviceCell = `R${rowNumber}`;
        const terminateDateCell = `AE${rowNumber}`;

        // Formula for Age
        worksheet[ageCell] = {
          t: 'n',
          f: `IF(${birthdateCell}="", "", DATEDIF(${birthdateCell}, IF(${terminateDateCell}="", TODAY(), ${terminateDateCell}), "Y"))`,
          s: {
            font: { sz: 11, color: { rgb: '000000' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } },
            },
          }
        };

        // Formula for Years of Service
        worksheet[serviceCell] = {
          t: 'n',
          f: `IF(${hiredDateCell}="", "", DATEDIF(${hiredDateCell}, IF(${terminateDateCell}="", TODAY(), ${terminateDateCell}), "Y"))`,
          s: {
            font: { sz: 11, color: { rgb: '000000' } },
            alignment: { vertical: 'center', horizontal: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } },
            },
          }
        };
      }
      filteredData.forEach((row: any, rowIndex: number) => {
        const isRetired = row['Retired'] === true || String(row['Retired']).toLowerCase() === 'true';

        headers.forEach((header, colIndex) => {
          const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
          const cell = worksheet[cellAddress];

          if (cell) {
            const baseStyle: any = {
              font: { sz: 11, color: { rgb: '000000' } },
              alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } },
              },
            };

            // If retired, apply red highlighting
            if (isRetired) {
              baseStyle.fill = { fgColor: { rgb: 'FFCCCC' } }; // Light red background
              baseStyle.font = { sz: 11, color: { rgb: '990000' }, bold: true };
            }

            cell.s = baseStyle;
          }
        });
      });


      // Auto-size columns
      const columnWidths = headers.map((header) => {
        let maxLength = header.length;
        filteredData.forEach((row: any) => {
          const cellValue = row[header] ?? '';
          const cellLength = String(cellValue).length;
          if (cellLength > maxLength) {
            maxLength = cellLength;
          }
        });
        return { wch: maxLength + 1 };
      });
      worksheet['!cols'] = columnWidths;

      //Create workbook and write file
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');



      // Write to file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });



      // Trigger download
      const link = document.createElement('a');

      // Create a new Date object for the current date and time
      const now = new Date();

      // Manually format the date and time into a valid string for the filename
      const formattedDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const formattedTime = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;

      // Construct the filename with the current date and time
      const filename = `employee_list_${formattedDate}_${formattedTime}.xlsx`;

      link.href = window.URL.createObjectURL(blob);
      link.download = filename; // Set the dynamically generated filename
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(link.href);




      toast.success('Excel file generated successfully!', { id: toastId });
    } catch (error) {
      toast.error(`Error: ${error}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-end">
      <button
        onClick={() => setModalOpen(true)}   >
        <div>
          <div
            className={`px-4 py-2 text-sm sm:text-base rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${loading
              ? 'bg-gray-500 cursor-not-allowed'
              : 'bg-green-700 hover:bg-green-800 focus:ring-green-600'
              } text-white flex items-center justify-center space-x-2`}
          >
            {loading ? (
              'Generating...'
            ) : (
              <>
                <FaFileExcel className="text-base sm:text-lg" />
                <span className="hidden sm:inline">Download</span>
              </>
            )}
          </div>
        </div>

      </button>

      {/* MODAL for column selection */}
      <Modal
        title="Select Columns to Export"
        description="Choose which fields to include in the Excel file."
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <div className="mb-2 flex justify-between items-center text-sm">
          <label className="font-medium">Select Columns</label>
          <button
            onClick={toggleSelectAll}
            className="text-blue-600 hover:underline text-xs"
          >
            {isAllSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto border p-2 rounded bg-white shadow">
          {columnOrder.map((col) => (
            <label key={col.key} className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={selectedColumns.includes(col.key)}
                onChange={() => toggleColumn(col.key)}
              />
              <span>{col.name}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <label className="font-medium text-sm">Include Status:</label>
          <div className="flex space-x-4 text-sm">
            <label className="flex items-center space-x-1">
              <input
                type="radio"
                name="status"
                value="all"
                checked={statusFilter === 'all'}
                onChange={() => setStatusFilter('all')}
              />
              <span>All</span>
            </label>
            <label className="flex items-center space-x-1">
              <input
                type="radio"
                name="status"
                value="active"
                checked={statusFilter === 'active'}
                onChange={() => setStatusFilter('active')}
              />
              <span>Active</span>
            </label>
            <label className="flex items-center space-x-1">
              <input
                type="radio"
                name="status"
                value="retired"
                checked={statusFilter === 'retired'}
                onChange={() => setStatusFilter('retired')}
              />
              <span>Retired</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end mt-4 space-x-2">
          <button
            onClick={() => setModalOpen(false)}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setModalOpen(false);
              handleDownload(selectedColumns);
            }}
            className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded text-sm"
          >
            Download
          </button>
        </div>
      </Modal>

    </div>
  );
}
