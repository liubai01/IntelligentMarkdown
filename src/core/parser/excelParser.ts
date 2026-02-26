/**
 * Excel parser for table-style config blocks.
 */

import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { LuaParseResult } from '../../types';

export interface ExcelTableReadOptions {
  maxRows?: number;
  tailRows?: number;
  filterColumn?: string;
  filterValues?: Array<string | number>;
}

export interface ExcelTableRow {
  data: Record<string, any>;
  ranges: Record<string, [number, number]>;
  rowLoc?: { start: { line: number; column: number }; end: { line: number; column: number } };
}

export class ExcelParser {
  private readonly workbook: XLSX.WorkBook;
  private readonly sourcePath: string;

  constructor(sourcePath: string) {
    this.sourcePath = sourcePath;
    this.workbook = this.readWorkbookFromFile(sourcePath);
  }

  findNodeByPath(sheetName: string, options: ExcelTableReadOptions = {}): LuaParseResult {
    try {
      const wsName = this.resolveSheetName(sheetName);
      if (!wsName) {
        return { success: false, error: `Sheet not found: ${sheetName}` };
      }

      const rows = this.extractTableRows(wsName, options);
      return {
        success: true,
        node: {
          type: 'table',
          value: rows.map(r => r.data),
          range: [0, 0],
          loc: {
            start: { line: 1, column: 0 },
            end: { line: rows.length + 1, column: 0 }
          },
          raw: ''
        },
        astNode: {
          kind: 'excel-table',
          sourcePath: this.sourcePath,
          sheetName: wsName,
          rows
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Parse error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  extractTableArray(astNode: any): ExcelTableRow[] | null {
    if (!astNode || astNode.kind !== 'excel-table' || !Array.isArray(astNode.rows)) {
      return null;
    }
    return astNode.rows as ExcelTableRow[];
  }

  private resolveSheetName(requested: string): string | null {
    if (requested && this.workbook.SheetNames.includes(requested)) {
      return requested;
    }
    if (requested) {
      const normalized = requested.trim().toLowerCase();
      const byCaseInsensitive = this.workbook.SheetNames.find(s => s.toLowerCase() === normalized);
      if (byCaseInsensitive) {
        return byCaseInsensitive;
      }
      return null;
    }
    return this.workbook.SheetNames[0] || null;
  }

  private extractTableRows(sheetName: string, options: ExcelTableReadOptions): ExcelTableRow[] {
    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) {
      return [];
    }

    const rows2d = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      defval: null,
      raw: true
    });

    if (!rows2d || rows2d.length === 0) {
      return [];
    }

    const headerRow = rows2d[0] || [];
    const headers = headerRow.map((h, idx) => {
      if (h === null || h === undefined || String(h).trim() === '') {
        return `col_${idx + 1}`;
      }
      return String(h).trim();
    });

    const allDataRows = rows2d.slice(1);
    const totalRows = allDataRows.length;
    if (totalRows === 0) {
      return [];
    }

    const maxRows = Number.isInteger(options.maxRows) && (options.maxRows as number) > 0
      ? (options.maxRows as number)
      : totalRows;
    const tailRows = Number.isInteger(options.tailRows) && (options.tailRows as number) > 0
      ? (options.tailRows as number)
      : undefined;

    let filteredIndices = Array.from({ length: totalRows }, (_, i) => i);
    const filterColumn = options.filterColumn;
    const filterValues = Array.isArray(options.filterValues) ? options.filterValues : undefined;
    if (filterColumn && filterValues && filterValues.length > 0) {
      const colIndex = headers.indexOf(filterColumn);
      if (colIndex >= 0) {
        const allowed = new Set(filterValues.map(v => String(v)));
        filteredIndices = filteredIndices.filter((rowIdx) => {
          const row = allDataRows[rowIdx] || [];
          const raw = row[colIndex];
          return allowed.has(String(raw));
        });
      }
    }

    const filteredTotal = filteredIndices.length;
    if (filteredTotal === 0) {
      return [];
    }

    let start = 0;
    let end = filteredTotal;
    if (tailRows !== undefined) {
      const tailCount = Math.min(tailRows, filteredTotal);
      start = filteredTotal - tailCount;
    }
    end = Math.min(filteredTotal, start + maxRows);

    const result: ExcelTableRow[] = [];
    for (let i = start; i < end; i++) {
      const sourceIndex = filteredIndices[i];
      const row = allDataRows[sourceIndex] || [];
      const rowData: Record<string, any> = {};
      const rowRanges: Record<string, [number, number]> = {};
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c];
        rowData[key] = row[c] === undefined ? null : row[c];
        rowRanges[key] = [0, 0];
      }
      rowData.__sourceRowIndex = sourceIndex;
      result.push({
        data: rowData,
        ranges: rowRanges,
        rowLoc: {
          start: { line: sourceIndex + 2, column: 0 },
          end: { line: sourceIndex + 2, column: 0 }
        }
      });
    }

    return result;
  }

  private readWorkbookFromFile(filePath: string): XLSX.WorkBook {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      const data = fs.readFileSync(filePath);
      return XLSX.read(data, { type: 'buffer', cellDates: true });
    } catch (error) {
      throw new Error(
        `Cannot read Excel file "${filePath}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

