'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { FaFileExcel } from 'react-icons/fa';
import { FileDown, FileUp, Save, Trash2 } from "lucide-react";
import Modal from './ui/modal';
import { generateExcelFile, getActiveExportTab, Mappings, PositionReplaceRule, setActiveExportTab } from '@/utils/download-excel';
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useParams } from 'next/navigation';
import type { ExportTemplateV2, SortLevel } from '@/types/export';
import { coerceDir, isSortLevel, isStringArray } from '@/lib/guards';
import { SORT_FIELDS } from '@/utils/sort-fields';

import { CheckboxListPicker } from './checkbox-list-picker';
import { ActionTooltip } from './ui/action-tooltip';
import { clearAllUserTemplates, clearLastUsedTemplate, deleteUserTemplate, ExportTemplate, getAllTemplates, saveTemplateToLocalStorage, exportTemplatesToBlob, importTemplatesFromObject, isBuiltInTemplateId, overwriteUserTemplateById } from '@/utils/export-templates';
import TemplatePickerBar from './ui/export-template-picker';
import { EXPORT_TABS, ExportTabKey } from "./tabs.registry";

type OfficeOption = { id: string; name: string; bioIndexCode?: string | null };

type ModalSize = 'cozy' | 'roomy' | 'xl';

const MODAL_WIDTH_CLASSES: Record<ModalSize, string> = {
  cozy: 'w-[min(900px,calc(100vw-48px))]',
  roomy: 'w-[min(1100px,calc(100vw-48px))] 2xl:w-[min(1200px,calc(100vw-64px))]',
  xl: 'w-[min(1200px,calc(100vw-64px))]',
};

const TAB_KEY_TO_VALUE: Record<ExportTabKey, string> = {
  filter: 'filters',
  columns: 'columns_path',
  sort: 'sort',
  paths: 'paths',
  findreplace: 'position',
  id: 'id',
};

const TAB_VALUE_TO_KEY = Object.entries(TAB_KEY_TO_VALUE).reduce<Record<string, ExportTabKey>>(
  (acc, [key, value]) => {
    acc[value] = key as ExportTabKey;
    return acc;
  },
  {}
);

export default function DownloadStyledExcel() {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mappings, setMappings] = useState<Mappings | null>(null);

  const params = useParams<{ departmentId?: string }>();
  const departmentId = useMemo(() => {
    const raw = params?.departmentId;
    if (!raw) return undefined;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  function readStoredSortLevels(): SortLevel[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('export.sortLevels');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item: any) => item && typeof item.field === 'string')
        .slice(0, 3)
        .map((item: any) => ({
          field: String(item.field),
          dir: item.dir === 'asc' ? 'asc' : 'desc',
        }));
    } catch (error) {
      console.warn('Failed to parse export.sortLevels', error);
      return [];
    }
  }

  const [officeOptions, setOfficeOptions] = useState<OfficeOption[]>([]);
  const [officeSearch, setOfficeSearch] = useState('');
  const [selectedOffices, setSelectedOffices] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('export.officesSelection');
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        return parsed.map((id) => String(id));
      }
    } catch (error) {
      console.warn('Failed to parse export.officesSelection', error);
    }
    return [];
  });

  const officeMetadata = useMemo(() => {
    return officeOptions.reduce<Record<string, { name: string; bioIndexCode?: string | null }>>((acc, office) => {
      acc[office.id] = { name: office.name, bioIndexCode: office.bioIndexCode ?? undefined };
      return acc;
    }, {});
  }, [officeOptions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('export.officesSelection', JSON.stringify(selectedOffices));
    } catch (error) {
      console.warn('Failed to persist export.officesSelection', error);
    }
  }, [selectedOffices]);

  const [sheetMode, setSheetMode] = useState<'perOffice' | 'merged'>(() => {
    if (typeof window === 'undefined') return 'perOffice';
    const stored = localStorage.getItem('export.sheetMode');
    return stored === 'merged' ? 'merged' : 'perOffice';
  });

  const [modalSize, setModalSize] = useState<ModalSize>(() => {
    if (typeof window === 'undefined') return 'roomy';
    const stored = localStorage.getItem('export.modalSize');
    return stored === 'cozy' || stored === 'xl' ? stored : 'roomy';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('export.modalSize', modalSize);
    } catch (error) {
      console.warn('Failed to persist export.modalSize', error);
    }
  }, [modalSize]);

  const toggleModalSize = () => {
    setModalSize((prev) => {
      if (prev === 'cozy') return 'roomy';
      if (prev === 'roomy') return 'xl';
      return 'cozy';
    });
  };

  const modalSizeLabel = modalSize === 'xl' ? 'Shrink' : 'Expand';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('export.sheetMode', sheetMode);
    } catch (error) {
      console.warn('Failed to persist export.sheetMode', error);
    }
  }, [sheetMode]);

  useEffect(() => {
    if (!modalOpen || !departmentId) return;
    let cancelled = false;
    const loadOffices = async () => {
      try {
        const res = await fetch(`/api/offices?departmentId=${departmentId}`);
        if (!res.ok) return;
        const data: OfficeOption[] = await res.json();
        if (!cancelled) {
          setOfficeOptions(data);
        }
      } catch (error) {
        console.error('Failed to load offices for export modal', error);
      }
    };
    loadOffices();
    return () => {
      cancelled = true;
    };
  }, [modalOpen, departmentId]);

  useEffect(() => {
    if (!officeOptions.length) return;
    setSelectedOffices((prev) => {
      const allowed = new Set(officeOptions.map((office) => office.id));
      const filtered = prev.filter((id) => allowed.has(id));
      if (filtered.length === prev.length) return prev;
      return filtered;
    });
  }, [officeOptions]);

  const [allPositions, setAllPositions] = useState<string[]>([]);
  const [posSearch, setPosSearch] = useState('');
  const [posSelected, setPosSelected] = useState<string[]>([]);

  const [posRuleMode, setPosRuleMode] = useState<'exact' | 'startsWith' | 'contains' | 'regex'>('startsWith');
  const [posRuleCaseSensitive, setPosRuleCaseSensitive] = useState(false);
  const [posRuleReplaceWith, setPosRuleReplaceWith] = useState('');

  const [globalTargets, setGlobalTargets] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);

  const [templates, setTemplates] = useState(getAllTemplates());
  const [sortBy, setSortBy] = useState<string>(() => {
    const stored = readStoredSortLevels();
    if (stored[0]?.field) return stored[0].field;
    if (typeof window !== 'undefined') {
      const legacy = localStorage.getItem('hrps_sort_by');
      if (legacy) return legacy;
    }
    return 'updatedAt';
  });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => {
    const stored = readStoredSortLevels();
    if (stored[0]?.dir === 'asc' || stored[0]?.dir === 'desc') return stored[0].dir;
    if (typeof window !== 'undefined') {
      const legacy = localStorage.getItem('hrps_sort_dir');
      if (legacy === 'asc' || legacy === 'desc') return legacy;
    }
    return 'desc';
  });
  const [additionalSortLevels, setAdditionalSortLevels] = useState<SortLevel[]>(() => {
    const stored = readStoredSortLevels();
    return stored.slice(1);
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sortBy === 'updatedAt' || sortBy === 'createdAt') {
      localStorage.setItem('hrps_sort_by', sortBy);
    }
  }, [sortBy]);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('hrps_sort_dir', sortDir);
  }, [sortDir]);

  const combinedSortLevels = useMemo(() => {
    const levels: SortLevel[] = [];
    if (sortBy) {
      levels.push({ field: sortBy, dir: sortDir });
    }
    additionalSortLevels.forEach((level) => {
      if (level?.field) {
        levels.push({ field: level.field, dir: level.dir });
      }
    });
    return levels.slice(0, 3);
  }, [sortBy, sortDir, additionalSortLevels]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('export.sortLevels', JSON.stringify(combinedSortLevels));
    } catch (error) {
      console.warn('Failed to persist export.sortLevels', error);
    }
  }, [combinedSortLevels]);


  function refreshTemplates() {
    // If you merge built-ins + user templates inside getAllTemplates, just call it again:
    setTemplates(getAllTemplates());
  }


  const normalizeTemplate = (tpl: ExportTemplate): ExportTemplateV2 => {
    const rawOffices = tpl?.officesSelection as unknown;

    const officesSelection: string[] = isStringArray(rawOffices)
      ? rawOffices
      : Array.isArray(rawOffices)
        ? (rawOffices as unknown[])
            .map((id: unknown): string => String(id))
            .filter((id: string): boolean => id.length > 0)
        : [];

    const sheetModeValue: 'perOffice' | 'merged' = tpl?.sheetMode === 'merged' ? 'merged' : 'perOffice';

    const rawLevels: unknown[] = Array.isArray(tpl?.sortLevels) ? (tpl.sortLevels as unknown[]) : [];

    const sortLevels: SortLevel[] = rawLevels
      .map((level: unknown): SortLevel | null => {
        if (!isSortLevel(level)) return null;
        const field: string = (level as any).field;
        const dir: 'asc' | 'desc' = coerceDir((level as any).dir);
        return { field, dir };
      })
      .filter((level: SortLevel | null): level is SortLevel => level !== null)
      .slice(0, 3);

    return {
      ...tpl,
      templateVersion: 2 as const,
      officesSelection,
      sheetMode: sheetModeValue,
      sortLevels,
    };
  };



  function applyTemplate(tpl: ExportTemplate) {
    setSelectedTemplateId(tpl.id);
    setSelectedColumns(tpl.selectedKeys);
    const normalized = normalizeTemplate(tpl);
    setSelectedOffices(normalized.officesSelection);
    setSheetMode(normalized.sheetMode);
    if (normalized.sortLevels.length > 0) {
      const [first, ...rest] = normalized.sortLevels;
      setSortBy(first.field);
      setSortDir(first.dir);
      setAdditionalSortLevels(rest.slice(0, 2));
    } else {
      setAdditionalSortLevels([]);
    }
    if (tpl.statusFilter) setStatusFilter(tpl.statusFilter);
    if (tpl.idColumnSource) setIdColumnSource(tpl.idColumnSource);

    // Appointment filters
    if (tpl.appointmentFilters) {
      if (tpl.appointmentFilters === "all") {
        setAppointmentFilters(APPOINTMENT_OPTIONS);
      } else {
        const allowed = new Set(APPOINTMENT_OPTIONS);
        setAppointmentFilters(tpl.appointmentFilters.filter(x => allowed.has(x)));
      }
    }

    // ✅ Find & Replace rules
    if (tpl.positionReplaceRules) {
      setPositionReplaceRules(tpl.positionReplaceRules);
    }

    // ✅ Paths
    if (tpl.paths) {
      setImageBaseDir(tpl.paths.imageBaseDir ?? imageBaseDir);
      setImageExt(tpl.paths.imageExt ?? imageExt);
      setQrBaseDir(tpl.paths.qrBaseDir ?? qrBaseDir);
      setQrExt(tpl.paths.qrExt ?? qrExt);
      setQrPrefix(tpl.paths.qrPrefix ?? qrPrefix);
    }
  }


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
    if (typeof window !== 'undefined') {
      return getActiveExportTab() || localStorage.getItem('hrps_advanced_tab') || 'filters';
    }
    return 'filters';
  });

  const handleAdvancedTabChange = (value: string) => {
    setAdvancedTab(value);
    setActiveExportTab(value);
  };

  const activeTabKey = TAB_VALUE_TO_KEY[advancedTab] ?? 'filter';


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
    refreshTemplates();
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

  const makeSafeFilename = (name: string) =>
    name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // reserved
      .replace(/\s+/g, " ")                  // collapse spaces
      .trim()
      .slice(0, 120);                        // keep it reasonable

  const selectedTemplateName = useMemo(() => {
    const tpl = templates.find(t => t.id === selectedTemplateId);
    return tpl?.name?.trim() || "Employee List";
  }, [templates, selectedTemplateId]);


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

  // Re-apply template appointment filters when mappings arrive
  useEffect(() => {
    if (!mappings) return;
    const lastTplId = localStorage.getItem("hrps.export.template");
    const tpl = getAllTemplates().find(t => t.id === lastTplId);
    if (!tpl?.appointmentFilters) return;

    if (tpl.appointmentFilters === "all") {
      setAppointmentFilters(APPOINTMENT_OPTIONS);
    } else {
      const allowed = new Set(APPOINTMENT_OPTIONS);
      setAppointmentFilters(tpl.appointmentFilters.filter(x => allowed.has(x)));
    }
  }, [mappings, APPOINTMENT_OPTIONS.join("|")]);


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

  const filteredOffices = useMemo(() => {
    const query = officeSearch.trim().toLowerCase();
    if (!query) return officeOptions;
    return officeOptions.filter((office) => {
      const name = office.name.toLowerCase();
      const code = office.bioIndexCode?.toLowerCase() ?? '';
      return name.includes(query) || (!!code && code.includes(query));
    });
  }, [officeOptions, officeSearch]);

  const toggleOfficeSelection = (officeId: string) => {
    setSelectedOffices((prev) =>
      prev.includes(officeId)
        ? prev.filter((id) => id !== officeId)
        : [...prev, officeId]
    );
  };

  const selectAllFilteredOffices = () => {
    if (!filteredOffices.length) {
      setSelectedOffices([]);
      return;
    }
    setSelectedOffices((prev) => {
      const set = new Set(prev);
      filteredOffices.forEach((office) => set.add(office.id));
      return Array.from(set);
    });
  };

  const deselectAllFilteredOffices = () => {
    if (!filteredOffices.length) {
      setSelectedOffices([]);
      return;
    }
    const remove = new Set(filteredOffices.map((office) => office.id));
    setSelectedOffices((prev) => prev.filter((id) => !remove.has(id)));
  };


  // under your other path states
  const [imageExt, setImageExt] = useState<string>(() =>
    (typeof window !== 'undefined' && localStorage.getItem('imageExt')) || 'png'
  );
  const [qrExt, setQrExt] = useState<string>(() =>
    (typeof window !== 'undefined' && localStorage.getItem('qrExt')) || 'png'
  );

  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('imageExt', imageExt); }, [imageExt]);
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('qrExt', qrExt); }, [qrExt]);

  // small helper to sanitize input like ".JPG" -> "jpg"
  const normalizeExt = (v: string) =>
    v.trim().replace(/^\./, '').toLowerCase() || 'png';

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
    { name: 'No. (row number)', key: 'rowNumber' },
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

    { name: 'Salary Grade', key: 'salaryGrade' },
    { name: 'Retired', key: 'isArchived' },
    { name: 'House No', key: 'houseNo' },
    { name: 'Street', key: 'street' },
    { name: 'Barangay', key: 'barangay' },
    { name: 'Comma', key: 'comma' },
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
    { name: 'Plantilla', key: 'plantilla' },
    { name: 'Salary', key: 'salaryExport' },
    { name: 'Birthday', key: 'birthday' }, // Will format the birthday
    { name: 'Age', key: 'age' }, // Calculated from birthday
    { name: 'Latest Appointment', key: 'latestAppointment' },
    { name: 'Date Hired', key: 'dateHired' }, // Will format the date
    { name: 'Year(s) of Service', key: 'yearsOfService' },
  ];

  const defaultSelectedColumns = [
    'rowNumber',
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

    return columnOrder.map((col) => {
      if (col.key === 'rowNumber') {
        return { ...col, name: 'No.' };
      }
      if (col.key === 'employeeNo') {
        return { ...col, name: label };
      }
      return col;
    });
  }, [columnOrder, idColumnSource]);

  const sortFieldOptions = useMemo(() => {
    const entries = new Map<string, string>();
    effectiveColumnOrder.forEach((col) => {
      const label = col.key === 'officeId' ? 'Office Name' : col.name;
      entries.set(col.key, label);
    });
    SORT_FIELDS.forEach((field) => {
      entries.set(field.key, field.label);
    });
    return Array.from(entries.entries()).map(([value, label]) => ({ value, label }));
  }, [effectiveColumnOrder]);

  const handleAddSortLevel = () => {
    if (additionalSortLevels.length >= 2) return;
    const fallback = sortFieldOptions[0]?.value || sortBy || 'updatedAt';
    setAdditionalSortLevels((prev) => [...prev, { field: fallback, dir: 'asc' }]);
  };

  const updateSortLevelField = (index: number, field: string) => {
    setAdditionalSortLevels((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], field };
      return next;
    });
  };

  const updateSortLevelDir = (index: number, dir: 'asc' | 'desc') => {
    setAdditionalSortLevels((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], dir };
      return next;
    });
  };

  const removeSortLevel = (index: number) => {
    setAdditionalSortLevels((prev) => prev.filter((_, i) => i !== index));
  };


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
      let officesSelection: string[] = [];
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('export.officesSelection');
          const parsed = stored ? JSON.parse(stored) : [];
          if (Array.isArray(parsed)) {
            officesSelection = Array.from(new Set(parsed.map((id: any) => String(id))));
          }
        } catch (error) {
          console.warn('Failed to parse export.officesSelection before download', error);
          officesSelection = [...selectedOffices];
        }
      } else {
        officesSelection = [...selectedOffices];
      }

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
        imageExt,   // NEW
        qrExt,
        sortBy,
        sortDir,
        officesSelection,
        officeMetadata,
        sortLevels: combinedSortLevels,
        sheetMode,

      });

      let base: string;
      if (sheetMode === 'merged') {
        const now = new Date();
        const datePart = now.toISOString().slice(0, 10);
        const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        base = makeSafeFilename(`Employees_MergedOffices_${datePart}_${timePart}`);
      } else {
        base = makeSafeFilename(selectedTemplateName); // e.g., "HR Core"
        if (officesSelection.length === 1) {
          const officeId = officesSelection[0];
          const info = officeMetadata[officeId];
          const suffixSource = info?.bioIndexCode || info?.name || officeId;
          if (suffixSource) {
            const safeSuffix = makeSafeFilename(`${suffixSource}`);
            if (safeSuffix) {
              base = makeSafeFilename(`${base}_${safeSuffix}`);
            }
          }
        }
      }
      const filename = `${base}.xlsx`;


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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleClickImport = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let user choose same file again later
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const { added, overwritten, skipped } = importTemplatesFromObject(json, {
        overwriteOnIdConflict: false, // set true if you want overwrite behavior
      });
      refreshTemplates();
      toast.success(
        `Imported: +${added}${overwritten ? `, overwritten ${overwritten}` : ""}${skipped ? `, skipped ${skipped}` : ""
        }`
      );
    } catch (err) {
      console.error(err);
      toast.error("Import failed: invalid or corrupted JSON.");
    }
  };

  const handleExport = (includeBuiltIns = false) => {
    const blob = exportTemplatesToBlob({ includeBuiltIns });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = includeBuiltIns ? "hrps-templates-all.json" : "hrps-templates-user.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    toast.message("Templates exported");
  };


  const handleUpdateCurrentTemplate = (id: string, newName?: string) => {

    if (isBuiltInTemplateId(id)) {
      toast.warning("Built-in templates can't be updated. Save as a new template instead.");
      return;
    }
    if (!selectedTemplateId) {
      toast.info("No template selected to update.");
      return;
    }
    if (isBuiltInTemplateId(selectedTemplateId)) {
      toast.warning("Built-in templates can't be updated. Save as a new template instead.");
      return;
    }

    const ok = overwriteUserTemplateById(selectedTemplateId, {
      name: (newName ?? selectedTemplateName)?.trim() || selectedTemplateName,
      templateVersion: 2,
      selectedKeys: selectedColumnsRef.current,
      statusFilter,
      idColumnSource,
      appointmentFilters,
      positionReplaceRules,
      officesSelection: selectedOffices.map((id) => String(id)),
      sheetMode,
      sortLevels: combinedSortLevels,
      sheetName: "Sheet1",
      paths: {
        imageBaseDir,
        imageExt,
        qrBaseDir,
        qrExt,
        qrPrefix,
      },
    });

    if (ok) {
      refreshTemplates();
      toast.success("Template updated.");
    } else {
      toast.error("Could not update template.");
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
        hideDefaultHeader
        contentClassName={cn(
          'z-[90] max-h-[min(88vh,960px)] rounded-2xl sm:rounded-2xl overflow-hidden sm:max-w-none gap-0 p-0',
          MODAL_WIDTH_CLASSES[modalSize]
        )}
        bodyClassName="flex h-full flex-col overflow-hidden"
      >
        <div className="flex h-full w-full min-w-0 flex-col">
          <div className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h2 className="text-base font-semibold leading-tight text-foreground">Select Columns to Export</h2>
                <p className="text-sm text-muted-foreground">Choose which fields to include in the Excel file.</p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground md:justify-end">
                <button
                  onClick={() => {
                    const name = prompt("Template name?");
                    if (!name) return;

                    const newTpl = saveTemplateToLocalStorage(name, {
                      templateVersion: 2,
                      selectedKeys: selectedColumnsRef.current,
                      statusFilter,
                      idColumnSource,
                      appointmentFilters,
                      positionReplaceRules,
                      officesSelection: selectedOffices.map((id) => String(id)),
                      sheetMode,
                      sortLevels: combinedSortLevels,
                      sheetName: "Sheet1",
                      paths: {
                        imageBaseDir,
                        imageExt,
                        qrBaseDir,
                        qrExt,
                        qrPrefix,
                      },
                    });

                    refreshTemplates();
                    setSelectedTemplateId(newTpl.id);
                    toast.success(`Saved template "${name}"`);
                  }}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground transition hover:text-foreground"
                  title="Save current selections as a new template"
                >
                  <Save className="h-4 w-4" />
                  Save Template
                </button>

                <button
                  type="button"
                  onClick={() => handleExport(false)}
                  title="Export user templates (.json)"
                  className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground transition hover:text-foreground"
                >
                  <FileDown className="h-4 w-4" />
                  Export
                </button>

                <button
                  type="button"
                  onClick={() => handleExport(true)}
                  title="Export all templates (.json)"
                  className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground transition hover:text-foreground"
                >
                  <FileDown className="h-4 w-4" />
                  Export All
                </button>

                <button
                  type="button"
                  onClick={handleClickImport}
                  title="Import templates (.json)"
                  className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground transition hover:text-foreground"
                >
                  <FileUp className="h-4 w-4" />
                  Import
                </button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  title="Toggle modal size"
                  onClick={toggleModalSize}
                >
                  {modalSizeLabel}
                </Button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 w-full min-w-0 pl-4 pr-2 py-4 overflow-y-auto overflow-x-hidden max-h-[calc(88vh-112px)] scrollbar-gutter-stable">
            <TemplatePickerBar
              className="mb-3 w-full"
              value={selectedTemplateId}
              templates={templates}
              onApply={(tpl) => {
                applyTemplate(tpl);
                setSelectedTemplateId(tpl.id);
              }}
              onChangeSelected={setSelectedTemplateId}
              clearLastUsedTemplate={clearLastUsedTemplate}
              clearAllUserTemplates={clearAllUserTemplates}
              deleteUserTemplate={deleteUserTemplate}
              refreshTemplates={refreshTemplates}
              onRequestUpdate={(id, newName) => handleUpdateCurrentTemplate(id, newName)}
            />

            {/* ADVANCED (single collapsible with both subsections) */}
            <div className="w-full min-w-0">
              {/* ADVANCED (single box; sticky header + conditional mount for content) */}
              <div className="mb-4 rounded-lg border bg-white shadow-sm">
            {/* Sticky header so the toggle stays visible */}
            <div className="sticky top-0 z-10 border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                    <Tabs value={advancedTab} onValueChange={handleAdvancedTabChange} className="w-full min-w-0">
                      <div className="sticky top-[48px] z-20 bg-background border-b flex flex-wrap items-center gap-2 px-2 py-2">
                        {EXPORT_TABS.map((tab) => {
                          const Icon = tab.icon;
                          const isActive = activeTabKey === tab.key;
                          return (
                            <Button
                              key={tab.key}
                              variant={isActive ? 'secondary' : 'ghost'}
                              size="sm"
                              onClick={() => handleAdvancedTabChange(TAB_KEY_TO_VALUE[tab.key])}
                              aria-label={tab.label}
                              title={tab.label}
                              aria-selected={isActive}
                              aria-current={isActive ? 'page' : undefined}
                              aria-controls={`panel-${tab.key}`}
                              className="h-8 px-2 gap-2"
                            >
                              <Icon className="size-4" />
                              <span className="whitespace-nowrap">{tab.label}</span>
                            </Button>
                          );
                        })}
                      </div>

                    {/* TAB: Paths */}
                    <TabsContent value="paths" id="panel-paths" className="mt-3">
                      <div className="rounded-md border bg-white p-3 space-y-3 w-full min-w-0">
                        <h4 className="text-sm font-semibold">Paths</h4>
                        <div className="grid gap-3 sm:grid-cols-2 w-full min-w-0">
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
                            <div className="mt-2 flex items-center gap-2">
                              <label className="text-xs text-gray-600">Image extension</label>
                              <input
                                type="text"
                                value={imageExt}
                                onChange={(e) => setImageExt(normalizeExt(e.target.value))}
                                className="border rounded px-2 py-1 text-xs w-24"
                                placeholder="png | jpg | webp"
                              />
                            </div>
                            <p className="mt-1 text-[11px] text-gray-500">
                              Example: <code>{`${imageBaseDir}\\<employeeNo>.${imageExt}`}</code>
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
                            <div className="mt-2 flex items-center gap-2">
                              <label className="text-xs text-gray-600">QR extension</label>
                              <input
                                type="text"
                                value={qrExt}
                                onChange={(e) => setQrExt(normalizeExt(e.target.value))}
                                className="border rounded px-2 py-1 text-xs w-24"
                                placeholder="png | jpg | webp"
                              />
                            </div>
                            <p className="mt-1 text-[11px] text-gray-500">
                              Example: <code>{`${qrBaseDir}\\${qrPrefix}<employeeNo>.${qrExt}`}</code>
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
                                setImageExt('png');
                                setQrExt('png');
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
                    <TabsContent value="position" id="panel-findreplace" className="mt-3">
                      <div className="rounded-md border bg-white p-3 w-full min-w-0">
                        <div className="space-y-2 min-w-0">
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

                          <div className="border rounded w-full min-w-0">
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
                    <TabsContent value="columns_path" id="panel-columns" className="mt-3">
                      <div className="rounded-md border bg-white p-3 w-full min-w-0">
                        <div className="mb-2 flex justify-between items-center text-sm">
                          <label className="font-medium">Select Columns</label>
                          <button
                            onClick={toggleSelectAll}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            {isAllSelected ? "Deselect All" : "Select All"}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto border p-2 rounded bg-white shadow min-w-0">
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
                    <TabsContent value="sort" id="panel-sort" className="mt-3">
                      <div className="rounded-md border bg-white p-3 w-full min-w-0">
                        <h4 className="text-sm font-semibold">Sort</h4>
                        <div className="mt-2 space-y-3 text-sm">
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2">
                              <span>Field:</span>
                              <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="border rounded px-2 py-1 text-xs"
                              >
                                {sortFieldOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                                {!sortFieldOptions.some((option) => option.value === sortBy) && sortBy ? (
                                  <option value={sortBy}>{sortBy}</option>
                                ) : null}
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span>Order:</span>
                              <select
                                value={sortDir}
                                onChange={(e) => setSortDir(e.target.value === 'asc' ? 'asc' : 'desc')}
                                className="border rounded px-2 py-1 text-xs"
                              >
                                <option value="desc">Descending</option>
                                <option value="asc">Ascending</option>
                              </select>
                            </label>
                          </div>

                          {additionalSortLevels.map((level, index) => (
                            <div key={index} className="flex flex-wrap items-center gap-3">
                              <span className="text-xs font-semibold text-gray-500">Then by:</span>
                              <label className="flex items-center gap-2">
                                <span>Field:</span>
                                <select
                                  value={level.field}
                                  onChange={(e) => updateSortLevelField(index, e.target.value)}
                                  className="border rounded px-2 py-1 text-xs"
                                >
                                  {sortFieldOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                  {!sortFieldOptions.some((option) => option.value === level.field) && level.field ? (
                                    <option value={level.field}>{level.field}</option>
                                  ) : null}
                                </select>
                              </label>
                              <label className="flex items-center gap-2">
                                <span>Order:</span>
                                <select
                                  value={level.dir}
                                  onChange={(e) => updateSortLevelDir(index, e.target.value === 'asc' ? 'asc' : 'desc')}
                                  className="border rounded px-2 py-1 text-xs"
                                >
                                  <option value="desc">Descending</option>
                                  <option value="asc">Ascending</option>
                                </select>
                              </label>
                              <button
                                type="button"
                                onClick={() => removeSortLevel(index)}
                                className="text-gray-500 hover:text-red-600"
                                aria-label={`Remove sort level ${index + 2}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={handleAddSortLevel}
                            disabled={additionalSortLevels.length >= 2}
                            className="text-xs text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            + Add sort level
                          </button>
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="filters" id="panel-filter" className="mt-3">
                      <div className="rounded-md border bg-white p-3 space-y-4 w-full min-w-0">
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

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto border p-2 rounded bg-white shadow min-w-0">
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

                        <div>
                          <div className="mb-2 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <label className="font-medium">Filter by Office</label>
                            <div className="flex gap-2 text-xs">
                              <button
                                type="button"
                                onClick={selectAllFilteredOffices}
                                className="text-blue-600 hover:underline"
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                onClick={deselectAllFilteredOffices}
                                className="text-blue-600 hover:underline"
                              >
                                Deselect All
                              </button>
                            </div>
                          </div>

                          <input
                            type="text"
                            value={officeSearch}
                            onChange={(e) => setOfficeSearch(e.target.value)}
                            placeholder="Search offices..."
                            className="w-full mb-2 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                          />

                          <div className="space-y-2 max-h-48 overflow-y-auto border p-2 rounded bg-white shadow min-w-0">
                            {filteredOffices.length === 0 ? (
                              <p className="text-xs text-gray-500 px-1">No offices match your search.</p>
                            ) : (
                              filteredOffices.map((office) => (
                                <label key={office.id} className="flex items-start gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={selectedOffices.includes(office.id)}
                                    onChange={() => toggleOfficeSelection(office.id)}
                                    className="mt-1"
                                  />
                                  <span className="flex flex-col">
                                    <span>{office.name}</span>
                                    {office.bioIndexCode ? (
                                      <span className="text-xs text-gray-500">{office.bioIndexCode}</span>
                                    ) : null}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="border-t border-gray-200 pt-3">
                          <span className="text-sm font-medium">Sheet mode</span>
                          <div className="mt-2 space-y-2 text-sm">
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="sheetMode"
                                value="perOffice"
                                checked={sheetMode === 'perOffice'}
                                onChange={() => setSheetMode('perOffice')}
                              />
                              <span>One sheet per office</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="sheetMode"
                                value="merged"
                                checked={sheetMode === 'merged'}
                                onChange={() => setSheetMode('merged')}
                              />
                              <span>Single sheet (merge selected offices)</span>
                            </label>
                          </div>
                        </div>

                      </div>
                    </TabsContent>

                    <TabsContent value="id" id="panel-id" className="mt-3">
                      <div className="rounded-md border bg-white p-3 space-y-3 w-full min-w-0">
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
        </div>
      </div>
      </Modal>

    </div>
  );
}
