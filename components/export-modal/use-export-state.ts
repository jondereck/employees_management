import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { 
  getAllTemplates, 
  saveTemplateToLocalStorage 
} from '@/utils/export-templates';
import { SORT_FIELDS } from '@/utils/sort-fields';
import { type SortLevel, type ExportTemplateV2 } from '@/types/export';

// Types for our consolidated state
export type ExportState = {
  loading: boolean;
  selectedTemplateId?: string;
  selectedColumns: string[];
  selectedOffices: string[];
  filterGroupMode: 'office' | 'bioIndex';
  sheetMode: 'perOffice' | 'merged' | 'plain';
  modalSize: 'cozy' | 'roomy' | 'xl';
  sortLevels: SortLevel[];
  positionReplaceRules: any[];
  statusFilter: 'all' | 'active' | 'retired';
  appointmentFilters: string[];
};

export function useExportState() {
  const params = useParams();
  const departmentId = params?.departmentId as string;

  // --- 1. Basic UI State ---
  const [loading, setLoading] = useState(false);
  const [modalSize, setModalSize] = useState<'cozy' | 'roomy' | 'xl'>('roomy');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();

  // --- 2. Configuration State ---
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [filterGroupMode, setFilterGroupMode] = useState<'office' | 'bioIndex'>('office');
  const [sheetMode, setSheetMode] = useState<'perOffice' | 'merged' | 'plain'>('perOffice');
  const [sortLevels, setSortLevels] = useState<SortLevel[]>([
    { field: 'updatedAt', dir: 'desc' }
  ]);
  const [positionReplaceRules, setPositionReplaceRules] = useState([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'retired'>('all');
  const [appointmentFilters, setAppointmentFilters] = useState<string[]>([]);

  // --- 3. Persistence (Hydration) ---
  useEffect(() => {
    // Load initial settings from localStorage on mount
    const savedOffices = localStorage.getItem('export.officesSelection');
    if (savedOffices) setSelectedOffices(JSON.parse(savedOffices));
    
    const savedSize = localStorage.getItem('export.modalSize') as any;
    if (savedSize) setModalSize(savedSize);
  }, []);

  // --- 4. Actions (The "Step" logic) ---
  const actions = {
    toggleModalSize: () => {
      setModalSize(prev => prev === 'xl' ? 'roomy' : 'xl');
    },

    applyTemplate: (tpl: any) => {
      setSelectedTemplateId(tpl.id);
      setSelectedColumns(tpl.selectedKeys || []);
      setSelectedOffices(tpl.officesSelection || []);
      setSheetMode(tpl.sheetMode || 'perOffice');
      setSortLevels(tpl.sortLevels || [{ field: 'updatedAt', dir: 'desc' }]);
      setPositionReplaceRules(tpl.positionReplaceRules || []);
      setAppointmentFilters(tpl.appointmentFilters === "all" ? [] : tpl.appointmentFilters);
      toast.success(`Applied template: ${tpl.name}`);
    },

    updateSort: (index: number, field: string, dir: 'asc' | 'desc') => {
      setSortLevels(prev => {
        const next = [...prev];
        next[index] = { field, dir };
        return next;
      });
    },

    handleDownload: async () => {
      setLoading(true);
      try {
        // Here you would call your generateExcelFile utility
        toast.promise(new Promise(res => setTimeout(res, 2000)), {
          loading: 'Preparing Excel sheets...',
          success: 'Export successful!',
          error: 'Export failed.',
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // --- 5. Computed Values (Helpers for the UI) ---
  const computed = {
    modalWidth: modalSize === 'xl' ? 'max-w-[1400px]' : 'max-w-[1000px]',
    selectedCount: selectedColumns.length,
    officeCount: selectedOffices.length,
    isReady: selectedColumns.length > 0 && (selectedOffices.length > 0 || sheetMode === 'plain')
  };

  return { state: { 
    loading, 
    selectedTemplateId, 
    selectedColumns, 
    selectedOffices, 
    filterGroupMode, 
    sheetMode, 
    modalSize,
    sortLevels,
    positionReplaceRules,
    statusFilter,
    appointmentFilters
  }, actions, computed };
}