/**
 * Lua 文件修补器
 * 精准替换 Lua 文件中的值，保留注释和格式
 */

import { LuaValueNode, LuaValueType } from '../../types';

export class LuaPatcher {
  private sourceCode: string;

  constructor(sourceCode: string) {
    this.sourceCode = sourceCode;
  }

  /**
   * 更新指定节点的值
   * @param node 目标节点
   * @param newValue 新值
   * @returns 更新后的完整源码
   */
  updateValue(node: LuaValueNode, newValue: any): string {
    const formattedValue = this.formatLuaValue(newValue, node.type);

    // 精准替换：只替换值的部分，保留所有其他内容
    const before = this.sourceCode.substring(0, node.range[0]);
    const after = this.sourceCode.substring(node.range[1]);

    return before + formattedValue + after;
  }

  /**
   * 更新指定范围的值
   * @param range 字符范围
   * @param newValue 新值
   * @param valueType 值类型
   * @returns 更新后的完整源码
   */
  updateValueByRange(range: [number, number], newValue: any, valueType: LuaValueType): string {
    const formattedValue = this.formatLuaValue(newValue, valueType);

    const before = this.sourceCode.substring(0, range[0]);
    const after = this.sourceCode.substring(range[1]);

    return before + formattedValue + after;
  }

  /**
   * 将 JavaScript 值转换为 Lua 格式
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
   * 格式化数字
   */
  private formatNumber(value: any): string {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`无效的数字: ${value}`);
    }

    // 保持整数格式
    if (Number.isInteger(num)) {
      return String(num);
    }

    // 浮点数保持合理精度
    return String(num);
  }

  /**
   * 格式化字符串
   */
  private formatString(value: any): string {
    const str = String(value);
    return `"${this.escapeLuaString(str)}"`;
  }

  /**
   * 转义 Lua 字符串中的特殊字符
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
   * 格式化 Table（简单形式，用于简单数组或对象）
   */
  private formatTable(value: any): string {
    if (Array.isArray(value)) {
      // 数组格式
      const items = value.map(item => this.formatAutoType(item));
      return `{ ${items.join(', ')} }`;
    }

    if (typeof value === 'object') {
      // 对象格式
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
   * 自动检测类型并格式化
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
   * 获取源码
   */
  getSourceCode(): string {
    return this.sourceCode;
  }
}
