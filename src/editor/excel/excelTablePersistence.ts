import * as fs from 'fs';
import * as vscode from 'vscode';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

export const MAX_TABLE_ROWS_CAP = 1000;

export interface ExcelTableUpdate {
  rowIndex: number;
  colKey: string;
  value: any;
}

export interface ExcelWriteParams {
  sourcePath: string;
  sheetName: string;
  maxRows?: number;
  tailRows?: number;
  sourceRowIndices?: Array<number | null>;
  updates: ExcelTableUpdate[];
}

function resolveExcelSheetName(workbook: XLSX.WorkBook, requested: string): string | null {
  if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    return null;
  }
  if (!requested) {
    return workbook.SheetNames[0];
  }
  if (workbook.SheetNames.includes(requested)) {
    return requested;
  }
  const normalized = requested.trim().toLowerCase();
  const matched = workbook.SheetNames.find(n => n.toLowerCase() === normalized);
  return matched || null;
}

function resolveTableReadOptions(
  maxRows: number | undefined,
  tailRows: number | undefined,
  totalRows: number
): { start: number; end: number } {
  const normalizedMaxRows = Number.isInteger(maxRows) && (maxRows as number) > 0
    ? Math.min(maxRows as number, MAX_TABLE_ROWS_CAP)
    : totalRows;
  const normalizedTailRows = Number.isInteger(tailRows) && (tailRows as number) > 0
    ? (tailRows as number)
    : undefined;
  const start = normalizedTailRows !== undefined
    ? Math.max(0, totalRows - Math.min(normalizedTailRows, totalRows))
    : 0;
  const end = Math.min(totalRows, start + normalizedMaxRows);
  return { start, end };
}

function readExcelWorkbook(sourcePath: string): XLSX.WorkBook {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(vscode.l10n.t('File not found: {0}', sourcePath));
  }
  try {
    fs.accessSync(sourcePath, fs.constants.R_OK);
    const buffer = fs.readFileSync(sourcePath);
    return XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch (error) {
    throw new Error(
      vscode.l10n.t(
        'Cannot read Excel file "{0}": {1}',
        sourcePath,
        error instanceof Error ? error.message : String(error)
      )
    );
  }
}

function writeExcelWorkbook(workbook: XLSX.WorkBook, sourcePath: string): void {
  try {
    const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(sourcePath, out);
  } catch (error) {
    throw new Error(
      vscode.l10n.t(
        'cannot save file {0}: {1}',
        sourcePath,
        error instanceof Error ? error.message : String(error)
      )
    );
  }
}

function resolveSourceDataRowIndex(
  rowIndex: number,
  start: number,
  visibleCount: number,
  sourceRowIndices?: Array<number | null>
): number {
  if (Array.isArray(sourceRowIndices) && sourceRowIndices.length > 0) {
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= sourceRowIndices.length) {
      throw new Error(vscode.l10n.t('Invalid row index: {0}', rowIndex));
    }
    const mapped = sourceRowIndices[rowIndex];
    if (!Number.isInteger(mapped) || (mapped as number) < 0) {
      throw new Error(vscode.l10n.t('Invalid source row mapping at index: {0}', rowIndex));
    }
    return mapped as number;
  }
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= visibleCount) {
    throw new Error(vscode.l10n.t('Invalid row index: {0}', rowIndex));
  }
  return start + rowIndex;
}

function sanitizeExcelJsConditionalFormats(workbook: ExcelJS.Workbook): void {
  for (const sheet of workbook.worksheets as any[]) {
    const list = sheet.conditionalFormattings;
    if (!Array.isArray(list)) {
      continue;
    }
    const sanitized = [];
    for (const cf of list) {
      if (!cf || !Array.isArray(cf.rules)) {
        continue;
      }
      const rules = cf.rules.filter((rule: any) => {
        if (!rule || typeof rule !== 'object') {
          return false;
        }
        if (rule.type === 'expression') {
          return Array.isArray(rule.formulae) && rule.formulae.length > 0 && rule.formulae[0] !== undefined;
        }
        return true;
      });
      if (rules.length > 0) {
        sanitized.push({ ...cf, rules });
      }
    }
    sheet.conditionalFormattings = sanitized;
  }
}

function applyUpdatesToXlsxWorkbook(workbook: XLSX.WorkBook, params: ExcelWriteParams): void {
  const worksheetName = resolveExcelSheetName(workbook, params.sheetName);
  if (!worksheetName) {
    throw new Error(vscode.l10n.t('Worksheet not found: {0}', params.sheetName));
  }
  const sheet = workbook.Sheets[worksheetName];
  if (!sheet) {
    throw new Error(vscode.l10n.t('Worksheet not found: {0}', worksheetName));
  }
  const rows2d = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: null,
    raw: true
  });
  if (!rows2d || rows2d.length === 0) {
    throw new Error(vscode.l10n.t('Worksheet has no header row'));
  }
  const headerRow = rows2d[0] || [];
  const headers = headerRow.map((h, idx) => {
    if (h === null || h === undefined || String(h).trim() === '') {
      return `col_${idx + 1}`;
    }
    return String(h).trim();
  });
  const totalRows = Math.max(0, rows2d.length - 1);
  const options = resolveTableReadOptions(params.maxRows, params.tailRows, totalRows);
  const start = options.start;
  const end = options.end;
  const visibleCount = Math.max(0, end - start);
  const mappedVisibleCount = Array.isArray(params.sourceRowIndices)
    ? params.sourceRowIndices.length
    : visibleCount;

  for (const change of params.updates) {
    const colIndex = headers.indexOf(change.colKey);
    if (colIndex < 0) {
      throw new Error(vscode.l10n.t('Field not found: {0}', change.colKey));
    }
    if (!Number.isInteger(change.rowIndex) || change.rowIndex < 0 || change.rowIndex >= mappedVisibleCount) {
      throw new Error(vscode.l10n.t('Invalid row index: {0}', change.rowIndex));
    }
    const sourceDataRowIndex = resolveSourceDataRowIndex(
      change.rowIndex,
      start,
      visibleCount,
      params.sourceRowIndices
    );
    const targetSheetRow = sourceDataRowIndex + 1;
    const targetCell = XLSX.utils.encode_cell({ r: targetSheetRow, c: colIndex });
    if (change.value === null || change.value === undefined || change.value === '') {
      delete (sheet as any)[targetCell];
    } else if (typeof change.value === 'number') {
      (sheet as any)[targetCell] = { t: 'n', v: change.value };
    } else if (typeof change.value === 'boolean') {
      (sheet as any)[targetCell] = { t: 'b', v: change.value };
    } else if (change.value instanceof Date) {
      (sheet as any)[targetCell] = { t: 'd', v: change.value };
    } else {
      (sheet as any)[targetCell] = { t: 's', v: String(change.value) };
    }
  }
}

async function writeExcelWithExcelJs(params: ExcelWriteParams): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(params.sourcePath);
  sanitizeExcelJsConditionalFormats(workbook);
  const worksheet = workbook.getWorksheet(params.sheetName);
  if (!worksheet) {
    throw new Error(vscode.l10n.t('Worksheet not found: {0}', params.sheetName));
  }

  const headerRow = worksheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values) ? headerRow.values.slice(1) : [];
  const headers = headerValues.map((h, idx) => {
    if (h === null || h === undefined || String(h).trim() === '') {
      return `col_${idx + 1}`;
    }
    return String(h).trim();
  });

  if (headers.length === 0) {
    throw new Error(vscode.l10n.t('Worksheet has no header row'));
  }

  const totalRows = Math.max(0, worksheet.actualRowCount - 1);
  const options = resolveTableReadOptions(params.maxRows, params.tailRows, totalRows);
  const start = options.start;
  const end = options.end;
  const visibleCount = Math.max(0, end - start);
  const mappedVisibleCount = Array.isArray(params.sourceRowIndices)
    ? params.sourceRowIndices.length
    : visibleCount;

  for (const change of params.updates) {
    const colIndex = headers.indexOf(change.colKey);
    if (colIndex < 0) {
      throw new Error(vscode.l10n.t('Field not found: {0}', change.colKey));
    }
    if (!Number.isInteger(change.rowIndex) || change.rowIndex < 0 || change.rowIndex >= mappedVisibleCount) {
      throw new Error(vscode.l10n.t('Invalid row index: {0}', change.rowIndex));
    }
    const sourceDataRowIndex = resolveSourceDataRowIndex(
      change.rowIndex,
      start,
      visibleCount,
      params.sourceRowIndices
    );
    const excelRowNumber = sourceDataRowIndex + 2;
    const excelColNumber = colIndex + 1;
    const cell = worksheet.getRow(excelRowNumber).getCell(excelColNumber);
    if (change.value === null || change.value === undefined || change.value === '') {
      cell.value = null;
    } else {
      cell.value = change.value as any;
    }
  }

  await workbook.xlsx.writeFile(params.sourcePath);
}

export async function saveExcelTableWithFallback(params: ExcelWriteParams): Promise<{
  usedCompatibilityFallback: boolean;
  fallbackReason?: string;
}> {
  if (/\.xlsx$/i.test(params.sourcePath)) {
    try {
      await writeExcelWithExcelJs(params);
      return { usedCompatibilityFallback: false };
    } catch (excelJsError) {
      const workbook = readExcelWorkbook(params.sourcePath);
      applyUpdatesToXlsxWorkbook(workbook, params);
      writeExcelWorkbook(workbook, params.sourcePath);
      return {
        usedCompatibilityFallback: true,
        fallbackReason: excelJsError instanceof Error ? excelJsError.message : String(excelJsError)
      };
    }
  }

  const workbook = readExcelWorkbook(params.sourcePath);
  applyUpdatesToXlsxWorkbook(workbook, params);
  writeExcelWorkbook(workbook, params.sourcePath);
  return { usedCompatibilityFallback: true };
}

export function applyExcelCellUpdateInMemory(
  sourcePath: string,
  sheetName: string,
  maxRows: number | undefined,
  tailRows: number | undefined,
  rowIndex: number,
  colKey: string,
  value: any
): void {
  const workbook = readExcelWorkbook(sourcePath);
  applyUpdatesToXlsxWorkbook(workbook, {
    sourcePath,
    sheetName,
    maxRows,
    tailRows,
    updates: [{ rowIndex, colKey, value }]
  });
  writeExcelWorkbook(workbook, sourcePath);
}
