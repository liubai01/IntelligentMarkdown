/**
 * Lua AST parser
 * Uses luaparse to parse Lua source and locate variables
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
   * Find Lua variable node by path
   * @param keyPath Variable path, e.g. "PlayerConfig.BaseStats.HP"
   */
  findNodeByPath(keyPath: string): LuaParseResult {
    try {
      const segments = this.parsePath(keyPath);
      if (segments.length === 0) {
        return { success: false, error: 'Invalid path' };
      }

      // Find root variable
      const rootName = segments[0].value as string;
      let currentNode = this.findRootAssignment(rootName);

      if (!currentNode) {
        return { success: false, error: `Root variable not found: ${rootName}` };
      }

      // If only one level, return directly
      if (segments.length === 1) {
        return { success: true, node: this.extractValueNode(currentNode), astNode: currentNode };
      }

      // Traverse nested path
      for (let i = 1; i < segments.length; i++) {
        const segment = segments[i];
        const nextNode = this.findInTable(currentNode, segment);

        if (!nextNode) {
          const pathSoFar = segments.slice(0, i + 1).map(s => s.value).join('.');
          return { success: false, error: `Path not found: ${pathSoFar}` };
        }

        currentNode = nextNode;
      }

      return { success: true, node: this.extractValueNode(currentNode), astNode: currentNode };
    } catch (error) {
      return {
        success: false,
        error: `Parse error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Parse path string into path segment array
   * Supports: Config.Items[1].Name, Config["special-key"]
   */
  private parsePath(path: string): PathSegment[] {
    const segments: PathSegment[] = [];
    const regex = /(\w+)|\[(\d+)\]|\["([^"]+)"\]|\['([^']+)'\]/g;

    let match;
    while ((match = regex.exec(path)) !== null) {
      if (match[1]) {
        // Identifier: Config, Items, Name
        segments.push({ type: 'key', value: match[1] });
      } else if (match[2]) {
        // Numeric index: [1], [2]
        segments.push({ type: 'index', value: parseInt(match[2], 10) });
      } else if (match[3] || match[4]) {
        // String key: ["key"], ['key']
        segments.push({ type: 'string-key', value: match[3] || match[4] });
      }
    }

    return segments;
  }

  /**
   * Find root-level assignment statement
   */
  private findRootAssignment(name: string): any {
    for (const statement of this.ast.body) {
      // Handle assignment: PlayerConfig = { ... }
      if (statement.type === 'AssignmentStatement') {
        for (let i = 0; i < statement.variables.length; i++) {
          const variable = statement.variables[i];
          if (variable.type === 'Identifier' && variable.name === name) {
            return statement.init[i];
          }
        }
      }

      // Handle local variable: local PlayerConfig = { ... }
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
   * Find a specific field in a Table
   */
  private findInTable(node: any, segment: PathSegment): any {
    if (!node || node.type !== 'TableConstructorExpression') {
      return null;
    }

    for (const field of node.fields) {
      if (segment.type === 'key' || segment.type === 'string-key') {
        // Find key-value pair: key = value or ["key"] = value
        if (field.type === 'TableKeyString') {
          if (field.key.name === segment.value) {
            return field.value;
          }
        } else if (field.type === 'TableKey') {
          // String key: ["key"] = value
          if (field.key.type === 'StringLiteral' && field.key.value === segment.value) {
            return field.value;
          }
        }
      } else if (segment.type === 'index') {
        // Find array element: { [1] = value } or { value, value }
        if (field.type === 'TableKey') {
          if (field.key.type === 'NumericLiteral' && field.key.value === segment.value) {
            return field.value;
          }
        } else if (field.type === 'TableValue') {
          // Implicit index array
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
   * Extract value info from AST node
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
        // luaparse StringLiteral node: value may be null, actual value in raw
        // raw includes quotes, need to strip: "zh-CN" -> zh-CN or 'text' -> text
        if (node.value !== null && node.value !== undefined) {
          value = node.value;
        } else if (node.raw) {
          // Strip surrounding quotes (supports single and double quotes)
          const raw = node.raw as string;
          if ((raw.startsWith('"') && raw.endsWith('"')) || 
              (raw.startsWith("'") && raw.endsWith("'"))) {
            value = raw.slice(1, -1);
          } else {
            value = raw;
          }
        }
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
        // For other types (e.g. expressions), try to get raw text
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
   * Extract Table value (simple form)
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

    // If pure array, convert to JavaScript array
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
   * Extract detailed table array structure (for table control)
   * Returns field info with range for each array element
   */
  extractTableArray(node: any): Array<{
    data: Record<string, any>;
    ranges: Record<string, [number, number]>;
    rowLoc?: { start: { line: number; column: number }; end: { line: number; column: number } };
  }> | null {
    if (!node || node.type !== 'TableConstructorExpression') {
      return null;
    }

    const result: Array<{
      data: Record<string, any>;
      ranges: Record<string, [number, number]>;
      rowLoc?: { start: { line: number; column: number }; end: { line: number; column: number } };
    }> = [];
    
    for (const field of node.fields) {
      if (field.type === 'TableValue' && field.value.type === 'TableConstructorExpression') {
        // Array element that is an object
        const rowData: Record<string, any> = {};
        const rowRanges: Record<string, [number, number]> = {};

        for (const subField of field.value.fields) {
          let key: string | null = null;
          let valueNode: any = null;

          if (subField.type === 'TableKeyString') {
            key = subField.key.name;
            valueNode = subField.value;
          } else if (subField.type === 'TableKey' && subField.key.type === 'StringLiteral') {
            key = subField.key.value || (subField.key.raw as string).slice(1, -1);
            valueNode = subField.value;
          }

          if (key && valueNode) {
            const extracted = this.extractValueNode(valueNode);
            rowData[key] = extracted.value;
            rowRanges[key] = extracted.range;
          }
        }

        // Capture row-level location from the inner table constructor
        const rowLoc = field.value.loc ? {
          start: { line: field.value.loc.start.line, column: field.value.loc.start.column },
          end: { line: field.value.loc.end.line, column: field.value.loc.end.column }
        } : undefined;

        result.push({ data: rowData, ranges: rowRanges, rowLoc });
      }
    }

    return result.length > 0 ? result : null;
  }

  /**
   * Find function declaration (supports multiple Lua function declaration patterns)
   * - Table field: GameConfig = { onInit = function() ... end }
   * - Standalone: function GameConfig.onInit() ... end
   * - Standalone (colon): function GameConfig:onInit() ... end
   * - Assignment: GameConfig.onInit = function() ... end
   */
  findFunctionByFullPath(keyPath: string): LuaParseResult {
    // Try normal path lookup first (handles functions in table fields)
    const normalResult = this.findNodeByPath(keyPath);
    if (normalResult.success && normalResult.node && normalResult.node.type === 'function') {
      return normalResult;
    }

    const targetPath = keyPath.split('.').join('.');

    for (const statement of this.ast.body) {
      // Pattern: function A.B.C() ... end or function A:B() ... end
      if (statement.type === 'FunctionDeclaration' && statement.identifier) {
        const declPath = this.getMemberExpressionPath(statement.identifier);
        if (declPath.join('.') === targetPath) {
          return {
            success: true,
            node: this.extractValueNode(statement),
            astNode: statement
          };
        }
      }

      // Pattern: A.B.C = function() ... end
      if (statement.type === 'AssignmentStatement') {
        for (let i = 0; i < statement.variables.length; i++) {
          const variable = statement.variables[i];
          const varPath = this.getMemberExpressionPath(variable);
          if (varPath.join('.') === targetPath &&
              statement.init[i] &&
              statement.init[i].type === 'FunctionDeclaration') {
            return {
              success: true,
              node: this.extractValueNode(statement.init[i]),
              astNode: statement.init[i]
            };
          }
        }
      }
    }

    return { success: false, error: `Function not found: ${keyPath}` };
  }

  /**
   * Extract path from MemberExpression or Identifier node
   */
  private getMemberExpressionPath(node: any): string[] {
    if (node.type === 'Identifier') {
      return [node.name];
    }
    if (node.type === 'MemberExpression') {
      return [...this.getMemberExpressionPath(node.base), node.identifier.name];
    }
    return [];
  }

  /**
   * Get all top-level variables
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
   * Get AST (for debugging)
   */
  getAST(): luaparse.Chunk {
    return this.ast;
  }
}
