/**
 * Lua AST node type definitions
 */

/** Lua value types */
export type LuaValueType = 'number' | 'string' | 'boolean' | 'table' | 'nil' | 'function';

/** Lua value node */
export interface LuaValueNode {
  /** Value type */
  type: LuaValueType;
  /** Value content */
  value: any;
  /** Character range in source [start, end] */
  range: [number, number];
  /** Location info */
  loc: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  /** Raw text */
  raw?: string;
}

/** Path segment type */
export type PathSegmentType = 'key' | 'index' | 'string-key';

/** Path segment */
export interface PathSegment {
  type: PathSegmentType;
  value: string | number;
}

/** Lua file parse result */
export interface LuaParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Found node */
  node?: LuaValueNode;
  /** Raw AST node */
  astNode?: any;
  /** Error message */
  error?: string;
}
