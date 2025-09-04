import * as XLSX from 'xlsx-js-style';
import { officeMapping, eligibilityMapping, appointmentMapping } from '@/utils/employee-mappings';

type Column = { name: string; key: string };

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
};

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

export async function generateExcelFile({
  selectedKeys,
  columnOrder,
  statusFilter,
  baseImageDir,
  baseQrDir,
  qrPrefix = 'JDN',
  appointmentFilters,
  mappings,
  positionReplaceRules
}: DownloadExcelParams): Promise<Blob> {

   const { officeMapping, eligibilityMapping, appointmentMapping } = mappings;
  const hiddenFields = [
    'departmentId', 'id', 'isFeatured', 'isAwardee',
    'createdAt', 'updatedAt', 'employeeLink', 'prefix', 'region'
  ];

  const response = await fetch('/api/backup-employee?' + new Date().getTime(), {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Failed to fetch employee data');

  const data = await response.json();
  if (data.length === 0) throw new Error('No employee data found.');

  const safeImageDir = normalizeWindowsDir(baseImageDir);
  const safeQrDir = normalizeWindowsDir(baseQrDir);

  

  const updatedData = data.employees.map((row: any) => {
    if (row.officeId && officeMapping[row.officeId]) {
      row.officeId = officeMapping[row.officeId];
    }
    if (row.eligibilityId && eligibilityMapping[row.eligibilityId]) {
      row.eligibilityId = eligibilityMapping[row.eligibilityId];
    }
    if (row.employeeTypeId && appointmentMapping[row.employeeTypeId]) {
      row.employeeTypeId = appointmentMapping[row.employeeTypeId];
    }
    if (row.birthday) {
      row.birthday = new Date(row.birthday).toLocaleDateString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
    }
    if (row.dateHired) {
      row.dateHired = new Date(row.dateHired).toLocaleDateString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
    }

    if (row.middleName) {
      const trimmed = row.middleName.trim();
      row.middleName = trimmed.length > 0 ? `${trimmed[0].toUpperCase()}.` : '';
    }

        if (row.position) {
      row.position = applyPositionRules(String(row.position), positionReplaceRules);
    }


    row.gsisNo = (row.gsisNo?.toString().trim()) || "N/A";
    row.tinNo = (row.tinNo?.toString().trim()) || "N/A";
    row.philHealthNo = (row.philHealthNo?.toString().trim()) || "N/A";
    row.pagIbigNo = (row.pagIbigNo?.toString().trim()) || "N/A";

    // --- NEW: auto-fill nickname from first word of firstName if missing ---
    if (!row.nickname || row.nickname.toString().trim() === "") {
      const first = (row.firstName ?? "").toString().trim();
      row.nickname = first.split(/\s+/)[0] || "";
    }

    const employeeNoSafe = String(row.employeeNo ?? '').split(',')[0].trim();
    row.imagePath = `${safeImageDir}\\${employeeNoSafe}.png`;
    row.qrPath = `${safeQrDir}\\${qrPrefix}${employeeNoSafe}.png`;
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
  const visibleColumns = columnOrder.filter(
    col => !hiddenFields.includes(col.key) && selectedKeys.includes(col.key)
  );
  const headers = visibleColumns.map(col => col.name);

  const filteredData = filteredEmployees.map((row: any) => {
    const newRow: Record<string, any> = {};
    visibleColumns.forEach((col) => {
      newRow[col.name] = row[col.key];
    });
    return newRow;
  });

  const sortedData = filteredData.sort((a: any, b: any) => {
    if (a['Office'] < b['Office']) return -1;
    if (a['Office'] > b['Office']) return 1;
    if (a['Last Name'] < b['Last Name']) return -1;
    if (a['Last Name'] > b['Last Name']) return 1;
    return 0;
  });

  const worksheet = XLSX.utils.json_to_sheet(sortedData, { header: headers, skipHeader: false });
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

  for (let i = 0; i < filteredData.length; i++) {
    const rowNumber = i + 2;
    const birthdateCell = `N${rowNumber}`;
    const ageCell = `O${rowNumber}`;
    const hiredDateCell = `Q${rowNumber}`;
    const serviceCell = `R${rowNumber}`;
    const terminateDateCell = `AE${rowNumber}`;

    worksheet[ageCell] = {
      t: 'n',
      f: `IF(${birthdateCell}="", "", DATEDIF(${birthdateCell}, IF(${terminateDateCell}="", TODAY(), ${terminateDateCell}), "Y"))`,
      s: worksheet[ageCell]?.s || {},
    };

    worksheet[serviceCell] = {
      t: 'n',
      f: `IF(${hiredDateCell}="", "", DATEDIF(${hiredDateCell}, IF(${terminateDateCell}="", TODAY(), ${terminateDateCell}), "Y"))`,
      s: worksheet[serviceCell]?.s || {},
    };
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
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/octet-stream' });
}
