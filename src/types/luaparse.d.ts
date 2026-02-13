/**
 * luaparse 类型声明
 */

declare module 'luaparse' {
  export interface ParseOptions {
    /** 是否记录位置信息 */
    locations?: boolean;
    /** 是否记录范围信息 */
    ranges?: boolean;
    /** 是否保留注释 */
    comments?: boolean;
    /** Lua 版本 */
    luaVersion?: '5.1' | '5.2' | '5.3' | 'LuaJIT';
    /** 是否在遇到错误时继续解析 */
    wait?: boolean;
    /** 扩展标识符 */
    extendedIdentifiers?: boolean;
  }

  export interface Location {
    start: { line: number; column: number };
    end: { line: number; column: number };
  }

  export interface BaseNode {
    type: string;
    range?: [number, number];
    loc?: Location;
  }

  export interface Identifier extends BaseNode {
    type: 'Identifier';
    name: string;
  }

  export interface NumericLiteral extends BaseNode {
    type: 'NumericLiteral';
    value: number;
    raw: string;
  }

  export interface StringLiteral extends BaseNode {
    type: 'StringLiteral';
    value: string;
    raw: string;
  }

  export interface BooleanLiteral extends BaseNode {
    type: 'BooleanLiteral';
    value: boolean;
    raw: string;
  }

  export interface NilLiteral extends BaseNode {
    type: 'NilLiteral';
    value: null;
    raw: string;
  }

  export interface TableKeyString extends BaseNode {
    type: 'TableKeyString';
    key: Identifier;
    value: Expression;
  }

  export interface TableKey extends BaseNode {
    type: 'TableKey';
    key: Expression;
    value: Expression;
  }

  export interface TableValue extends BaseNode {
    type: 'TableValue';
    value: Expression;
  }

  export interface TableConstructorExpression extends BaseNode {
    type: 'TableConstructorExpression';
    fields: Array<TableKeyString | TableKey | TableValue>;
  }

  export interface FunctionDeclaration extends BaseNode {
    type: 'FunctionDeclaration';
    identifier: Identifier | null;
    isLocal: boolean;
    parameters: Identifier[];
    body: Statement[];
  }

  export interface AssignmentStatement extends BaseNode {
    type: 'AssignmentStatement';
    variables: Array<Identifier | MemberExpression | IndexExpression>;
    init: Expression[];
  }

  export interface LocalStatement extends BaseNode {
    type: 'LocalStatement';
    variables: Identifier[];
    init: Expression[];
  }

  export interface MemberExpression extends BaseNode {
    type: 'MemberExpression';
    indexer: '.' | ':';
    identifier: Identifier;
    base: Expression;
  }

  export interface IndexExpression extends BaseNode {
    type: 'IndexExpression';
    base: Expression;
    index: Expression;
  }

  export interface CallStatement extends BaseNode {
    type: 'CallStatement';
    expression: CallExpression;
  }

  export interface CallExpression extends BaseNode {
    type: 'CallExpression';
    base: Expression;
    arguments: Expression[];
  }

  export interface ReturnStatement extends BaseNode {
    type: 'ReturnStatement';
    arguments: Expression[];
  }

  export interface Comment extends BaseNode {
    type: 'Comment';
    value: string;
    raw: string;
  }

  export type Expression =
    | Identifier
    | NumericLiteral
    | StringLiteral
    | BooleanLiteral
    | NilLiteral
    | TableConstructorExpression
    | FunctionDeclaration
    | MemberExpression
    | IndexExpression
    | CallExpression;

  export type Statement =
    | AssignmentStatement
    | LocalStatement
    | CallStatement
    | ReturnStatement
    | FunctionDeclaration;

  export interface Chunk extends BaseNode {
    type: 'Chunk';
    body: Statement[];
    comments?: Comment[];
  }

  /**
   * 解析 Lua 代码
   */
  export function parse(code: string, options?: ParseOptions): Chunk;
}
