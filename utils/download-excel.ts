import * as XLSX from 'xlsx-js-style';

import type { SortDir, SortLevel as ExportSortLevel } from '@/types/export';
import { SORT_FIELDS } from '@/utils/sort-fields';
import { COLUMN_DEFS } from '@/utils/columns.registry';


export type Column = { name: string; key: string };

export type IdColumnSource = 'uuid' | 'bio' | 'employeeNo';

export type SortLevel = ExportSortLevel;


const BIO_INDEX_GROUP_KEY = '__NO_CODE__';

type GroupMode = 'office' | 'bioIndex';


export type PositionReplaceRule = {
  mode: 'exact' | 'startsWith' | 'contains' | 'regex';
  targets: string[];        // user-selected positions / patterns
  replaceWith: string;      // text to replace with
  caseSensitive?: boolean;  // default false
};
export type Mappings = {
  officeMapping: Record<string, string>;
  eligibilityMapping: Record<string, string>;
  appointmentMapping: Record<string, string>;

};

type SalaryRow = { grade: number; step: number; amount: number };

type DownloadExcelParams = {
  selectedKeys: string[];
  columnOrder: Column[];
  statusFilter: 'all' | 'active' | 'retired';
  baseImageDir: string;
  baseQrDir: string;
  qrPrefix?: string;
  appointmentFilters: string[] | 'all';
  mappings: Mappings; // <-- NEW
  positionReplaceRules?: PositionReplaceRule[];
  idColumnSource: IdColumnSource;
  imageExt?: string;
  qrExt?: string;
  salaryTable?: SalaryRow[];         // <- NEW: pass in or fetch inside
  salaryModeField?: string;
   sortBy?: string;
  sortDir?: 'asc' | 'desc';
  officesSelection?: string[];
  officeMetadata?: Record<string, { name: string; bioIndexCode?: string | null }>;
  sortLevels?: SortLevel[];
  sheetMode?: 'perOffice' | 'merged';
  filterGroupMode?: 'office' | 'bioIndex';
};

function ts(v: any) {
  if (!v) return 0;
  if (typeof v === 'string') return Date.parse(v) || 0;
  if (v instanceof Date) return v.getTime() || 0;
  return 0;
}

function normalizeNFC<T>(val: T): T {
  if (typeof val === "string") return (val.normalize?.("NFC") ?? val) as T;
  return val;
}

function normalizeRowStringsNFC<T extends Record<string, any>>(row: T): T {
  const out: any = {};
  for (const k in row) {
    const v = row[k];
    if (typeof v === "string") out[k] = normalizeNFC(v);
    else if (Array.isArray(v)) out[k] = v.map((x: any) => (typeof x === "string" ? normalizeNFC(x) : x));
    else out[k] = v;
  }
  return out as T;
}


function normalizeWindowsDir(p: string) {
  const trimmed = (p || '').trim().replace(/[\/]/g, '\\');
  // remove trailing slashes
  return trimmed.replace(/[\\]+$/, '');
}

function applyPositionRules(
  value: string,
  rules: PositionReplaceRule[] | undefined
): string {
  if (!value || !rules?.length) return value;

  let out = value;
  for (const rule of rules) {
    const cs = !!rule.caseSensitive;
    const val = cs ? out : out.toLowerCase();

    for (const t of rule.targets) {
      const target = cs ? String(t) : String(t).toLowerCase();

      if (rule.mode === 'exact') {
        if (val === target) { out = rule.replaceWith; break; }
      } else if (rule.mode === 'startsWith') {
        if (val.startsWith(target)) { out = rule.replaceWith; break; }
      } else if (rule.mode === 'contains') {
        if (val.includes(target)) { out = rule.replaceWith; break; }
      } else if (rule.mode === 'regex') {
        try {
          const rx = new RegExp(t, cs ? '' : 'i');
          out = out.replace(rx, rule.replaceWith);
        } catch { /* ignore bad regex */ }
      }
    }
  }
  return out;
}

function lookupAutoSalary(
  grade?: number | null,
  step?: number | null,
  table?: SalaryRow[]
): number | undefined {
  if (!grade || !step || !table?.length) return undefined;
  const row = table.find(r => r.grade === grade && r.step === step);
  return row?.amount;
}

function decideSalarySource(row: any, salaryModeField?: string): 'auto' | 'manual' {
  // Priority 1: explicit field from API if available
  if (salaryModeField && typeof row?.[salaryModeField] === 'string') {
    const v = String(row[salaryModeField]).toLowerCase();
    if (v === 'auto' || v === 'manual') return v as 'auto' | 'manual';
  }
  // Priority 2: boolean hints
  if (typeof row?.isSalaryManual === 'boolean') return row.isSalaryManual ? 'manual' : 'auto';
  if (typeof row?.salaryManual === 'boolean') return row.salaryManual ? 'manual' : 'auto';
  // Fallback: if grade & step exist, assume auto; else manual
  if (Number(row?.salaryGrade) > 0 && Number(row?.salaryStep) > 0) return 'auto';
  return 'manual';
}


export async function generateExcelFile({
  selectedKeys,
  columnOrder,
  statusFilter,
  baseImageDir,
  baseQrDir,
  qrPrefix = 'JDN',
  appointmentFilters,
  mappings,
  positionReplaceRules,
  idColumnSource,
  imageExt,
  qrExt,
  salaryTable,
  salaryModeField,
  sortBy,
  sortDir,
  officesSelection = [],
  officeMetadata = {},
  sortLevels,
  sheetMode,
  filterGroupMode,
}: DownloadExcelParams): Promise<Blob> {

  const { officeMapping, eligibilityMapping, appointmentMapping } = mappings;
  const hiddenFields = [
    'departmentId', 'id', 'isFeatured', 'isAwardee',
    'createdAt', 'updatedAt', 'employeeLink', 'prefix', 'region'
  ];

  const response = await fetch('/api/backup-employee?' + new Date().getTime(), {
    cache: 'no-store',
  });

  

  async function fetchStepsForGrade(sg: number): Promise<{ [step: number]: number }> {
    const res = await fetch(`/api/departments/salary?sg=${sg}`, { cache: 'no-store' });
    if (!res.ok) return {};
    const json = await res.json(); // { sg, steps: { [step]: amount } }
    return json.steps ?? {};
  }



  if (!response.ok) throw new Error('Failed to fetch employee data');

  const data = await response.json();
  if (!data?.employees || data.employees.length === 0) {
    throw new Error('No employee data found.');
  }

  const safeImageDir = normalizeWindowsDir(baseImageDir);
  const safeQrDir = normalizeWindowsDir(baseQrDir);



  const gradeNums: number[] = (data.employees as any[])
    .map(e => Number(e.salaryGrade))
    .filter((g): g is number => Number.isFinite(g) && g > 0);

  const neededGrades: number[] = Array.from(new Set(gradeNums));

  const stepsByGradeEntries = await Promise.all(
    neededGrades.map(async (g) => {
      const steps = await fetchStepsForGrade(g);
      return [g, steps] as [number, Record<number, number>];
    })
  );

  const stepsByGrade: Record<number, Record<number, number>> =
    Object.fromEntries(stepsByGradeEntries);

  // Helper using the map above (you can keep this local)
  function lookupAutoSalaryFromMap(grade?: number, step?: number): number | undefined {
    if (!grade || !step) return undefined;
    return stepsByGrade[grade]?.[step];
  }

  const hasText = (v: unknown) =>
  v != null && String(v).trim().length > 0;

  const updatedData = data.employees.map((row: any) => {
    const copy: any = { ...row };
    const originalOfficeId = copy.officeId ?? '';
    copy.__officeId = originalOfficeId ? String(originalOfficeId) : '';

    copy.officeId = copy.__officeId;

    const meta = officeMetadata[copy.__officeId] ?? {};
    const officeName = meta.name
      || officeMapping[copy.__officeId]
      || row.offices?.name
      || row.office?.name
      || '';
    const bioIndexCodeRaw = meta.bioIndexCode
      ?? row.offices?.bioIndexCode
      ?? row.office?.bioIndexCode
      ?? row.bioIndexCode
      ?? '';
    copy.office = officeName;
    copy.__bioIndexCode = bioIndexCodeRaw ? String(bioIndexCodeRaw).trim() : '';

    // --- map IDs to labels ---
    if (copy.eligibilityId && eligibilityMapping[copy.eligibilityId]) {
      copy.eligibilityId = eligibilityMapping[copy.eligibilityId];
    }
    if (copy.employeeTypeId && appointmentMapping[copy.employeeTypeId]) {
      copy.employeeTypeId = appointmentMapping[copy.employeeTypeId];
    }

    copy.appointment = copy.employeeTypeId; // label string after mapping
    copy.eligibility = copy.eligibilityId;  // label string after mapping
    copy.status = copy.isArchived ? "Retired" : "Active";
    copy.comma = (hasText(copy.barangay) && hasText(copy.city)) ? "," : "";


    // --- Plantilla: designation name or fallback to office name ---
    if (copy.designationId && officeMapping[copy.designationId]) {
      copy.plantilla = officeMapping[copy.designationId];
    } else {
      copy.plantilla = copy.office || '';
    }

    // --- Dates ---
    if (copy.birthday) {
      copy.birthday = new Date(copy.birthday).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    if (copy.dateHired) {
      copy.dateHired = new Date(copy.dateHired).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }

    // --- Middle initial ---
    if (copy.middleName) {
      const trimmed = copy.middleName.trim();
      copy.middleName = trimmed.length > 0 ? `${trimmed[0].toUpperCase()}.` : '';
    }

    // --- Position rules ---
    if (copy.position) {
      copy.position = applyPositionRules(String(copy.position), positionReplaceRules);
    }

    // --- IDs cleanup ---
    copy.gsisNo = (copy.gsisNo?.toString().trim()) || "N/A";
    copy.tinNo = (copy.tinNo?.toString().trim()) || "N/A";
    copy.philHealthNo = (copy.philHealthNo?.toString().trim()) || "N/A";
    copy.pagIbigNo = (copy.pagIbigNo?.toString().trim()) || "N/A";

    // --- Nickname fallback ---
    if (!copy.nickname || copy.nickname.toString().trim() === "") {
      const first = (copy.firstName ?? "").toString().trim();
      copy.nickname = first.split(/\s+/)[0] || "";
    }

    // --- Image/QR paths ---
    const imgExt = (imageExt || 'png').replace(/^\./, '').toLowerCase();
    const qrcodeExt = (qrExt || 'png').replace(/^\./, '').toLowerCase();
    const employeeNoSafe = String(copy.employeeNo ?? '').split(',')[0].trim();
    copy.imagePath = `${safeImageDir}\\${employeeNoSafe}.${imgExt}`;
    copy.qrPath = `${safeQrDir}\\${qrPrefix}${employeeNoSafe}.${qrcodeExt}`;

    // --- Salary export (auto vs manual) ---
    const source = decideSalarySource(copy, salaryModeField);
    let salaryExport = Number(copy.salary) || 0;

    // Prefer table passed in; else use the API-built stepsByGrade map
    const autoFromParam = lookupAutoSalary(Number(copy.salaryGrade), Number(copy.salaryStep), salaryTable);
    const autoFromApiMap = lookupAutoSalaryFromMap(Number(copy.salaryGrade), Number(copy.salaryStep));

    if (source === 'auto') {
      const auto = (typeof autoFromParam === 'number' ? autoFromParam : autoFromApiMap);
      if (typeof auto === 'number' && Number.isFinite(auto)) {
        salaryExport = auto;
      }
    }

    // If you want the existing "Salary" column to reflect this, overwrite:
    // copy.salary = salaryExport;
    // Or keep it separate (and add 'salaryExport' column in your modal):
    copy.salaryExport = salaryExport;
    copy.salarySourceExport = source;
    if (copy.yearsOfService === undefined) copy.yearsOfService = "";
    // --- Normalize text for NFC (ñ fix) ---
    return normalizeRowStringsNFC(copy);
  });


  let filteredEmployees = updatedData;
  if (statusFilter === 'active') {
    filteredEmployees = updatedData.filter((emp: any) => emp.isArchived === false);
  } else if (statusFilter === 'retired') {
    filteredEmployees = updatedData.filter((emp: any) => emp.isArchived === true);
  }

  if (appointmentFilters !== 'all') {
  const allowed = new Set(appointmentFilters.map(s => s.toLowerCase()));
  filteredEmployees = filteredEmployees.filter((emp: any) =>
    emp.employeeTypeId && allowed.has(String(emp.employeeTypeId).toLowerCase())
  );
}

  if (appointmentFilters !== 'all') {
    const allowed = new Set(appointmentFilters.map(s => s.toLowerCase()));
    filteredEmployees = filteredEmployees.filter((emp: any) =>
      emp.employeeTypeId && allowed.has(String(emp.employeeTypeId).toLowerCase())
    );
  }
  const includeRowNumber = selectedKeys.includes('rowNumber');

  const visibleColumns = columnOrder
    .filter(col => !hiddenFields.includes(col.key) && selectedKeys.includes(col.key))
    .map(col => {
      if (col.key === 'rowNumber') {
        return { ...col, name: 'No.' };
      }
      if (col.key !== 'employeeNo') return col;

      const name =
        idColumnSource === 'uuid' ? 'Employee UUID'
          : idColumnSource === 'bio' ? 'Bio Number'
            : 'Employee No'; // the code like X-1

      return { ...col, name };
    });


  const headers = visibleColumns.map(col => col.name);

  const legacySortField = sortBy ?? 'updatedAt';
  const legacySortDir = (sortDir === 'asc' || sortDir === 'desc' ? sortDir : 'desc') as SortDir;

  const rawLevels: unknown[] = Array.isArray(sortLevels) ? (sortLevels as unknown[]) : [];

  const normalizedLevels: SortLevel[] = rawLevels
    .map((lvl: unknown): SortLevel | null => {
      if (!lvl || typeof (lvl as any).field !== 'string') return null;
      const field: string = (lvl as any).field;
      const dir: SortDir = (lvl as any).dir === 'desc' ? 'desc' : 'asc';
      return { field, dir };
    })
    .filter((v): v is SortLevel => v !== null)
    .slice(0, 3);

  const effectiveSortLevels: SortLevel[] = normalizedLevels.length
    ? normalizedLevels
    : [{ field: legacySortField, dir: legacySortDir }];

  const formatRow = (row: any) => {
    const newRow: Record<string, any> = {};
    const raw = String(row.employeeNo ?? '').trim();
    const [bioPartRaw, codePartRaw] = raw.split(',');
    const bioPart = (bioPartRaw ?? '').trim();
    const codePart = (codePartRaw ?? '').trim();

    visibleColumns.forEach((col) => {
      let val: any;
      if (col.key === 'rowNumber') {
        val = typeof row.__rowNumber === 'number' ? row.__rowNumber : '';
      } else if (col.key === 'employeeNo') {
        if (idColumnSource === 'uuid') {
          val = row.id ?? '';
        } else if (idColumnSource === 'bio') {
          val = bioPart || codePart || row.id || '';
        } else {
          val = codePart || bioPart || row.id || '';
        }
      } else {
        const def = COLUMN_DEFS[col.key];
        if (def?.accessor) {
          val = def.accessor(row);
        } else {
          val = row[col.key];
        }
      }
      if (val == null) val = '';
      newRow[col.name] = val;
    });

    return newRow;
  };

  const createDisplayRows = (rows: any[]) => {
    const filteredData = rows.map(formatRow);
    const dataRows = filteredData.map((row) => headers.map((header) => row[header]));
    return { filteredData, dataRows };
  };

  const styleHeaderRow = (worksheet: XLSX.WorkSheet, headerRowIdx: number) => {
    headers.forEach((header, colIdx) => {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIdx, c: colIdx });
      const cell = worksheet[cellAddress] || { t: 's', v: header };
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
        fill: { fgColor: { rgb: '28a745' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      };
      worksheet[cellAddress] = cell;
    });
  };

  const styleDataRows = (
    worksheet: XLSX.WorkSheet,
    filteredData: Record<string, any>[] ,
    dataStartRowIdx: number
  ) => {
    filteredData.forEach((row, rowIndex) => {
      const isRetired = row['Retired'] === true || String(row['Retired']).toLowerCase() === 'true';
      headers.forEach((header, colIndex) => {
        const cellAddress = XLSX.utils.encode_cell({ r: dataStartRowIdx + rowIndex, c: colIndex });
        const baseStyle: any = {
          font: { sz: 11, color: { rgb: '000000' } },
          alignment: {
            vertical: 'center',
            horizontal: header === 'No.' ? 'right' : 'left',
            wrapText: header === 'No.' ? false : true,
          },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } },
          },
        };
        if (isRetired) {
          baseStyle.fill = { fgColor: { rgb: 'FFCCCC' } };
          baseStyle.font = { sz: 11, color: { rgb: '990000' }, bold: true };
        }
        const cell = worksheet[cellAddress] || { t: 's', v: row[header] ?? '' };
        if (header === 'No.' && typeof row[header] === 'number') {
          cell.t = 'n';
        }
        cell.s = { ...cell.s, ...baseStyle };
        worksheet[cellAddress] = cell;
      });
    });
  };

  const idxBirthday = headers.indexOf('Birthday');
  const idxAge = headers.indexOf('Age');
  const idxDateHired = headers.indexOf('Date Hired');
  const idxYearsOfService = headers.indexOf('Year(s) of Service');
  const idxTerminateDate = headers.indexOf('Terminate Date');

  const applyDateFormulas = (
    worksheet: XLSX.WorkSheet,
    filteredData: Record<string, any>[],
    dataStartRowIdx: number
  ) => {
    if (!filteredData.length) return;
    const addr = (rowNumber: number, colIndex: number) =>
      XLSX.utils.encode_cell({ r: rowNumber - 1, c: colIndex });
    const dataExcelStartRow = dataStartRowIdx + 1;

    for (let i = 0; i < filteredData.length; i++) {
      const rowNumber = dataExcelStartRow + i;

      const birthdateCell = idxBirthday >= 0 ? addr(rowNumber, idxBirthday) : undefined;
      const ageCell = idxAge >= 0 ? addr(rowNumber, idxAge) : undefined;
      const hiredDateCell = idxDateHired >= 0 ? addr(rowNumber, idxDateHired) : undefined;
      const serviceCell = idxYearsOfService >= 0 ? addr(rowNumber, idxYearsOfService) : undefined;
      const terminateDateCell = idxTerminateDate >= 0 ? addr(rowNumber, idxTerminateDate) : undefined;

      if (ageCell && birthdateCell) {
        const startRef = `IF(${birthdateCell}="","",DATEVALUE(${birthdateCell}))`;
        const endRef = terminateDateCell
          ? `IF(${terminateDateCell}="",TODAY(),DATEVALUE(${terminateDateCell}))`
          : `TODAY()`;

        worksheet[ageCell] = {
          t: 'n',
          f: `IF(${birthdateCell}="","",DATEDIF(${startRef},${endRef},"Y"))`,
          s: worksheet[ageCell]?.s || {},
        };
      }

      if (serviceCell && hiredDateCell) {
        const startRef = `IF(${hiredDateCell}="","",DATEVALUE(${hiredDateCell}))`;
        const endRef = terminateDateCell
          ? `IF(${terminateDateCell}="",TODAY(),DATEVALUE(${terminateDateCell}))`
          : `TODAY()`;

        worksheet[serviceCell] = {
          t: 'n',
          f: `IF(${hiredDateCell}="","",DATEDIF(${startRef},${endRef},"Y"))`,
          s: worksheet[serviceCell]?.s || {},
        };
      }
    }
  };

  const applyColumnWidths = (worksheet: XLSX.WorkSheet, data: Record<string, any>[]) => {
    const columnWidths = headers.map((header) => {
      if (header === 'No.') {
        return { wch: 8 };
      }
      let maxLength = header.length;
      data.forEach((row: any) => {
        const cellValue = row?.[header] ?? '';
        const cellLength = String(cellValue).length;
        if (cellLength > maxLength) {
          maxLength = cellLength;
        }
      });
      return { wch: maxLength + 1 };
    });
    if (columnWidths.length > 0) {
      worksheet['!cols'] = columnWidths;
    }
  };

  const addMergedTitleRow = (worksheet: XLSX.WorkSheet, rowIndex: number, title: string, note?: string) => {
    XLSX.utils.sheet_add_aoa(worksheet, [[title]], { origin: { r: rowIndex, c: 0 } });
    worksheet['!merges'] = worksheet['!merges'] || [];
    worksheet['!merges'].push({
      s: { r: rowIndex, c: 0 },
      e: { r: rowIndex, c: Math.max(headers.length - 1, 0) },
    });
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: 0 });
    const cell = worksheet[cellAddress] || { t: 's', v: title };
    cell.t = 's';
    cell.v = title;
    cell.s = {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { fgColor: { rgb: 'DDDDDD' } },
    };
    worksheet[cellAddress] = cell;
    let rowsUsed = 1;

    if (note) {
      const noteRowIndex = rowIndex + 1;
      XLSX.utils.sheet_add_aoa(worksheet, [[note]], { origin: { r: noteRowIndex, c: 0 } });
      worksheet['!merges'].push({
        s: { r: noteRowIndex, c: 0 },
        e: { r: noteRowIndex, c: Math.max(headers.length - 1, 0) },
      });
      const noteAddress = XLSX.utils.encode_cell({ r: noteRowIndex, c: 0 });
      const noteCell = worksheet[noteAddress] || { t: 's', v: note };
      noteCell.t = 's';
      noteCell.v = note;
      noteCell.s = {
        font: { sz: 11, italic: true, color: { rgb: '666666' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      };
      worksheet[noteAddress] = noteCell;
      rowsUsed += 1;
    }

    return rowsUsed;
  };

  const buildWorksheet = (rows: any[], options: { includeTitle?: boolean; title?: string; subtitle?: string } = {}) => {
    const sortedRows = sortRows(rows, effectiveSortLevels);
    const numberedRows = includeRowNumber
      ? sortedRows.map((row, idx) => ({ ...row, __rowNumber: idx + 1 }))
      : sortedRows;
    const { filteredData, dataRows } = createDisplayRows(numberedRows);
    const worksheet = XLSX.utils.aoa_to_sheet([]);
    const includeTitle = !!options.includeTitle;
    let currentRow = 0;

    if (includeTitle) {
      const titleText = options.title ?? '';
      const rowsAdded = addMergedTitleRow(worksheet, currentRow, titleText, options.subtitle);
      currentRow += rowsAdded;
    }

    const headerRowIdx = currentRow;
    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: { r: headerRowIdx, c: 0 } });
    styleHeaderRow(worksheet, headerRowIdx);

    currentRow += 1;
    const dataStartRowIdx = currentRow;

    if (dataRows.length > 0) {
      XLSX.utils.sheet_add_aoa(worksheet, dataRows, { origin: { r: dataStartRowIdx, c: 0 } });
      styleDataRows(worksheet, filteredData, dataStartRowIdx);
      applyDateFormulas(worksheet, filteredData, dataStartRowIdx);
      currentRow += dataRows.length;
    } else if (includeTitle && headers.length > 0) {
      const noteAddress = XLSX.utils.encode_cell({ r: dataStartRowIdx, c: 0 });
      worksheet[noteAddress] = {
        t: 's',
        v: 'No employees',
        s: { font: { italic: true, color: { rgb: '555555' } } },
      };
      currentRow += 1;
    }

    worksheet['!freeze'] = { xSplit: 1, ySplit: includeTitle ? 2 : 1 };
    applyColumnWidths(worksheet, filteredData);

    return worksheet;
  };

  type GroupDefinition = { key: string; title: string; rows: any[]; note?: string };

  const buildMergedWorksheet = (groups: GroupDefinition[]) => {
    const worksheet = XLSX.utils.aoa_to_sheet([]);
    const headerRowIdx = 0;
    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: { r: headerRowIdx, c: 0 } });
    styleHeaderRow(worksheet, headerRowIdx);

    let nextRow = headerRowIdx + 1;
    const allFilteredData: Record<string, any>[] = [];

    groups.forEach((group) => {
      const rowsUsed = addMergedTitleRow(worksheet, nextRow, group.title, group.note);
      nextRow += rowsUsed;

      const { filteredData, dataRows } = createDisplayRows(group.rows);
      allFilteredData.push(...filteredData);

      if (dataRows.length > 0) {
        XLSX.utils.sheet_add_aoa(worksheet, dataRows, { origin: { r: nextRow, c: 0 } });
        styleDataRows(worksheet, filteredData, nextRow);
        applyDateFormulas(worksheet, filteredData, nextRow);
        nextRow += dataRows.length;
      } else {
        const noteAddress = XLSX.utils.encode_cell({ r: nextRow, c: 0 });
        worksheet[noteAddress] = {
          t: 's',
          v: 'No employees',
          s: { font: { italic: true, color: { rgb: '555555' } } },
        };
        nextRow += 1;
      }
    });

    worksheet['!freeze'] = { xSplit: 1, ySplit: 1 };
    applyColumnWidths(worksheet, allFilteredData);

    return worksheet;
  };

  const normalizedSelection = Array.from(new Set((officesSelection ?? []).map((id) => String(id)).filter(Boolean)));
  const selectionSet = new Set(normalizedSelection);
  const selectionCount = normalizedSelection.length;

  const workbook = XLSX.utils.book_new();
  const takenSheetNames = new Set<string>();
  const resolvedSheetMode = sheetMode === 'merged' ? 'merged' : 'perOffice';
  const resolvedGroupMode: GroupMode = filterGroupMode === 'bioIndex' ? 'bioIndex' : 'office';

  const getBioKeyForOffice = (officeId: string) => {
    const meta = officeMetadata[officeId];
    const code = normalizeBioIndex(meta?.bioIndexCode);
    return code || BIO_INDEX_GROUP_KEY;
  };

  const dedupeKeys = (keys: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    keys.forEach((key) => {
      const normalizedKey = resolvedGroupMode === 'bioIndex' ? (key || BIO_INDEX_GROUP_KEY) : key;
      if (!seen.has(normalizedKey)) {
        seen.add(normalizedKey);
        out.push(normalizedKey);
      }
    });
    return out;
  };

  const resolveOfficeTitle = (officeId: string, fallbackLabel: string = 'Office') => {
    const meta = officeMetadata[officeId];
    return meta?.name || officeMapping[officeId] || officeId || fallbackLabel;
  };

  const resolveGroupMetadata = (groupKey: string, rows: any[]) => {
    if (resolvedGroupMode === 'bioIndex') {
      const normalizedKey = groupKey === BIO_INDEX_GROUP_KEY ? '' : groupKey;
      const title = normalizedKey ? `BIO ${normalizedKey}` : 'BIO (Unassigned)';
      const names = collectOfficeNamesForGroup(groupKey, rows);
      const note = names.length ? `Offices: ${names.join(', ')}` : undefined;
      const sheetNameBase = sanitizeSheetName(title);
      return { title, note, sheetNameBase };
    }
    const title = resolveOfficeTitle(groupKey, selectionCount === 0 ? 'All Offices' : 'Office');
    const meta = officeMetadata[groupKey];
    const sheetNameBase = sanitizeSheetName(meta?.bioIndexCode || title || 'Sheet');
    return { title, note: undefined, sheetNameBase };
  };

  const collectOfficeNamesForGroup = (groupKey: string, rows: any[]) => {
    if (resolvedGroupMode !== 'bioIndex') return [] as string[];
    const normalizedKey = groupKey === BIO_INDEX_GROUP_KEY ? '' : groupKey;
    const names = new Set<string>();
    rows.forEach((row) => {
      if (row?.office) names.add(String(row.office));
    });
    Object.entries(officeMetadata).forEach(([id, meta]) => {
      const code = normalizeBioIndex(meta.bioIndexCode);
      if (code === normalizedKey && (selectionCount === 0 || selectionSet.has(id))) {
        names.add(meta?.name || officeMapping[id] || id);
      }
    });
    return Array.from(names);
  };

  if (resolvedSheetMode === 'merged') {
    const rowsToInclude = selectionCount === 0
      ? filteredEmployees
      : filteredEmployees.filter((emp: any) => selectionSet.has(emp.__officeId));

    const sortedMergedRows = sortRows(rowsToInclude, effectiveSortLevels);
    const partitioned = partitionRows(sortedMergedRows, resolvedGroupMode);

    const groupOrder = (() => {
      if (resolvedGroupMode === 'office') {
        if (selectionCount === 0) {
          const keys = sortedMergedRows.map((row: any) => row.__officeId || '');
          const unique = dedupeKeys(keys);
          return unique.length ? unique : [''];
        }
        return dedupeKeys(normalizedSelection);
      }
      if (selectionCount === 0) {
        const keys = sortedMergedRows.map((row: any) => groupKeyOf(row, resolvedGroupMode));
        const unique = dedupeKeys(keys);
        return unique.length ? unique : [BIO_INDEX_GROUP_KEY];
      }
      const keys = normalizedSelection.map((officeId) => getBioKeyForOffice(officeId));
      const unique = dedupeKeys(keys);
      return unique.length ? unique : [BIO_INDEX_GROUP_KEY];
    })();

    const flattened = groupOrder.flatMap((groupKey) => partitioned[groupKey] ?? []);
    const numberedFlattened = includeRowNumber ? addNumbersMerged(flattened, resolvedGroupMode) : flattened;
    const partitionedNumbered = partitionRows(numberedFlattened, resolvedGroupMode);

    const groups: GroupDefinition[] = groupOrder.map((groupKey) => {
      const numberedRows = partitionedNumbered[groupKey] ?? [];
      const originalRows = partitioned[groupKey] ?? [];
      const { title, note } = resolveGroupMetadata(groupKey, originalRows);
      return { key: groupKey, title, rows: numberedRows, note };
    });

    const worksheet = buildMergedWorksheet(groups);
    const mergedSheetLabel = resolvedGroupMode === 'bioIndex' ? 'Merged Bio Index' : 'Merged Offices';
    const sheetName = uniqueSheetName(sanitizeSheetName(mergedSheetLabel), takenSheetNames);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  } else {
    if (selectionCount === 0 && resolvedGroupMode === 'office') {
      const worksheet = buildWorksheet(filteredEmployees, { includeTitle: false });
      const sheetName = uniqueSheetName(sanitizeSheetName('Sheet1'), takenSheetNames);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    } else {
      const baseRows = selectionCount === 0
        ? filteredEmployees
        : filteredEmployees.filter((emp: any) => selectionSet.has(emp.__officeId));
      const partitioned = partitionRows(baseRows, resolvedGroupMode);

      const groupOrder = (() => {
        if (resolvedGroupMode === 'office') {
          const keys = normalizedSelection.length
            ? normalizedSelection
            : baseRows.map((row: any) => row.__officeId || '');
          const unique = dedupeKeys(keys);
          return unique.length ? unique : [''];
        }
        if (selectionCount === 0) {
          const keys = baseRows.map((row: any) => groupKeyOf(row, resolvedGroupMode));
          const unique = dedupeKeys(keys);
          return unique.length ? unique : [BIO_INDEX_GROUP_KEY];
        }
        const keys = normalizedSelection.map((officeId) => getBioKeyForOffice(officeId));
        const unique = dedupeKeys(keys);
        return unique.length ? unique : [BIO_INDEX_GROUP_KEY];
      })();

      groupOrder.forEach((groupKey) => {
        const rows = partitioned[groupKey] ?? [];
        const sortedRows = sortRows(rows, effectiveSortLevels);
        const numberedRows = includeRowNumber
          ? sortedRows.map((row, idx) => ({ row, __rowNumber: idx + 1 }))
          : sortedRows;
        const { title, note, sheetNameBase } = resolveGroupMetadata(groupKey, rows);
        const worksheet = buildWorksheet(numberedRows, { includeTitle: true, title, subtitle: note });
        const sheetName = uniqueSheetName(sheetNameBase, takenSheetNames);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });
    }
  }

  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    bookSST: true,
    cellStyles: true,
    compression: true,
  });
  return new Blob([excelBuffer], { type: 'application/octet-stream' });
}

export function sanitizeSheetName(name: string) {
  const cleaned = name.replace(/[\\/*?:[\]]/g, '').slice(0, 31).trim();
  return cleaned || 'Sheet';
}

export function uniqueSheetName(base: string, taken: Set<string>) {
  let name = base;
  let i = 2;
  while (taken.has(name)) name = `${base}-${i++}`;
  taken.add(name);
  return name;
}

function normalizeBioIndex(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function groupKeyOf(row: any, mode: GroupMode): string {
  if (mode === 'bioIndex') {
    const raw = normalizeBioIndex(
      row?.__bioIndexCode
        ?? row?.bioIndexCode
        ?? row?.offices?.bioIndexCode
        ?? row?.office?.bioIndexCode
    );
    return raw || BIO_INDEX_GROUP_KEY;
  }
  const id = row?.__officeId
    ?? row?.officeId
    ?? row?.offices?.id
    ?? row?.office?.id
    ?? '';
  return id ? String(id) : '';
}

export function partitionRows<T>(rows: T[], mode: GroupMode) {
  return rows.reduce<Record<string, T[]>>((acc, row: any) => {
    const key = groupKeyOf(row, mode);
    (acc[key] ||= []).push(row);
    return acc;
  }, {});
}

export function addNumbersMerged(rows: any[], mode: GroupMode) {
  let currentKey: string | null = null;
  let counter = 0;
  return rows.map((row) => {
    const key = groupKeyOf(row, mode);
    if (key !== currentKey) {
      currentKey = key;
      counter = 1;
    } else {
      counter += 1;
    }
    return { ...row, __rowNumber: counter };
  });
}

export function partitionByOffice<T extends { officeId: string }>(rows: T[]) {
  return rows.reduce<Record<string, T[]>>((acc, r) => {
    (acc[r.officeId] ||= []).push(r);
    return acc;
  }, {});
}

// Map a column key to a comparable value (string/number/date); fallback to ""
export function getComparable(row: any, field: string) {
  const def = SORT_FIELDS.find((f) => f.key === field);
  const v = def?.accessor ? def.accessor(row) : row?.[field];
  if (v == null) return '';
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  const t = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? Date.parse(v) : NaN;
  if (!Number.isNaN(t)) return t;
  return String(v).toLowerCase();
}

// Stable multi-level sort (levels in priority order)
export function sortRows<T>(rows: T[], levels: { field: string; dir: 'asc' | 'desc' }[]) {
  if (!levels?.length) return rows;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      for (const { field, dir } of levels) {
        const A = getComparable(a.r as any, field);
        const B = getComparable(b.r as any, field);
        if (A < B) return dir === 'asc' ? -1 : 1;
        if (A > B) return dir === 'asc' ? 1 : -1;
      }
      return a.i - b.i;
    })
    .map((x) => x.r);
}

// Persist last active tab
export function setActiveExportTab(key: string) {
  try {
    localStorage.setItem('export.activeTab', key);
  } catch {
    /* ignore */
  }
}

export function getActiveExportTab(): string | null {
  try {
    return localStorage.getItem('export.activeTab');
  } catch {
    return null;
  }
}

// Numbering for merged mode: returns an iterator over [officeId, localIndex]