/**
 * Config block type definitions
 */

/** Supported control types */
export type ConfigType = 'number' | 'slider' | 'string' | 'boolean' | 'select' | 'color' | 'array' | 'table' | 'code';

/** Option item */
export interface OptionItem {
  label: string;
  value: string | number;
}

/** Table column definition */
export interface TableColumn {
  /** Column key (corresponds to Lua table field) */
  key: string;
  /** Column display label */
  label: string;
  /** Column type */
  type: 'number' | 'string' | 'boolean' | 'select';
  /** Min value for number type */
  min?: number;
  /** Max value for number type */
  max?: number;
  /** Step value for number type */
  step?: number;
  /** Options for select type */
  options?: OptionItem[];
  /** Whether readonly */
  readonly?: boolean;
  /** Column width (CSS) */
  width?: string;
}

/** Config block definition */
export interface ConfigBlock {
  /** Storage mode: source file (default) or markdown-local */
  storage?: 'source' | 'markdown';
  /** Lua file relative path */
  file?: string;
  /** Lua variable path */
  key: string;
  /** Optional markdown-level variable key used by wizard/config references */
  markdownKey?: string;
  /** Value stored in markdown when storage=markdown */
  value?: any;
  /** Control type */
  type: ConfigType;
  /** Display label */
  label?: string;
  /** Default value */
  default?: any;
  /** Min value */
  min?: number;
  /** Max value */
  max?: number;
  /** Range [min, max] */
  range?: [number, number];
  /** Step value */
  step?: number;
  /** Options list */
  options?: OptionItem[];
  /** Unit */
  unit?: string;
  /** Whether readonly */
  readonly?: boolean;
  /** Table columns definition */
  columns?: TableColumn[];
  /** Max rows returned for table preview (capped globally) */
  maxRows?: number;
  /** Read last N rows from table source first (for large datasets) */
  tailRows?: number;
  /** Filter column name for table rows (mainly for Excel table filtering) */
  filterColumn?: string;
  /** Allowed values for table filter column */
  filterValues?: Array<string | number>;
  /** Optional source file for dynamic filter values */
  filterSourceFile?: string;
  /** Optional key path in source file used to derive filter values */
  filterSourceKey?: string;
}

/** Parsed config block (with position info) */
export interface ParsedConfigBlock extends ConfigBlock {
  /** Start character index in Markdown */
  startIndex?: number;
  /** End character index in Markdown */
  endIndex?: number;
  /** Start line number in Markdown */
  startLine: number;
  /** End line number in Markdown */
  endLine: number;
  /** Raw text */
  rawText: string;
  /** Current value read from Lua */
  currentValue?: any;
  /** Parsed absolute file path */
  absoluteFilePath?: string;
}

/** Config block parse result */
export interface ConfigBlockParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed config block */
  block?: ConfigBlock;
  /** Error message */
  error?: string;
}
