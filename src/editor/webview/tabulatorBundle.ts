/**
 * Tabulator bundle for webview table rendering
 * This file is bundled separately and loaded in the VS Code webview.
 *
 * Provides enhanced table controls with filtering, sorting, and inline editing.
 */

import { TabulatorFull as Tabulator } from 'tabulator-tables';

// ============ Types ============

/** Column definition from the extension (matches TableColumn in configBlock.ts) */
interface ColumnDef {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  readonly?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string | number; label: string }>;
  width?: string;
}

/** Callbacks for table events */
interface TableCallbacks {
  onCellEdited: (rowIndex: number, colKey: string, value: any) => void;
}

// ============ State ============

/** Active Tabulator instances, keyed by container ID */
const instances: Map<string, Tabulator> = new Map();

// ============ Public API ============

/**
 * Create a Tabulator table inside a container element.
 *
 * @param containerId  DOM id of the container div
 * @param columns      Column definitions (from Markdown config)
 * @param data         Row data array (from Lua)
 * @param callbacks    Event callbacks
 */
function create(
  containerId: string,
  columns: ColumnDef[],
  data: Array<Record<string, any>>,
  callbacks: TableCallbacks
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Destroy previous instance if any
  const prev = instances.get(containerId);
  if (prev) {
    prev.destroy();
    instances.delete(containerId);
  }

  // Build Tabulator column definitions
  const tabulatorColumns: any[] = [];

  // Row number column
  tabulatorColumns.push({
    title: '#',
    formatter: 'rownum',
    width: 50,
    headerSort: false,
    hozAlign: 'center',
    resizable: false,
    headerFilter: undefined,
  });

  for (const col of columns) {
    const tCol: any = {
      title: col.label,
      field: col.key,
      resizable: true,
      headerSort: true,
    };

    // Width
    if (col.width) {
      const numWidth = parseInt(col.width, 10);
      if (!isNaN(numWidth)) {
        tCol.width = numWidth;
      }
    }

    // Readonly
    if (col.readonly) {
      tCol.editable = false;
    }

    // Type-specific settings
    switch (col.type) {
      case 'number':
        tCol.sorter = 'number';
        tCol.hozAlign = 'right';
        tCol.headerFilter = 'input';
        tCol.headerFilterPlaceholder = '🔍';
        tCol.headerFilterFunc = 'like';
        if (!col.readonly) {
          tCol.editor = 'number';
          tCol.editorParams = {
            min: col.min,
            max: col.max,
            step: col.step ?? 1,
          };
        }
        break;

      case 'string':
        tCol.sorter = 'string';
        tCol.headerFilter = 'input';
        tCol.headerFilterPlaceholder = '🔍';
        if (!col.readonly) {
          tCol.editor = 'input';
        }
        break;

      case 'boolean':
        tCol.sorter = 'boolean';
        tCol.hozAlign = 'center';
        tCol.formatter = 'tickCross';
        tCol.headerFilter = 'tickCross';
        tCol.headerFilterParams = { tristate: true };
        tCol.headerFilterEmptyCheck = (value: any) => value === null || value === undefined;
        if (!col.readonly) {
          tCol.editor = 'tickCross';
        }
        break;

      case 'select': {
        const valuesObj: Record<string, string> = {};
        for (const opt of col.options || []) {
          valuesObj[String(opt.value)] = opt.label;
        }
        tCol.sorter = 'string';
        tCol.headerFilter = 'list';
        tCol.headerFilterParams = {
          values: { '': '(All)', ...valuesObj },
        };
        tCol.headerFilterPlaceholder = '🔍';
        // Custom formatter to show label instead of raw value
        tCol.formatter = (cell: any) => {
          const v = cell.getValue();
          return valuesObj[String(v)] || String(v);
        };
        if (!col.readonly) {
          tCol.editor = 'list';
          tCol.editorParams = { values: valuesObj };
        }
        break;
      }
    }

    tabulatorColumns.push(tCol);
  }

  // Inject a hidden __rowIndex field to track original row position
  const indexedData = data.map((row, i) => ({ ...row, __rowIndex: i }));

  // Create Tabulator
  const table = new Tabulator(container, {
    data: indexedData,
    columns: tabulatorColumns,
    layout: 'fitColumns',
    height: 'auto',
    maxHeight: '400px',
    placeholder: 'No Data',
    movableColumns: true,
    columnHeaderSortMulti: true,
  });

  // Cell edit callback
  table.on('cellEdited', (cell: any) => {
    const rowData = cell.getRow().getData();
    const field = cell.getField();
    let value = cell.getValue();

    // Type coercion
    const colDef = columns.find(c => c.key === field);
    if (colDef?.type === 'number') {
      value = Number(value);
      if (isNaN(value)) return;
    }

    callbacks.onCellEdited(rowData.__rowIndex, field, value);
  });

  instances.set(containerId, table);
}

/**
 * Destroy a Tabulator instance.
 */
function destroy(containerId: string): void {
  const prev = instances.get(containerId);
  if (prev) {
    prev.destroy();
    instances.delete(containerId);
  }
}

/**
 * Clear all header filters for a table.
 */
function clearFilters(containerId: string): void {
  const table = instances.get(containerId);
  if (table) {
    table.clearHeaderFilter();
  }
}

// ============ Expose to window ============

(window as any).TabulatorGrid = {
  create,
  destroy,
  clearFilters,
};
