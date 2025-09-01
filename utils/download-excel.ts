// utils/downloadExcel.ts
import * as XLSX from 'xlsx-js-style';
import { officeMapping, eligibilityMapping, appointmentMapping } from '@/utils/employee-mappings';
import { toUTCDateOnly, columnLetterFromHeader } from '@/utils/date';

type Column = { name: string; key: string };

type DownloadExcelParams = {
  selectedKeys: string[];
  columnOrder: Column[];
  statusFilter: 'all' | 'active' | 'retired';
};

export async function generateExcelFile({
  selectedKeys,
  columnOrder,
  statusFilter,
}: DownloadExcelParams): Promise<Blob> {
  const hiddenFields = [
    'departmentId', 'id', 'isFeatured', 'isAwardee',
    'createdAt', 'updatedAt', 'employeeLink', 'prefix', 'region'
  ];

  // 1) Fetch raw data
  const response = await fetch('/api/backup-employee?' + new Date().getTime(), { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch employee data');

  const data = await response.json();
  if (!data?.employees || data.employees.length === 0) {
    throw new Error('No employee data found.');
  }

  // 2) Normalize/mapping (convert date fields to true UTC "date-only")
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

    // IMPORTANT: keep as Date objects (not strings)
    if (row.birthday) {
      row.birthday = toUTCDateOnly(row.birthday);
    }
    if (row.dateHired) {
      row.dateHired = toUTCDateOnly(row.dateHired);
    }
    // Your Prisma model has terminateDate as String; if you're exporting it, coerce to Date
    if (row.terminateDate) {
      row.terminateDate = toUTCDateOnly(row.terminateDate);
    }
    return row;
  });

  // 3) Apply status filters
  let filteredEmployees = updatedData;
  if (statusFilter === 'active') {
    filteredEmployees = updatedData.filter((emp: any) => emp.isArchived === false);
  } else if (statusFilter === 'retired') {
    filteredEmployees = updatedData.filter((emp: any) => emp.isArchived === true);
  }

  // 4) Visible columns (respect selection and order)
  const visibleColumns = columnOrder.filter(
    col => !hiddenFields.includes(col.key) && selectedKeys.includes(col.key)
  );
  const headers = visibleColumns.map(col => col.name);

  // 5) Build row objects keyed by header display names
  const filteredData = filteredEmployees.map((row: any) => {
    const newRow: Record<string, any> = {};
    visibleColumns.forEach((col) => {
      newRow[col.name] = row[col.key];
    });
    return newRow;
  });

  // 6) Sorting (preserves your existing logic)
  const sortedData = filteredData.sort((a: any, b: any) => {
    if (a['Office'] < b['Office']) return -1;
    if (a['Office'] > b['Office']) return 1;
    if (a['Last Name'] < b['Last Name']) return -1;
    if (a['Last Name'] > b['Last Name']) return 1;
    return 0;
  });

  // 7) Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(sortedData, { header: headers, skipHeader: false });
  worksheet['!freeze'] = { xSplit: 1, ySplit: 1 };

  // 8) True date cells: mark date columns (adjust header names to your UI labels)
  const DATE_HEADERS = new Set(['Birthday', 'Date Hired', 'Terminate Date']);

  const range = XLSX.utils.decode_range(worksheet['!ref'] as string);
  for (let C = 0; C < headers.length; C++) {
    if (!DATE_HEADERS.has(headers[C])) continue;
    for (let R = 1; R <= filteredData.length; R++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[addr];
      if (!cell || cell.v == null || cell.v === "") continue;

      // Coerce to Date if needed
      if (!(cell.v instanceof Date)) {
        const coerced = toUTCDateOnly(cell.v);
        if (coerced !== "") cell.v = coerced;
      }

      worksheet[addr] = {
        ...cell,
        t: 'd',             // Excel DATE type
        z: 'mm/dd/yyyy',    // Display format (change if needed)
      };
    }
  }

  // 9) Header styling
  headers.forEach((header, colIdx) => {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!worksheet[cellAddress]) return;
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

  // 10) Row styling + retired highlight (unchanged)
  filteredData.forEach((row: any, rowIndex: number) => {
    const isRetired =
      row['Retired'] === true || String(row['Retired']).toLowerCase() === 'true';
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
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = { ...(worksheet[cellAddress].s || {}), ...baseStyle };
      }
    });
  });

  // 11) Dynamic formulas (no hard-coded letters)
  // Make sure these headers exist in your `visibleColumns` selection
  const hasAge = headers.includes('Age');
  const hasServiceYears = headers.includes('Service Years');

  const BIRTHDAY_COL = headers.includes('Birthday') ? columnLetterFromHeader(headers, 'Birthday') : null;
  const HIRED_COL    = headers.includes('Date Hired') ? columnLetterFromHeader(headers, 'Date Hired') : null;
  const TERM_COL     = headers.includes('Terminate Date') ? columnLetterFromHeader(headers, 'Terminate Date') : null;
  const AGE_COL      = hasAge ? columnLetterFromHeader(headers, 'Age') : null;
  const SERVICE_COL  = hasServiceYears ? columnLetterFromHeader(headers, 'Service Years') : null;

  for (let i = 0; i < filteredData.length; i++) {
    const rowNumber = i + 2;

    if (AGE_COL && BIRTHDAY_COL) {
      const birthdateCell = `${BIRTHDAY_COL}${rowNumber}`;
      const ageCell       = `${AGE_COL}${rowNumber}`;
      const termCellExpr  = TERM_COL ? `${TERM_COL}${rowNumber}` : '""';

      worksheet[ageCell] = {
        t: 'n',
        f: `IF(${birthdateCell}="", "", DATEDIF(${birthdateCell}, IF(${TERM_COL ? termCellExpr : 'FALSE'}, ${TERM_COL ? termCellExpr : 'TODAY()'}, TODAY()), "Y"))`,
        s: worksheet[ageCell]?.s || {},
      };
    }

    if (SERVICE_COL && HIRED_COL) {
      const hiredDateCell = `${HIRED_COL}${rowNumber}`;
      const serviceCell   = `${SERVICE_COL}${rowNumber}`;
      const termCellExpr  = TERM_COL ? `${TERM_COL}${rowNumber}` : '""';

      worksheet[serviceCell] = {
        t: 'n',
        f: `IF(${hiredDateCell}="", "", DATEDIF(${hiredDateCell}, IF(${TERM_COL ? termCellExpr : 'FALSE'}, ${TERM_COL ? termCellExpr : 'TODAY()'}, TODAY()), "Y"))`,
        s: worksheet[serviceCell]?.s || {},
      };
    }
  }

  // 12) Column widths (simple autosize)
  const columnWidths = headers.map((header) => {
    let maxLength = header.length;
    filteredData.forEach((row: any) => {
      const val = row[header];
      const asText =
        val instanceof Date
          ? XLSX.SSF.format('mm/dd/yyyy', val) // for dates, approximate display length
          : (val ?? '').toString();
      if (asText.length > maxLength) maxLength = asText.length;
    });
    return { wch: Math.min(Math.max(maxLength + 1, 10), 60) }; // clamp widths
  });
  worksheet['!cols'] = columnWidths;

  // 13) Build workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/octet-stream' });
}
