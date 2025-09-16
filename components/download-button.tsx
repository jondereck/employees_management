'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx-js-style';
import { FaFileExcel } from 'react-icons/fa';
import Modal from './ui/modal';
import { officeMapping, eligibilityMapping, appointmentMapping } from "@/utils/employee-mappings";
import { generateExcelFile, Mappings, PositionReplaceRule } from '@/utils/download-excel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import clsx from 'clsx';
import Chip from '@/app/(dashboard)/[departmentId]/(routes)/employees/components/chip';
import { CheckboxListPicker } from './checkbox-list-picker';
import { ActionTooltip } from './ui/action-tooltip';




export default function DownloadStyledExcel() {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mappings, setMappings] = useState<Mappings | null>(null);

  const [allPositions, setAllPositions] = useState<string[]>([]);
  const [posSearch, setPosSearch] = useState('');
  const [posSelected, setPosSelected] = useState<string[]>([]);

  const [posRuleMode, setPosRuleMode] = useState<'exact' | 'startsWith' | 'contains' | 'regex'>('startsWith');
  const [posRuleCaseSensitive, setPosRuleCaseSensitive] = useState(false);
  const [posRuleReplaceWith, setPosRuleReplaceWith] = useState('');

  const [globalTargets, setGlobalTargets] = useState<string[]>([]);

  // near other useStates
const [idColumnSource, setIdColumnSource] = useState<'uuid' | 'bio' | 'employeeNo'>(() => {
  if (typeof window !== 'undefined') {
    const s = localStorage.getItem('idColumnSource');
    if (s === 'uuid' || s === 'bio' || s === 'employeeNo') return s;
  }
  return 'employeeNo'; // default
});



  
const plural = (n: number, word: string) => `${word}${n === 1 ? "" : "s"}`;
const preview = (items: string[], max = 2) =>
  items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")} +${items.length - max} more`;



const applyGlobalToRow = (i: number) => {
  // read latest checked positions from the global picker
  const latest = globalTargets;

  if (!latest || latest.length === 0) {
    toast.info("No positions selected", {
      description: "Use the picker above to select positions first.",
    });
    return;
  }

  const before = new Set(bulkRows[i].targets.map(t => t.toLowerCase()));
  const merged = [...bulkRows[i].targets]; // preserve original casing/order for existing
  let addedCount = 0;

  for (const pos of latest) {
    const key = pos.toLowerCase();
    if (!before.has(key)) {
      merged.push(pos);
      before.add(key);
      addedCount++;
    }
  }

  updateBulkRow(i, { targets: merged });

  if (addedCount === 0) {
    toast.message("No new positions to add", {
      description: preview(latest),
    });
  } else {
    toast.success(`Added ${addedCount} ${plural(addedCount, "position")} to row ${i + 1}`, {
      description: preview(latest),
    });
  }
};

  type BulkRow = {
    mode: 'exact' | 'startsWith' | 'contains' | 'regex';
    targets: string[];
    replaceWith: string;
    caseSensitive: boolean;
  };

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    { mode: 'startsWith', targets: [], replaceWith: '', caseSensitive: false }

  ]);
  const addBulkRow = () =>
    setBulkRows((r) => [
      ...r,
      { mode: 'startsWith', targets: [], replaceWith: '', caseSensitive: false },
    ]);

  const removeBulkRow = (i: number) =>
    setBulkRows((r) => r.filter((_, idx) => idx !== i));

  const updateBulkRow = (i: number, patch: Partial<BulkRow>) =>
    setBulkRows((r) =>
      r.map((row, idx) => (idx === i ? { ...row, ...patch } : row))
    );

  // Add each selected position as its own row
  const addSelectedToBulk = () => {
    if (posSelected.length === 0) return;
    setBulkRows((rows) => [
      ...rows,
      ...posSelected.map<BulkRow>((p) => ({
        mode: 'startsWith',
        targets: [p], // each row gets a single target in its array
        replaceWith: '',
        caseSensitive: false,
      })),
    ]);
  };

  const applyBulkRowsAsRules = () => {
    const newRules = bulkRows
      .filter((r) => r.targets.length > 0 && r.replaceWith.trim())
      .map<PositionReplaceRule>((r) => ({
        mode: r.mode,
        targets: r.targets,
        replaceWith: r.replaceWith,
        caseSensitive: r.caseSensitive,
      }));

    if (newRules.length === 0) return;
    setPositionReplaceRules((prev) => [...prev, ...newRules]);

    setBulkRows([
      { mode: 'startsWith', targets: [], replaceWith: '', caseSensitive: false },
    ]);
  };


  const [advancedTab, setAdvancedTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hrps_advanced_tab") || "paths";
    }
    return "paths";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hrps_advanced_tab", advancedTab);
    }
  }, [advancedTab]);


  // full rule list (persisted)
  const [positionReplaceRules, setPositionReplaceRules] = useState<PositionReplaceRule[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('positionReplaceRules');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch { }
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('positionReplaceRules', JSON.stringify(positionReplaceRules));
    }
  }, [positionReplaceRules]);

  // Load unique positions when modal opens
  useEffect(() => {
    if (!modalOpen) return;
    (async () => {
      try {
        const res = await fetch('/api/backup-employee?' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;

        // Type the response shape we actually use
        const json = (await res.json()) as {
         employees?: Array<{ position?: string | null; isArchived?: boolean | null }>;
        };

        const positions: string[] = (json.employees ?? [])
        .filter(e => !e?.isArchived)                 // <-- exclude archived here
        .map(e => (e.position ?? '').trim())
        .filter(p => p.length > 0);

      // Deduplicate (case-insensitive), but keep original casing of first seen
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const p of positions) {
        const key = p.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(p);
        }
      }

      // Sort nicely
      unique.sort((a, b) => a.localeCompare(b));

      setAllPositions(unique);
    } catch (e) {
      console.error('Failed to load positions', e);
    }
  })();
}, [modalOpen]);


  // filtered positions by search
  const filteredPositions = useMemo(() => {
    const q = posSearch.trim().toLowerCase();
    if (!q) return allPositions;
    return allPositions.filter(p => p.toLowerCase().includes(q));
  }, [posSearch, allPositions]);

  const toggleSelectPosition = (p: string) => {
    setPosSelected(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };
  const selectAllFiltered = () => {
    const setFiltered = new Set(filteredPositions);
    setPosSelected(prev => {
      const union = new Set(prev);
      filteredPositions.forEach(p => union.add(p));
      return Array.from(union);
    });
  };
  const deselectAll = () => setPosSelected([]);

  // Add rule
  const addPositionRule = () => {
    const targets = posRuleMode === 'regex'
      ? (posSelected.length ? posSelected : (posSearch ? [posSearch] : []))
      : posSelected; // for regex, allow typing pattern via search box

    if (!targets.length || !posRuleReplaceWith.trim()) {
      toast.error('Select positions (or provide a regex) and enter a replacement.');
      return;
    }
    setPositionReplaceRules(prev => [
      ...prev,
      {
        mode: posRuleMode,
        targets,
        replaceWith: posRuleReplaceWith,
        caseSensitive: posRuleCaseSensitive,
      }
    ]);
    // reset selector
    setPosSelected([]);
    setPosRuleReplaceWith('');
  };

  const removePositionRule = (idx: number) => {
    setPositionReplaceRules(prev => prev.filter((_, i) => i !== idx));
  };

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

  useEffect(() => {
    const load = async () => {
      try {
        const cached = localStorage.getItem('hrps_mappings');
        if (cached) {
          const parsed = JSON.parse(cached);
          setMappings(parsed);
        }
        const res = await fetch('/api/mappings?' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const fresh = await res.json();
          setMappings(fresh);
          localStorage.setItem('hrps_mappings', JSON.stringify(fresh));
        }
      } catch (e) {
        console.error('Failed loading mappings', e);
      }
    };
    load();
  }, [modalOpen]);

  const APPOINTMENT_OPTIONS = useMemo(() => {
    if (!mappings) return [];
    return Array.from(new Set(Object.values(mappings.appointmentMapping))).sort();
  }, [mappings]);

  // Appointment filters state (default = all)
  const [appointmentFilters, setAppointmentFilters] = useState<string[]>([]);
  useEffect(() => {
    // initialize after mappings are ready
    if (!mappings) return;
    const saved = localStorage.getItem('appointmentFilters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAppointmentFilters(parsed);
          return;
        }
      } catch { }
    }
    setAppointmentFilters(APPOINTMENT_OPTIONS); // default: all
  }, [mappings, APPOINTMENT_OPTIONS.length]);

  useEffect(() => {
    localStorage.setItem('appointmentFilters', JSON.stringify(appointmentFilters));
  }, [appointmentFilters]);

  const isAllAppointments = APPOINTMENT_OPTIONS.length > 0 &&
    appointmentFilters.length === APPOINTMENT_OPTIONS.length;
  const toggleAppointment = (label: string) =>
    setAppointmentFilters(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  const toggleAllAppointments = () =>
    setAppointmentFilters(isAllAppointments ? [] : [...APPOINTMENT_OPTIONS]);

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

  const effectiveColumnOrder = useMemo(() => {
  const label =
    idColumnSource === 'uuid' ? 'Employee UUID' :
    idColumnSource === 'bio' ? 'Employee Code' :
    'Employee No';

  return columnOrder.map(col =>
    col.key === 'employeeNo' ? { ...col, name: label } : col
  );
}, [columnOrder, idColumnSource]);


useEffect(() => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('idColumnSource', idColumnSource);
  }
}, [idColumnSource]);


  const handleDownload = async (selectedKeys: string[]) => {
    if (!mappings) {
      toast.error('Mappings not loaded yet. Please try again.');
      return;
    }
    setLoading(true);
    const toastId = toast.loading('Generating Excel file...');
    try {
      const blob = await generateExcelFile({
        selectedKeys,
         columnOrder: effectiveColumnOrder,
        statusFilter,
        baseImageDir: imageBaseDir,
        baseQrDir: qrBaseDir,
        qrPrefix,
        appointmentFilters: isAllAppointments ? 'all' : appointmentFilters,
        mappings,
        positionReplaceRules,
        idColumnSource,
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
        {/* ADVANCED (single collapsible with both subsections) */}
        <div className="max-h-[75vh] overflow-y-auto pr-1">
          {/* ADVANCED (single box; sticky header + conditional mount for content) */}
          <div className="mb-4 rounded-lg border bg-white shadow-sm">
            {/* Sticky header so the toggle stays visible */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-3 py-2 border-b">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-between"
                aria-expanded={showAdvanced}
              >
                <span className="text-sm font-semibold">Advanced settings</span>

                <span className="text-xs text-gray-600 px-3 py-2 flex justify-end">{showAdvanced ? '' : 'Show'}</span>
              </button>
            </div>

            <div
              className={`overflow-hidden transition-all duration-500 ease-in-out ${showAdvanced ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
              <div className="px-3 pb-3 space-y-4">
                <div className="px-3 pb-3">
                  <Tabs value={advancedTab} onValueChange={setAdvancedTab} className="w-full">
                    <TabsList className="grid grid-cols-5 w-full gap-2">
                      <TabsTrigger value="filters">Filter</TabsTrigger>
                      <TabsTrigger value="columns_path">Columns</TabsTrigger>
                      <TabsTrigger value="paths">Paths</TabsTrigger>
                      <TabsTrigger value="position">Find &amp; Replace</TabsTrigger>
                        <TabsTrigger value="id">ID Column</TabsTrigger> {/* NEW */}

                    </TabsList>

                    {/* TAB: Paths */}
                    <TabsContent value="paths" className="mt-3">
                      <div className="rounded-md border bg-white p-3 space-y-3">
                        <h4 className="text-sm font-semibold">Paths</h4>
                        <div className="grid gap-3 sm:grid-cols-2">
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

                          {/* QR prefix + Reset */}
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
                    </TabsContent>

                    {/* TAB: Position Find & Replace */}
                    <TabsContent value="position" className="mt-3">
                      <div className="rounded-md border bg-white p-3">
                        <div className=" space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-semibold">Position</h5>
                            <div className="space-x-3">

                              <button
                                type="button"
                                onClick={addBulkRow}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Add row
                              </button>
                            </div>
                          </div>

                          <div className="border rounded">
                            {/* === Global Target Picker at the top === */}
                            <div className="p-2 border-b bg-white">
                              <CheckboxListPicker
                                value={globalTargets}
                                onChange={setGlobalTargets}
                                options={allPositions}
                                placeholder="Search positions…"
                                maxHeight={220}
                              />
                            </div>

                            {/* === Table header === */}
                            <div className="grid grid-cols-[7rem,1fr,4rem] gap-2 px-2 py-1 text-[11px] text-gray-600 bg-gray-50">
                              <div>Mode</div>
                              <div>Replace with</div>
                              <div>Case</div>
                            </div>

                            {/* === Table body === */}
                            <div className="max-h-[50vh] overflow-y-auto divide-y">
                              {bulkRows.map((row, i) => (
                                <div
                                  key={i}
                                  className="grid grid-cols-[7rem,1fr,4rem] gap-2 items-start px-2 py-2"
                                >
                                  {/* Mode */}
                                  <div>
                                    <select
                                      value={row.mode}
                                      onChange={(e) =>
                                        updateBulkRow(i, { mode: e.target.value as BulkRow["mode"] })
                                      }
                                      className="border rounded px-2 py-1 text-xs w-full"
                                    >
                                      <option value="startsWith">Starts with</option>
                                      <option value="exact">Equals</option>
                                      <option value="contains">Contains</option>
                                      <option value="regex">Regex</option>
                                    </select>
                                  </div>

                                  {/* Replace with */}
                                  <div>
                                    <input
                                      type="text"
                                      value={row.replaceWith}
                                      onChange={(e) =>
                                        updateBulkRow(i, { replaceWith: e.target.value })
                                      }
                                      className="border rounded px-2 py-1 text-xs w-full"
                                      placeholder="Replace with… (e.g. Security Guard)"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => applyGlobalToRow(i)}
                                      className="mt-1 text-[11px] text-blue-600 hover:underline"
                                    >
                                      Use position(s) as targets 
                                    </button>

                                  </div>

                                  {/* Case + Remove */}
                                  <div className="flex flex-col items-start gap-2">

                                    <label className="flex items-center gap-1 text-xs">
                                      <input
                                        type="checkbox"
                                        checked={row.caseSensitive}
                                        onChange={(e) =>
                                          updateBulkRow(i, { caseSensitive: e.target.checked })
                                        }
                                      />

                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => removeBulkRow(i)}
                                      className="text-[11px] text-red-600 hover:underline"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                         
                            <div className="space-y-2">
                              {/* Current rules */}
                              <div className="flex-1 overflow-y-auto border rounded p-2">

                                <ul className="space-y-2">
                                  {positionReplaceRules.map((r, idx) => (
                                    <li
                                      key={idx}
                                      className="border rounded p-2 text-xs flex items-start justify-between"
                                    >
                                      <div className="pr-2 space-y-1">
                                        <div>
                                          <span className="font-semibold">Mode:</span> {r.mode}
                                          {r.caseSensitive ? " (case)" : ""}
                                        </div>

                                        {/* Targets preview (1 line only + tooltip) */}
                                        <div className="flex items-center gap-1">
                                          <span className="font-semibold">Targets:</span>
                                          <ActionTooltip
                                            label={r.targets.join(", ") || "(regex via search)"}
                                            side="top"
                                            align="start"
                                          >
                                            <span
                                              className="truncate max-w-[250px] block cursor-help text-gray-700"
                                              title={r.targets.join(", ")}
                                            >
                                              {r.targets.length > 0 ? r.targets[0] : "(regex via search)"}
                                              {r.targets.length > 1 && `, +${r.targets.length - 1} more`}
                                            </span>
                                          </ActionTooltip>
                                        </div>

                                        <div>
                                          <span className="font-semibold">Replace with:</span>{" "}
                                          {r.replaceWith}
                                        </div>
                                      </div>

                                      <button
                                        onClick={() => removePositionRule(idx)}
                                        className="text-red-600 hover:underline ml-2"
                                      >
                                        Remove
                                      </button>
                                    </li>
                                  ))}
                                </ul>


                              </div>
                            </div>
                        

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={applyBulkRowsAsRules}
                              className="bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 rounded text-sm"
                            >
                              Add as rule
                            </button>
                          </div>
                        </div>

                      </div>
                    </TabsContent>
                    {/* TAB: Columns */}
                    <TabsContent value="columns_path" className="mt-3">
                      <div className="rounded-md border bg-white p-3">
                        <div className="mb-2 flex justify-between items-center text-sm">
                          <label className="font-medium">Select Columns</label>
                          <button
                            onClick={toggleSelectAll}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            {isAllSelected ? "Deselect All" : "Select All"}
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
                      </div>
                    </TabsContent>
                    <TabsContent value="filters" className="mt-3">
                      <div className="rounded-md border bg-white p-3 space-y-4">
                        {/* Appointment filter */}
                        <div>
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

                      </div>
                    </TabsContent>

<TabsContent value="id" className="mt-3">
  <div className="rounded-md border bg-white p-3 space-y-3">
    <h4 className="text-sm font-semibold">Which ID should appear in the exported “Employee No” column?</h4>

    <div className="space-y-2 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="idColumnSource"
          value="bio"
          checked={idColumnSource === 'bio'}
          onChange={() => setIdColumnSource('bio')}
        />
        <span>Bio Number (e.g., 3620016)</span>
      </label>

 <label className="flex items-center gap-2">
  <input
    type="radio"
    name="idColumnSource"
    value="employeeNo"
    checked={idColumnSource === 'employeeNo'}
    onChange={() => setIdColumnSource('employeeNo')}
  />
  <span>Employee No / Code (e.g., X-1)</span>
</label>

      <label className="flex items-center gap-2">
        <input
          type="radio"
          name="idColumnSource"
          value="uuid"
          checked={idColumnSource === 'uuid'}
          onChange={() => setIdColumnSource('uuid')}
        />
        <span>Employee UUID (database <code>id</code>)</span>
      </label>
    </div>

    <p className="text-xs text-gray-600">
      This choice only affects the value placed in the “Employee No” column of the Excel download.
      Other paths (e.g., QR/Image path) remain unchanged.
    </p>
  </div>
</TabsContent>


                  </Tabs>
                </div>
                {/* Hide button at bottom */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(false)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Hide advanced settings
                  </button>
                </div>
              </div>
            </div>
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
