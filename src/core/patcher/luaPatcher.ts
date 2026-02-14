/**
 * Lua file patcher
 * Precisely replaces values in Lua files while preserving comments and formatting
 */

import { LuaValueNode, LuaValueType } from '../../types';

export class LuaPatcher {
  private sourceCode: string;

  constructor(sourceCode: string) {
    this.sourceCode = sourceCode;
  }

  /**
   * Update the value of a specified node
   * @param node Target node
   * @param newValue New value
   * @returns Updated full source code
   */
  updateValue(node: LuaValueNode, newValue: any): string {
    const formattedValue = this.formatLuaValue(newValue, node.type);

    // Precise replacement: only replace the value part, preserve everything else
    const before = this.sourceCode.substring(0, node.range[0]);
    const after = this.sourceCode.substring(node.range[1]);

    return before + formattedValue + after;
  }

  /**
   * Update value by range
   * @param range Character range
   * @param newValue New value
   * @param valueType Value type
   * @returns Updated full source code
   */
  updateValueByRange(range: [number, number], newValue: any, valueType: LuaValueType): string {
    const formattedValue = this.formatLuaValue(newValue, valueType);

    const before = this.sourceCode.substring(0, range[0]);
    const after = this.sourceCode.substring(range[1]);

    return before + formattedValue + after;
  }

  /**
   * Convert JavaScript value to Lua format
   */
  formatLuaValue(value: any, type: LuaValueType): string {
    if (value === null || value === undefined) {
      return 'nil';
    }

    switch (type) {
      case 'number':
        return this.formatNumber(value);
      case 'string':
        return this.formatString(value);
      case 'boolean':
        return value ? 'true' : 'false';
      case 'nil':
        return 'nil';
      case 'table':
        return this.formatTable(value);
      default:
        return String(value);
    }
  }

  /**
   * Format number
   */
  private formatNumber(value: any): string {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${value}`);
    }

    // Keep integer format
    if (Number.isInteger(num)) {
      return String(num);
    }

    // Floating point with reasonable precision
    return String(num);
  }

  /**
   * Format string
   */
  private formatString(value: any): string {
    const str = String(value);
    return `"${this.escapeLuaString(str)}"`;
  }

  /**
   * Escape special characters in Lua string
   */
  private escapeLuaString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\0/g, '\\0');
  }

  /**
   * Format Table (simple form, for simple arrays or objects)
   */
  private formatTable(value: any): string {
    if (Array.isArray(value)) {
      // Array format
      const items = value.map(item => this.formatAutoType(item));
      return `{ ${items.join(', ')} }`;
    }

    if (typeof value === 'object') {
      // Object format
      const entries = Object.entries(value).map(([key, val]) => {
        const formattedKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
          ? key
          : `["${this.escapeLuaString(key)}"]`;
        return `${formattedKey} = ${this.formatAutoType(val)}`;
      });
      return `{ ${entries.join(', ')} }`;
    }

    return '{}';
  }

  /**
   * Auto-detect type and format
   */
  private formatAutoType(value: any): string {
    if (value === null || value === undefined) {
      return 'nil';
    }

    switch (typeof value) {
      case 'number':
        return this.formatNumber(value);
      case 'string':
        return this.formatString(value);
      case 'boolean':
        return value ? 'true' : 'false';
      case 'object':
        return this.formatTable(value);
      default:
        return String(value);
    }
  }

  /**
   * Get source code
   */
  getSourceCode(): string {
    return this.sourceCode;
  }
}
