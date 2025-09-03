'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';
import { FaFileExcel } from 'react-icons/fa';
import Modal from './ui/modal';
import { officeMapping, eligibilityMapping, appointmentMapping } from "@/utils/employee-mappings";
import { generateExcelFile } from '@/utils/download-excel';


export default function DownloadStyledExcel() {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // at the top of DownloadStyledExcel component
const [showAdvanced, setShowAdvanced] = useState<boolean>(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('showAdvancedPaths') === 'true';
  }
  return false; // hidden by default
});

useEffect(() => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('showAdvancedPaths', String(showAdvanced));
  }
}, [showAdvanced]);


  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'retired'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('statusFilter');
      if (stored === 'active' || stored === 'retired') return stored;
    }
    return 'all';
  });
  const APPOINTMENT_OPTIONS = useMemo(
    () => Array.from(new Set(Object.values(appointmentMapping))).sort(),
    []
  );

  // state: default to ALL options
  const [appointmentFilters, setAppointmentFilters] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('appointmentFilters');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch { }
      }
    }
    return APPOINTMENT_OPTIONS;  // all by default
  });

  useEffect(() => {
    localStorage.setItem('appointmentFilters', JSON.stringify(appointmentFilters));
  }, [appointmentFilters]);

const toggleAppointment = (label: string) => {
  setAppointmentFilters((prev) =>
    prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
  );
};

const isAllAppointments = appointmentFilters.length === APPOINTMENT_OPTIONS.length;

const toggleAllAppointments = () => {
  setAppointmentFilters(isAllAppointments ? [] : [...APPOINTMENT_OPTIONS]);
};


  // NEW state
  const [imageBaseDir, setImageBaseDir] = useState<string>(() =>
    (typeof window !== 'undefined' && localStorage.getItem('imageBaseDir')) ||
    'C:\\Users\\User\\Desktop\\HRMO Files\\Nifas\\.shared work\\img\\employees'
  );

  const [qrBaseDir, setQrBaseDir] = useState<string>(() =>
    (typeof window !== 'undefined' && localStorage.getItem('qrBaseDir')) ||
    'C:\\Users\\User\\Desktop\\HRMO Files\\Nifas\\.shared work\\img\\qr'
  );

  const [qrPrefix, setQrPrefix] = useState<string>(() =>
    (typeof window !== 'undefined' && localStorage.getItem('qrPrefix')) || 'JDN'
  );

  // persist
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('imageBaseDir', imageBaseDir); }, [imageBaseDir]);
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('qrBaseDir', qrBaseDir); }, [qrBaseDir]);
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('qrPrefix', qrPrefix); }, [qrPrefix]);


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
    { name: 'isHead', key: 'isHead' },
    { name: 'Image Path', key: 'imagePath' },
    { name: 'QR Path', key: 'qrPath' },


  ];

  const defaultSelectedColumns = [
    'lastName',
    'firstName',
    'middleName',
    'officeId',
    'position',
    'employeeTypeId',
    'imagePath',
    'qrPath',
  ];

  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('selectedColumns');
      return stored ? JSON.parse(stored) : defaultSelectedColumns;
    }
    return defaultSelectedColumns;
  });

  const isAllSelected = selectedColumns.length === columnOrder.length;


  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedColumns = localStorage.getItem('selectedColumns');
      const storedStatus = localStorage.getItem('statusFilter');

      if (storedColumns) {
        try {
          const parsed = JSON.parse(storedColumns);
          if (Array.isArray(parsed)) setSelectedColumns(parsed);
        } catch (err) {
          console.error('Invalid stored selectedColumns:', err);
        }
      }

      if (storedStatus === 'active' || storedStatus === 'retired') {
        setStatusFilter(storedStatus);
      }
    }
  }, []); // Load from localStorage once on mount

  // Save selectedColumns when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedColumns', JSON.stringify(selectedColumns));
    }
  }, [selectedColumns]);

  // Save statusFilter when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('statusFilter', statusFilter);
    }
  }, [statusFilter]);


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


  const selectedColumnsRef = useRef<string[]>(selectedColumns);

  useEffect(() => {
    selectedColumnsRef.current = selectedColumns;
  }, [selectedColumns]);

  const handleDownload = async (selectedKeys: string[]) => {
    setLoading(true);
    const toastId = toast.loading('Generating Excel file...');

    try {
      const blob = await generateExcelFile({
        selectedKeys,
        columnOrder,
        statusFilter,
        baseImageDir: imageBaseDir,  // NEW
        baseQrDir: qrBaseDir,        // NEW
        qrPrefix,
       appointmentFilters:
    appointmentFilters.length === APPOINTMENT_OPTIONS.length ? 'all' : appointmentFilters,
      });

      const now = new Date();
      const filename = `employee_list_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}.xlsx`;

      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(link.href);

      toast.success('Excel file generated successfully!', { id: toastId });
    } catch (error: any) {
      toast.error(`Error: ${error.message}`, { id: toastId });
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
        {/* SETTINGS (collapsible) */}
<div className="mb-4 rounded-lg border bg-white shadow-sm">
  <button
    type="button"
    onClick={() => setShowAdvanced((v) => !v)}
    className="w-full flex items-center justify-between px-3 py-2"
    aria-expanded={showAdvanced}
    aria-controls="advanced-settings"
  >
    <span className="text-sm font-semibold">Advanced settings</span>
    <span className="text-xs text-gray-600">
      {showAdvanced ? 'Hide' : 'Show'}
    </span>
  </button>

  {/* Collapsible content */}
  <div
    id="advanced-settings"
    className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
      showAdvanced ? 'max-h-[1000px]' : 'max-h-0'
    }`}
  >
    <div className="px-3 pb-3 grid gap-3 sm:grid-cols-2">
      {/* Image base folder */}
      <div className="flex flex-col">
        <label className="text-xs text-gray-600 mb-1">Image base folder</label>
        <input
          type="text"
          value={imageBaseDir}
          onChange={(e) => setImageBaseDir(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
          placeholder="C:\Users\User\...\img\employees"
        />
        <p className="mt-1 text-[11px] text-gray-500">
          Example: <code>{`${imageBaseDir}\\<employeeNo>.png`}</code>
        </p>
      </div>

      {/* QR base folder */}
      <div className="flex flex-col">
        <label className="text-xs text-gray-600 mb-1">QR base folder</label>
        <input
          type="text"
          value={qrBaseDir}
          onChange={(e) => setQrBaseDir(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
          placeholder="C:\Users\User\...\img\qr"
        />
        <p className="mt-1 text-[11px] text-gray-500">
          Example: <code>{`${qrBaseDir}\\${qrPrefix}<employeeNo>.png`}</code>
        </p>
      </div>

      {/* QR prefix (optional) */}
      <div className="sm:col-span-2 flex items-center gap-2">
        <label className="text-xs text-gray-600">QR prefix</label>
        <input
          type="text"
          value={qrPrefix}
          onChange={(e) => setQrPrefix(e.target.value)}
          className="border rounded px-2 py-1 text-sm w-28"
          placeholder="JDN"
        />
        <span className="text-[11px] text-gray-500">
          Result: <code>{`${qrPrefix}<employeeNo>.png`}</code>
        </span>
        <button
          type="button"
          onClick={() => {
            setImageBaseDir('C:\\Users\\User\\Desktop\\HRMO Files\\Nifas\\.shared work\\img\\employees');
            setQrBaseDir('C:\\Users\\User\\Desktop\\HRMO Files\\Nifas\\.shared work\\img\\qr');
            setQrPrefix('JDN');
          }}
          className="ml-auto text-xs text-blue-600 hover:underline"
        >
          Reset defaults
        </button>
      </div>
    </div>
  </div>
</div>

        

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

        {/* FILTER: Appointment Types */}
<div className="mt-4">
  <div className="mb-2 flex justify-between items-center text-sm">
    <label className="font-medium">Filter by Appointment</label>
    <button
      onClick={toggleAllAppointments}
      className="text-blue-600 hover:underline text-xs"
    >
      {isAllAppointments ? 'Deselect All' : 'Select All'}
    </button>
  </div>

  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto border p-2 rounded bg-white shadow">
    {APPOINTMENT_OPTIONS.map((label) => (
      <label key={label} className="flex items-center space-x-2 text-sm">
        <input
          type="checkbox"
          checked={appointmentFilters.includes(label)}
          onChange={() => toggleAppointment(label)}
        />
        <span>{label}</span>
      </label>
    ))}
  </div>
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
              handleDownload(selectedColumnsRef.current);
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
