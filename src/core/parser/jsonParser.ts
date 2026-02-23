/**
 * JSON parser with path-based lookup and location metadata.
 */

import { findNodeAtLocation, getNodeValue, parseTree } from 'jsonc-parser';
import { LuaParseResult, LuaValueNode, LuaValueType } from '../../types';

export type JsonPathSegment = string | number;

export class JsonParser {
  private readonly sourceCode: string;
  private readonly root: ReturnType<typeof parseTree>;
  private readonly lineStarts: number[];

  constructor(sourceCode: string) {
    this.sourceCode = sourceCode;
    const errors: { error: number; offset: number; length: number }[] = [];
    this.root = parseTree(sourceCode, errors, { allowTrailingComma: true, disallowComments: false });
    if (!this.root || errors.length > 0) {
      const first = errors[0];
      throw new Error(first ? `Invalid JSON at offset ${first.offset}` : 'Invalid JSON');
    }
    this.lineStarts = this.buildLineStarts(sourceCode);
  }

  findNodeByPath(keyPath: string): LuaParseResult {
    try {
      const path = parseJsonPath(keyPath);
      if (path.length === 0) {
        return { success: false, error: 'Invalid path' };
      }

      const target = findNodeAtLocation(this.root!, path);
      if (!target) {
        return { success: false, error: `Path not found: ${keyPath}` };
      }

      return {
        success: true,
        node: this.toValueNode(target),
        astNode: target
      };
    } catch (error) {
      return {
        success: false,
        error: `Parse error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Extract table-like array rows from a JSON array node.
   * Shape matches Lua table editor expectations.
   */
  extractTableArray(node: any): Array<{
    data: Record<string, any>;
    ranges: Record<string, [number, number]>;
    rowLoc?: { start: { line: number; column: number }; end: { line: number; column: number } };
  }> | null {
    if (!node || node.type !== 'array' || !Array.isArray(node.children)) {
      return null;
    }

    const result: Array<{
      data: Record<string, any>;
      ranges: Record<string, [number, number]>;
      rowLoc?: { start: { line: number; column: number }; end: { line: number; column: number } };
    }> = [];

    for (const rowNode of node.children) {
      if (!rowNode || rowNode.type !== 'object' || !Array.isArray(rowNode.children)) {
        continue;
      }

      const rowData: Record<string, any> = {};
      const rowRanges: Record<string, [number, number]> = {};

      for (const propNode of rowNode.children) {
        if (!propNode || propNode.type !== 'property' || !Array.isArray(propNode.children) || propNode.children.length < 2) {
          continue;
        }
        const keyNode = propNode.children[0];
        const valueNode = propNode.children[1];
        const key = String(keyNode.value);

        rowData[key] = getNodeValue(valueNode);
        rowRanges[key] = [valueNode.offset, valueNode.offset + valueNode.length];
      }

      result.push({
        data: rowData,
        ranges: rowRanges,
        rowLoc: {
          start: this.offsetToLoc(rowNode.offset),
          end: this.offsetToLoc(rowNode.offset + rowNode.length)
        }
      });
    }

    return result.length > 0 ? result : null;
  }

  private toValueNode(node: { type: string; offset: number; length: number }): LuaValueNode {
    const start = this.offsetToLoc(node.offset);
    const end = this.offsetToLoc(node.offset + node.length);
    const raw = this.sourceCode.substring(node.offset, node.offset + node.length);
    const value = getNodeValue(node as any);

    return {
      type: this.mapNodeType(node.type),
      value,
      range: [node.offset, node.offset + node.length],
      loc: { start, end },
      raw
    };
  }

  private mapNodeType(nodeType: string): LuaValueType {
    switch (nodeType) {
      case 'number':
        return 'number';
      case 'string':
        return 'string';
      case 'boolean':
        return 'boolean';
      case 'null':
        return 'nil';
      case 'object':
      case 'array':
        return 'table';
      default:
        return 'string';
    }
  }

  private buildLineStarts(text: string): number[] {
    const starts: number[] = [0];
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) {
        starts.push(i + 1);
      }
    }
    return starts;
  }

  private offsetToLoc(offset: number): { line: number; column: number } {
    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.lineStarts[mid] <= offset) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const lineIdx = Math.max(0, high);
    return {
      line: lineIdx + 1,
      column: offset - this.lineStarts[lineIdx]
    };
  }
}

export function parseJsonPath(path: string): JsonPathSegment[] {
  const segments: JsonPathSegment[] = [];
  const regex = /(\w+)|\[(\d+)\]|\["([^"]+)"\]|\['([^']+)'\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(path)) !== null) {
    if (match[1]) {
      segments.push(match[1]);
    } else if (match[2]) {
      segments.push(parseInt(match[2], 10));
    } else if (match[3] || match[4]) {
      segments.push(match[3] || match[4]);
    }
  }
  return segments;
}
