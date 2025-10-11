import * as XLSX from 'xlsx-js-style';
 

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
  officesSelection?: string[];
  officeMetadata?: Record<string, { name: string; bioIndexCode?: string | null }>;
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
  officeMetadata = {}
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

    // --- map IDs to labels ---
    if (originalOfficeId && officeMapping[originalOfficeId]) {
      copy.officeId = officeMapping[originalOfficeId];
    }
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
      copy.plantilla = copy.officeId || '';
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

  const buildWorksheet = (rows: any[], options: { includeTitle?: boolean; title?: string } = {}) => {
    const sortedRows = [...rows].sort((a: any, b: any) => {
      const aTs = ts(a[sortField]) || ts(a.createdAt);
      const bTs = ts(b[sortField]) || ts(b.createdAt);
      return dir === 'desc' ? bTs - aTs : aTs - bTs;
    });

    const filteredData = sortedRows.map((row: any) => {
      const newRow: Record<string, any> = {};
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

    const dataRows = filteredData.map((row) => headers.map((header) => row[header]));

    const worksheet = XLSX.utils.aoa_to_sheet([]);
    const includeTitle = !!options.includeTitle;
    const headerRowIdx = includeTitle ? 1 : 0; // zero-based
    const dataStartRowIdx = headerRowIdx + 1;
    const headerExcelRow = headerRowIdx + 1;
    const dataExcelStartRow = dataStartRowIdx + 1;

    if (includeTitle) {
      const titleText = options.title ?? '';
      XLSX.utils.sheet_add_aoa(worksheet, [[titleText]], { origin: 'A1' });
      worksheet['!merges'] = worksheet['!merges'] || [];
      worksheet['!merges'].push({
        s: { r: 0, c: 0 },
        e: { r: 0, c: Math.max(headers.length - 1, 0) },
      });
      const titleCell = worksheet['A1'] || { t: 's', v: titleText };
      titleCell.t = 's';
      titleCell.v = titleText;
      titleCell.s = {
        font: { bold: true, sz: 16 },
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: 'DDDDDD' } },
      };
      worksheet['A1'] = titleCell;
    }

    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: { r: headerRowIdx, c: 0 } });

    if (dataRows.length > 0) {
      XLSX.utils.sheet_add_aoa(worksheet, dataRows, { origin: { r: dataStartRowIdx, c: 0 } });
    } else if (includeTitle && headers.length > 0) {
      const noteAddress = XLSX.utils.encode_cell({ r: dataStartRowIdx, c: 0 });
      worksheet[noteAddress] = {
        t: 's',
        v: 'No employees',
        s: { font: { italic: true, color: { rgb: '555555' } } },
      };
    }

    worksheet['!freeze'] = { xSplit: 1, ySplit: includeTitle ? 2 : 1 };

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

    filteredData.forEach((row: any, rowIndex: number) => {
      const isRetired = row['Retired'] === true || String(row['Retired']).toLowerCase() === 'true';
      headers.forEach((header, colIndex) => {
        const cellAddress = XLSX.utils.encode_cell({ r: dataStartRowIdx + rowIndex, c: colIndex });
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

    const addr = (rowNumber: number, colIndex: number) =>
      XLSX.utils.encode_cell({ r: rowNumber - 1, c: colIndex });

    const idxBirthday = headers.indexOf('Birthday');
    const idxAge = headers.indexOf('Age');
    const idxDateHired = headers.indexOf('Date Hired');
    const idxYearsOfService = headers.indexOf('Year(s) of Service');
    const idxTerminateDate = headers.indexOf('Terminate Date');

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
    if (columnWidths.length > 0) {
      worksheet['!cols'] = columnWidths;
    }

    return worksheet;
  };

  const normalizedSelection = Array.from(new Set((officesSelection ?? []).map((id) => String(id)).filter(Boolean)));
  const selectionSet = new Set(normalizedSelection);
  const selectionCount = normalizedSelection.length;

  const workbook = XLSX.utils.book_new();
  const takenSheetNames = new Set<string>();

  if (selectionCount === 0) {
    const worksheet = buildWorksheet(filteredEmployees, { includeTitle: false });
    const sheetName = uniqueSheetName(sanitizeSheetName('Sheet1'), takenSheetNames);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  } else if (selectionCount === 1) {
    const officeId = normalizedSelection[0];
    const rows = filteredEmployees.filter((emp: any) => emp.__officeId === officeId);
    const meta = officeMetadata[officeId];
    const fallbackName = meta?.name || officeMapping[officeId] || officeId || 'Office';
    const sheetName = uniqueSheetName(
      sanitizeSheetName(meta?.bioIndexCode || fallbackName || 'Sheet'),
      takenSheetNames
    );
    const worksheet = buildWorksheet(rows, { includeTitle: true, title: fallbackName });
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  } else {
    const filteredBySelection = filteredEmployees.filter((emp: any) => selectionSet.has(emp.__officeId));
    const partitionInput = filteredBySelection.map((emp: any) => ({ officeId: emp.__officeId, row: emp }));
    const partitioned = partitionByOffice(partitionInput);

    normalizedSelection.forEach((officeId) => {
      const entries = partitioned[officeId] ?? [];
      const rows = entries.map((entry) => entry.row);
      const meta = officeMetadata[officeId];
      const fallbackName = meta?.name || officeMapping[officeId] || officeId || 'Office';
      const sheetName = uniqueSheetName(
        sanitizeSheetName(meta?.bioIndexCode || fallbackName || 'Sheet'),
        takenSheetNames
      );
      const worksheet = buildWorksheet(rows, { includeTitle: true, title: fallbackName });
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });
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

export function partitionByOffice<T extends { officeId: string }>(rows: T[]) {
  return rows.reduce<Record<string, T[]>>((acc, r) => {
    (acc[r.officeId] ||= []).push(r);
    return acc;
  }, {});
}
