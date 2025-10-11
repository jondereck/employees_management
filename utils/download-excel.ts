import * as XLSX from 'xlsx-js-style';
import { format as formatDate } from 'date-fns';

import { EmployeeWithRelations } from '@/lib/types';
 

export type Column = { name: string; key: string };

export type IdColumnSource = 'uuid' | 'bio' | 'employeeNo';


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
   sortBy?: 'updatedAt' | 'createdAt';
  sortDir?: 'asc' | 'desc';
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
  sortDir
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
    // --- map IDs to labels ---

    if (row.officeId && officeMapping[row.officeId]) {
      row.officeId = officeMapping[row.officeId];
    }
    if (row.eligibilityId && eligibilityMapping[row.eligibilityId]) {
      row.eligibilityId = eligibilityMapping[row.eligibilityId];
    }
    if (row.employeeTypeId && appointmentMapping[row.employeeTypeId]) {
      row.employeeTypeId = appointmentMapping[row.employeeTypeId];
    }

    row.appointment = row.employeeTypeId; // label string after mapping
    row.eligibility = row.eligibilityId;  // label string after mapping
    row.status = row.isArchived ? "Retired" : "Active";
    row.comma = (hasText(row.barangay) && hasText(row.city)) ? "," : "";


    // --- Plantilla: designation name or fallback to office name ---
    if (row.designationId && officeMapping[row.designationId]) {
      row.plantilla = officeMapping[row.designationId];
    } else {
      row.plantilla = row.officeId || '';
    }

    // --- Dates ---
    if (row.birthday) {
      row.birthday = new Date(row.birthday).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    if (row.dateHired) {
      row.dateHired = new Date(row.dateHired).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }

    // --- Middle initial ---
    if (row.middleName) {
      const trimmed = row.middleName.trim();
      row.middleName = trimmed.length > 0 ? `${trimmed[0].toUpperCase()}.` : '';
    }

    // --- Position rules ---
    if (row.position) {
      row.position = applyPositionRules(String(row.position), positionReplaceRules);
    }

    // --- IDs cleanup ---
    row.gsisNo = (row.gsisNo?.toString().trim()) || "N/A";
    row.tinNo = (row.tinNo?.toString().trim()) || "N/A";
    row.philHealthNo = (row.philHealthNo?.toString().trim()) || "N/A";
    row.pagIbigNo = (row.pagIbigNo?.toString().trim()) || "N/A";

    // --- Nickname fallback ---
    if (!row.nickname || row.nickname.toString().trim() === "") {
      const first = (row.firstName ?? "").toString().trim();
      row.nickname = first.split(/\s+/)[0] || "";
    }

    // --- Image/QR paths ---
    const imgExt = (imageExt || 'png').replace(/^\./, '').toLowerCase();
    const qrcodeExt = (qrExt || 'png').replace(/^\./, '').toLowerCase();
    const employeeNoSafe = String(row.employeeNo ?? '').split(',')[0].trim();
    row.imagePath = `${safeImageDir}\\${employeeNoSafe}.${imgExt}`;
    row.qrPath = `${safeQrDir}\\${qrPrefix}${employeeNoSafe}.${qrcodeExt}`;

    // --- Salary export (auto vs manual) ---
    const source = decideSalarySource(row, salaryModeField);
    let salaryExport = Number(row.salary) || 0;

    // Prefer table passed in; else use the API-built stepsByGrade map
    const autoFromParam = lookupAutoSalary(Number(row.salaryGrade), Number(row.salaryStep), salaryTable);
    const autoFromApiMap = lookupAutoSalaryFromMap(Number(row.salaryGrade), Number(row.salaryStep));

    if (source === 'auto') {
      const auto = (typeof autoFromParam === 'number' ? autoFromParam : autoFromApiMap);
      if (typeof auto === 'number' && Number.isFinite(auto)) {
        salaryExport = auto;
      }
    }

    // If you want the existing "Salary" column to reflect this, overwrite:
    // row.salary = salaryExport;
    // Or keep it separate (and add 'salaryExport' column in your modal):
    row.salaryExport = salaryExport;
    row.salarySourceExport = source;
    if (row.yearsOfService === undefined) row.yearsOfService = "";
    // --- Normalize text for NFC (ñ fix) ---
    row = normalizeRowStringsNFC(row);
    return row;
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
  const visibleColumns = columnOrder
    .filter(col => !hiddenFields.includes(col.key) && selectedKeys.includes(col.key))
    .map(col => {
      if (col.key !== 'employeeNo') return col;

      const name =
        idColumnSource === 'uuid' ? 'Employee UUID'
          : idColumnSource === 'bio' ? 'Bio Number'
            : 'Employee No'; // the code like X-1

      return { ...col, name };
    });


  const headers = visibleColumns.map(col => col.name);

  const sortField = sortBy ?? 'updatedAt';
const dir = sortDir ?? 'desc';

const sortedEmployees = [...filteredEmployees].sort((a: any, b: any) => {
  const aTs = ts(a[sortField]) || ts(a.createdAt);
  const bTs = ts(b[sortField]) || ts(b.createdAt);
  return dir === 'desc' ? bTs - aTs : aTs - bTs;
});

const filteredData = sortedEmployees.map((row: any) => {
  const newRow: Record<string, any> = {};
  // Parse once
  const raw = String(row.employeeNo ?? '').trim();
  const [bioPartRaw, codePartRaw] = raw.split(',');
  const bioPart = (bioPartRaw ?? '').trim();
  const codePart = (codePartRaw ?? '').trim();

  visibleColumns.forEach((col) => {
    let val = row[col.key];
    if (col.key === 'employeeNo') {
      if (idColumnSource === 'uuid') {
        val = row.id ?? '';
      } else if (idColumnSource === 'bio') {
        val = bioPart || codePart || row.id || '';
      } else {
        val = codePart || bioPart || row.id || '';
      }
    }
    newRow[col.name] = val;
  });

  return newRow;
});

  // const sortedData = filteredData.sort((a: any, b: any) => {
  //   if (a['Office'] < b['Office']) return -1;
  //   if (a['Office'] > b['Office']) return 1;
  //   if (a['Plantilla'] < b['Plantilla']) return -1;  // <- NEW second key
  //   if (a['Plantilla'] > b['Plantilla']) return 1;
  //   if (a['Last Name'] < b['Last Name']) return -1;
  //   if (a['Last Name'] > b['Last Name']) return 1;
  //   return 0;
  // });

const worksheet = XLSX.utils.json_to_sheet(filteredData, { header: headers, skipHeader: false });

  worksheet['!freeze'] = { xSplit: 1, ySplit: 1 };

  headers.forEach((header, colIdx) => {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    worksheet[cellAddress].s = {
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
  });

  filteredData.forEach((row: any, rowIndex: number) => {
    const isRetired = row['Retired'] === true || String(row['Retired']).toLowerCase() === 'true';
    headers.forEach((header, colIndex) => {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
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
      if (isRetired) {
        baseStyle.fill = { fgColor: { rgb: 'FFCCCC' } };
        baseStyle.font = { sz: 11, color: { rgb: '990000' }, bold: true };
      }
      if (worksheet[cellAddress]) worksheet[cellAddress].s = baseStyle;
    });
  });

// Helper to build A1 address from (rowNumber: 1-based, colIndex: 0-based)
const addr = (rowNumber: number, colIndex: number) =>
  XLSX.utils.encode_cell({ r: rowNumber - 1, c: colIndex });

// Resolve current column indexes from the runtime headers array
const idxBirthday       = headers.indexOf("Birthday");
const idxAge            = headers.indexOf("Age");
const idxDateHired      = headers.indexOf("Date Hired");
const idxYearsOfService = headers.indexOf("Year(s) of Service");
const idxTerminateDate  = headers.indexOf("Terminate Date");

// Write formulas only if the needed columns are actually present/selected
for (let i = 0; i < filteredData.length; i++) {
  const rowNumber = i + 2; // header row = 1, data starts at 2

  const birthdateCell =
    idxBirthday >= 0 ? addr(rowNumber, idxBirthday) : undefined;
  const ageCell =
    idxAge >= 0 ? addr(rowNumber, idxAge) : undefined;
  const hiredDateCell =
    idxDateHired >= 0 ? addr(rowNumber, idxDateHired) : undefined;
  const serviceCell =
    idxYearsOfService >= 0 ? addr(rowNumber, idxYearsOfService) : undefined;
  const terminateDateCell =
    idxTerminateDate >= 0 ? addr(rowNumber, idxTerminateDate) : undefined;

  // AGE = DATEDIF(Birthday, Today/Terminate, "Y")
  if (ageCell && birthdateCell) {
    const startRef = `IF(${birthdateCell}="","",DATEVALUE(${birthdateCell}))`;
    const endRef = terminateDateCell
      ? `IF(${terminateDateCell}="",TODAY(),DATEVALUE(${terminateDateCell}))`
      : `TODAY()`;

    worksheet[ageCell] = {
      t: "n",
      f: `IF(${birthdateCell}="","",DATEDIF(${startRef},${endRef},"Y"))`,
      s: worksheet[ageCell]?.s || {},
    };
  }

  // YEARS OF SERVICE = DATEDIF(Date Hired, Today/Terminate, "Y")
  if (serviceCell && hiredDateCell) {
    const startRef = `IF(${hiredDateCell}="","",DATEVALUE(${hiredDateCell}))`;
    const endRef = terminateDateCell
      ? `IF(${terminateDateCell}="",TODAY(),DATEVALUE(${terminateDateCell}))`
      : `TODAY()`;

    worksheet[serviceCell] = {
      t: "n",
      f: `IF(${hiredDateCell}="","",DATEDIF(${startRef},${endRef},"Y"))`,
      s: worksheet[serviceCell]?.s || {},
    };
  }
}


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

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    bookSST: true,          // <- shared strings table
    cellStyles: true,
    compression: true,
  });
  return new Blob([excelBuffer], { type: 'application/octet-stream' });
}

export type WorkbookColumn = {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'date';
  getValue: (employee: EmployeeWithRelations) => unknown;
};

export type EmployeesByOffice = {
  officeId: string;
  officeName: string;
  officeShortCode?: string | null;
  employees: EmployeeWithRelations[];
};

export type ExportOfficeOption = {
  id: string;
  name: string;
  bioIndexCode?: string | null;
  shortName?: string | null;
};

export type StylingOptions = {
  titleFontSize?: number;
  titleFill?: string;
  headerFill?: string;
  borderColor?: string;
  stripeFill?: string;
};

export type BuildWorkbookOptions = {
  employeesByOffice: EmployeesByOffice[];
  columns: WorkbookColumn[];
  stylingOptions?: StylingOptions;
  mode?: 'perOffice' | 'singleSheet';
  combinedSheetTitle?: string;
};

const DEFAULT_STYLING: Required<StylingOptions> = {
  titleFontSize: 18,
  titleFill: 'F2F4F7',
  headerFill: 'F8F9FC',
  borderColor: 'D0D5DD',
  stripeFill: 'F9FAFB',
};

export function sanitizeSheetName(name: string): string {
  const invalid = /[\[\]:*?/\\]/g;
  const cleaned = String(name ?? '')
    .replace(invalid, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const fallback = cleaned.length > 0 ? cleaned : 'Sheet';
  return fallback.length > 31 ? fallback.slice(0, 31) : fallback;
}

function ensureUniqueSheetName(
  baseName: string,
  usedNames: Set<string>,
  baseCounts: Map<string, number>,
): string {
  let candidate = sanitizeSheetName(baseName);
  if (!candidate) candidate = 'Sheet';
  if (candidate.length > 31) candidate = candidate.slice(0, 31);

  if (!usedNames.has(candidate)) {
    usedNames.add(candidate);
    baseCounts.set(candidate, 1);
    return candidate;
  }

  const base = candidate;
  let counter = (baseCounts.get(base) ?? 1) + 1;
  while (true) {
    const suffix = `-${counter}`;
    const trimmedBase = base.slice(0, Math.max(0, 31 - suffix.length)).trim();
    let next = trimmedBase ? `${trimmedBase}${suffix}` : `Sheet${suffix}`;
    next = sanitizeSheetName(next);
    if (next.length > 31) {
      next = next.slice(0, 31);
    }
    if (!usedNames.has(next)) {
      usedNames.add(next);
      baseCounts.set(base, counter);
      return next || `Sheet-${counter}`;
    }
    counter += 1;
  }
}

function normalizeDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function normalizeNumberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const sanitized = value.replace(/[^0-9.-]/g, '');
    if (!sanitized) return null;
    const num = Number(sanitized);
    return Number.isNaN(num) ? null : num;
  }
  return null;
}

function normalizeCellValue(
  value: unknown,
  type?: 'string' | 'number' | 'date',
): { value: any; cellType: XLSX.CellObject['t']; widthValue: string; numberFormat?: string } {
  if (type === 'date') {
    const date = normalizeDateValue(value);
    if (date) {
      return {
        value: date,
        cellType: 'd',
        widthValue: formatDate(date, 'yyyy-MM-dd'),
        numberFormat: 'mm/dd/yyyy',
      };
    }
  }

  if (type === 'number') {
    const num = normalizeNumberValue(value);
    if (num != null) {
      const isInteger = Number.isInteger(num);
      return {
        value: num,
        cellType: 'n',
        widthValue: num.toLocaleString(undefined, {
          minimumFractionDigits: isInteger ? 0 : 2,
          maximumFractionDigits: isInteger ? 0 : 2,
        }),
        numberFormat: isInteger ? '#,##0' : '#,##0.00',
      };
    }
  }

  const stringValue = value == null ? '' : String(value);
  return {
    value: stringValue,
    cellType: 's',
    widthValue: stringValue,
  };
}

type WorksheetOptions = {
  officeName: string;
  employees: EmployeeWithRelations[];
  columns: WorkbookColumn[];
  styling: Required<StylingOptions>;
};

function createWorksheet({ officeName, employees, columns, styling }: WorksheetOptions): XLSX.WorkSheet {
  const worksheet: XLSX.WorkSheet = {};
  const merges: XLSX.Range[] = [];
  const columnCount = columns.length;
  const borderStyle = { style: 'thin', color: { rgb: styling.borderColor } } as const;

  const columnWidths = columns.map((column) => Math.max(column.label.length + 2, 14));

  const titleCellRef = XLSX.utils.encode_cell({ r: 0, c: 0 });
  worksheet[titleCellRef] = {
    v: officeName,
    t: 's',
    s: {
      font: { bold: true, sz: styling.titleFontSize },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { patternType: 'solid', fgColor: { rgb: styling.titleFill } },
    },
  };
  if (columnCount > 0) {
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } });
  }

  columns.forEach((column, index) => {
    const headerRef = XLSX.utils.encode_cell({ r: 1, c: index });
    worksheet[headerRef] = {
      v: column.label,
      t: 's',
      s: {
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: { patternType: 'solid', fgColor: { rgb: styling.headerFill } },
        border: {
          top: borderStyle,
          right: borderStyle,
          bottom: borderStyle,
          left: borderStyle,
        },
      },
    };
  });

  if (employees.length === 0) {
    const noteRef = XLSX.utils.encode_cell({ r: 2, c: 0 });
    worksheet[noteRef] = {
      v: 'No employees',
      t: 's',
      s: {
        font: { italic: true, color: { rgb: '6B7280' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      },
    };
  } else {
    employees.forEach((employee, rowIndex) => {
      columns.forEach((column, columnIndex) => {
        const { value, cellType, widthValue, numberFormat } = normalizeCellValue(
          column.getValue(employee),
          column.type,
        );

        const cellRef = XLSX.utils.encode_cell({ r: 2 + rowIndex, c: columnIndex });
        const alignment =
          cellType === 'n'
            ? { horizontal: 'right', vertical: 'center' }
            : cellType === 'd'
              ? { horizontal: 'center', vertical: 'center' }
              : { horizontal: 'left', vertical: 'center', wrapText: true };

        const cell: XLSX.CellObject = {
          v: value,
          t: cellType,
          s: {
            font: { sz: 11 },
            alignment,
            border: {
              top: borderStyle,
              right: borderStyle,
              bottom: borderStyle,
              left: borderStyle,
            },
          },
        };

        if (numberFormat && (cellType === 'n' || cellType === 'd')) {
          cell.z = numberFormat;
        }

        if (rowIndex % 2 === 1) {
          cell.s = {
            ...cell.s,
            fill: { patternType: 'solid', fgColor: { rgb: styling.stripeFill } },
          };
        }

        worksheet[cellRef] = cell;
        const widthLength = Math.min(Math.max(widthValue.length + 2, 12), 60);
        columnWidths[columnIndex] = Math.max(columnWidths[columnIndex], widthLength);
      });
    });
  }

  if (merges.length) {
    worksheet['!merges'] = merges;
  }

  worksheet['!cols'] = columnWidths.map((wch) => ({ wch }));
  worksheet['!rows'] = [
    { hpt: 28 },
    { hpt: 20 },
  ];

  return worksheet;
}

export function buildWorkbook({
  employeesByOffice,
  columns,
  stylingOptions,
  mode = 'perOffice',
  combinedSheetTitle = 'All Offices',
}: BuildWorkbookOptions): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  if (columns.length === 0) {
    return workbook;
  }

  const styling: Required<StylingOptions> = { ...DEFAULT_STYLING, ...stylingOptions } as Required<StylingOptions>;
  const usedNames = new Set<string>();
  const baseCounts = new Map<string, number>();

  const sources =
    mode === 'singleSheet'
      ? [
          {
            officeId: 'all',
            officeName: combinedSheetTitle,
            officeShortCode: combinedSheetTitle,
            employees: employeesByOffice.flatMap((group) => group.employees),
          },
        ]
      : employeesByOffice;

  sources.forEach((group) => {
    const sheetName = ensureUniqueSheetName(
      group.officeShortCode ?? group.officeName,
      usedNames,
      baseCounts,
    );
    const worksheet = createWorksheet({
      officeName: group.officeName,
      employees: group.employees,
      columns,
      styling,
    });
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  return workbook;
}

export function writeWorkbookToFile(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename, { compression: true, bookType: 'xlsx' });
}

export function partitionEmployeesByOffice(
  employees: EmployeeWithRelations[],
  offices: ExportOfficeOption[],
  selection: 'all' | string[],
): EmployeesByOffice[] {
  const officesById = new Map<string, ExportOfficeOption>();
  offices.forEach((office) => {
    officesById.set(office.id, office);
  });

  const normalizeSelection = () => {
    if (selection === 'all') {
      return offices.map((office) => office.id);
    }
    const seen = new Set<string>();
    const ids: string[] = [];
    selection.forEach((id) => {
      if (!seen.has(id) && officesById.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    });
    return ids;
  };

  const selectedIds = normalizeSelection();
  const groups = new Map<string, EmployeesByOffice>();

  const ensureGroup = (officeId: string, fallbackName?: string, fallbackCode?: string | null) => {
    let group = groups.get(officeId);
    if (!group) {
      const officeMeta = officesById.get(officeId);
      group = {
        officeId,
        officeName: officeMeta?.name ?? fallbackName ?? 'Office',
        officeShortCode: officeMeta?.bioIndexCode ?? fallbackCode ?? null,
        employees: [],
      };
      groups.set(officeId, group);
    }
    return group;
  };

  const includeEmployee = (employee: EmployeeWithRelations) => {
    const officeId = employee.offices?.id;
    if (!officeId) return;
    if (selection !== 'all' && !selectedIds.includes(officeId)) return;

    const group = ensureGroup(officeId, employee.offices?.name, employee.offices?.bioIndexCode ?? null);
    group.employees.push(employee);
  };

  employees.forEach(includeEmployee);

  const finalIds: string[] = (() => {
    if (selection === 'all') {
      const ids = [...new Set([...offices.map((office) => office.id), ...groups.keys()])];
      return ids;
    }
    return selectedIds;
  })();

  const sortEmployees = (list: EmployeeWithRelations[]) =>
    [...list].sort((a, b) => {
      const lastA = (a.lastName ?? '').toString().toLowerCase();
      const lastB = (b.lastName ?? '').toString().toLowerCase();
      if (lastA !== lastB) return lastA.localeCompare(lastB);
      const firstA = (a.firstName ?? '').toString().toLowerCase();
      const firstB = (b.firstName ?? '').toString().toLowerCase();
      return firstA.localeCompare(firstB);
    });

  const result: EmployeesByOffice[] = finalIds.map((officeId) => {
    const officeMeta = officesById.get(officeId);
    const group = groups.get(officeId);
    return {
      officeId,
      officeName: group?.officeName ?? officeMeta?.name ?? 'Office',
      officeShortCode: group?.officeShortCode ?? officeMeta?.bioIndexCode ?? officeMeta?.shortName ?? null,
      employees: sortEmployees(group?.employees ?? []),
    };
  });

  if (selection === 'all') {
    const extraGroups: EmployeesByOffice[] = [];
    groups.forEach((group, officeId) => {
      if (finalIds.includes(officeId)) return;
      extraGroups.push({
        officeId,
        officeName: group.officeName,
        officeShortCode: group.officeShortCode,
        employees: sortEmployees(group.employees),
      });
    });
    if (extraGroups.length) {
      extraGroups.sort((a, b) => a.officeName.localeCompare(b.officeName));
      result.push(...extraGroups);
    }
  }

  return result;
}
