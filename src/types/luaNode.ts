/**
 * Lua AST 节点类型定义
 */

/** Lua 值类型 */
export type LuaValueType = 'number' | 'string' | 'boolean' | 'table' | 'nil' | 'function';

/** Lua 值节点 */
export interface LuaValueNode {
  /** 值类型 */
  type: LuaValueType;
  /** 值内容 */
  value: any;
  /** 在源码中的字符范围 [start, end] */
  range: [number, number];
  /** 位置信息 */
  loc: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  /** 原始文本 */
  raw?: string;
}

/** 路径段类型 */
export type PathSegmentType = 'key' | 'index' | 'string-key';

/** 路径段 */
export interface PathSegment {
  type: PathSegmentType;
  value: string | number;
}

/** Lua 文件解析结果 */
export interface LuaParseResult {
  /** 是否解析成功 */
  success: boolean;
  /** 找到的节点 */
  node?: LuaValueNode;
  /** 原始 AST 节点 */
  astNode?: any;
  /** 错误信息 */
  error?: string;
}
