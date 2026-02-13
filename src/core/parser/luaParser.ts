/**
 * Lua AST 解析器
 * 使用 luaparse 解析 Lua 源码并定位变量
 */

import * as luaparse from 'luaparse';
import { LuaValueNode, LuaValueType, PathSegment, LuaParseResult } from '../../types';

export class LuaParser {
  private ast: luaparse.Chunk;
  private sourceCode: string;

  constructor(sourceCode: string) {
    this.sourceCode = sourceCode;
    this.ast = luaparse.parse(sourceCode, {
      ranges: true,
      locations: true,
      comments: true,
      luaVersion: '5.3'
    });
  }

  /**
   * 根据路径查找 Lua 变量节点
   * @param keyPath 变量路径，如 "PlayerConfig.BaseStats.HP"
   */
  findNodeByPath(keyPath: string): LuaParseResult {
    try {
      const segments = this.parsePath(keyPath);
      if (segments.length === 0) {
        return { success: false, error: '无效的路径' };
      }

      // 查找根变量
      const rootName = segments[0].value as string;
      let currentNode = this.findRootAssignment(rootName);

      if (!currentNode) {
        return { success: false, error: `找不到根变量: ${rootName}` };
      }

      // 如果只有一层，直接返回
      if (segments.length === 1) {
        return { success: true, node: this.extractValueNode(currentNode) };
      }

      // 遍历嵌套路径
      for (let i = 1; i < segments.length; i++) {
        const segment = segments[i];
        const nextNode = this.findInTable(currentNode, segment);

        if (!nextNode) {
          const pathSoFar = segments.slice(0, i + 1).map(s => s.value).join('.');
          return { success: false, error: `找不到路径: ${pathSoFar}` };
        }

        currentNode = nextNode;
      }

      return { success: true, node: this.extractValueNode(currentNode) };
    } catch (error) {
      return {
        success: false,
        error: `解析错误: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 解析路径字符串为路径段数组
   * 支持格式: Config.Items[1].Name, Config["special-key"]
   */
  private parsePath(path: string): PathSegment[] {
    const segments: PathSegment[] = [];
    const regex = /(\w+)|\[(\d+)\]|\["([^"]+)"\]|\['([^']+)'\]/g;

    let match;
    while ((match = regex.exec(path)) !== null) {
      if (match[1]) {
        // 普通标识符: Config, Items, Name
        segments.push({ type: 'key', value: match[1] });
      } else if (match[2]) {
        // 数字索引: [1], [2]
        segments.push({ type: 'index', value: parseInt(match[2], 10) });
      } else if (match[3] || match[4]) {
        // 字符串键: ["key"], ['key']
        segments.push({ type: 'string-key', value: match[3] || match[4] });
      }
    }

    return segments;
  }

  /**
   * 查找根级赋值语句
   */
  private findRootAssignment(name: string): any {
    for (const statement of this.ast.body) {
      // 处理赋值语句: PlayerConfig = { ... }
      if (statement.type === 'AssignmentStatement') {
        for (let i = 0; i < statement.variables.length; i++) {
          const variable = statement.variables[i];
          if (variable.type === 'Identifier' && variable.name === name) {
            return statement.init[i];
          }
        }
      }

      // 处理局部变量: local PlayerConfig = { ... }
      if (statement.type === 'LocalStatement') {
        for (let i = 0; i < statement.variables.length; i++) {
          const variable = statement.variables[i];
          if (variable.type === 'Identifier' && variable.name === name) {
            return statement.init[i];
          }
        }
      }
    }

    return null;
  }

  /**
   * 在 Table 中查找指定字段
   */
  private findInTable(node: any, segment: PathSegment): any {
    if (!node || node.type !== 'TableConstructorExpression') {
      return null;
    }

    for (const field of node.fields) {
      if (segment.type === 'key' || segment.type === 'string-key') {
        // 查找键值对: key = value 或 ["key"] = value
        if (field.type === 'TableKeyString') {
          if (field.key.name === segment.value) {
            return field.value;
          }
        } else if (field.type === 'TableKey') {
          // 字符串键: ["key"] = value
          if (field.key.type === 'StringLiteral' && field.key.value === segment.value) {
            return field.value;
          }
        }
      } else if (segment.type === 'index') {
        // 查找数组元素: { [1] = value } 或 { value, value }
        if (field.type === 'TableKey') {
          if (field.key.type === 'NumericLiteral' && field.key.value === segment.value) {
            return field.value;
          }
        } else if (field.type === 'TableValue') {
          // 隐式索引的数组
          const index = node.fields.filter((f: any) => f.type === 'TableValue').indexOf(field) + 1;
          if (index === segment.value) {
            return field.value;
          }
        }
      }
    }

    return null;
  }

  /**
   * 从 AST 节点提取值信息
   */
  private extractValueNode(node: any): LuaValueNode {
    let type: LuaValueType = 'nil';
    let value: any = null;

    switch (node.type) {
      case 'NumericLiteral':
        type = 'number';
        value = node.value;
        break;
      case 'StringLiteral':
        type = 'string';
        value = node.value;
        break;
      case 'BooleanLiteral':
        type = 'boolean';
        value = node.value;
        break;
      case 'NilLiteral':
        type = 'nil';
        value = null;
        break;
      case 'TableConstructorExpression':
        type = 'table';
        value = this.extractTableValue(node);
        break;
      case 'FunctionDeclaration':
        type = 'function';
        value = '[function]';
        break;
      default:
        // 对于其他类型（如表达式），尝试获取原始文本
        type = 'string';
        value = this.sourceCode.substring(node.range[0], node.range[1]);
    }

    return {
      type,
      value,
      range: node.range,
      loc: node.loc,
      raw: this.sourceCode.substring(node.range[0], node.range[1])
    };
  }

  /**
   * 提取 Table 的值（简单形式）
   */
  private extractTableValue(node: any): any {
    const result: any = {};
    let isArray = true;
    let arrayIndex = 0;

    for (const field of node.fields) {
      if (field.type === 'TableKeyString') {
        isArray = false;
        result[field.key.name] = this.extractValueNode(field.value).value;
      } else if (field.type === 'TableKey') {
        isArray = false;
        if (field.key.type === 'StringLiteral') {
          result[field.key.value] = this.extractValueNode(field.value).value;
        } else if (field.key.type === 'NumericLiteral') {
          result[field.key.value] = this.extractValueNode(field.value).value;
        }
      } else if (field.type === 'TableValue') {
        arrayIndex++;
        result[arrayIndex] = this.extractValueNode(field.value).value;
      }
    }

    // 如果是纯数组，转换为 JavaScript 数组
    if (isArray && arrayIndex > 0) {
      const arr = [];
      for (let i = 1; i <= arrayIndex; i++) {
        arr.push(result[i]);
      }
      return arr;
    }

    return result;
  }

  /**
   * 获取所有顶级变量
   */
  getAllRootVariables(): string[] {
    const variables: string[] = [];

    for (const statement of this.ast.body) {
      if (statement.type === 'AssignmentStatement') {
        for (const variable of statement.variables) {
          if (variable.type === 'Identifier') {
            variables.push(variable.name);
          }
        }
      }
      if (statement.type === 'LocalStatement') {
        for (const variable of statement.variables) {
          if (variable.type === 'Identifier') {
            variables.push(variable.name);
          }
        }
      }
    }

    return variables;
  }

  /**
   * 获取 AST（用于调试）
   */
  getAST(): luaparse.Chunk {
    return this.ast;
  }
}
