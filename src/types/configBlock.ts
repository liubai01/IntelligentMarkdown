/**
 * 配置块类型定义
 */

/** 支持的控件类型 */
export type ConfigType = 'number' | 'slider' | 'string' | 'boolean' | 'select' | 'color' | 'array' | 'table';

/** 选项项 */
export interface SelectOption {
  value: string | number;
  label: string;
}

/** 表格列定义 */
export interface TableColumn {
  /** 列键名（对应 Lua table 字段） */
  key: string;
  /** 列显示标签 */
  label: string;
  /** 列类型 */
  type: 'number' | 'string' | 'boolean' | 'select';
  /** 数字类型的最小值 */
  min?: number;
  /** 数字类型的最大值 */
  max?: number;
  /** 数字类型的步进值 */
  step?: number;
  /** select 类型的选项 */
  options?: SelectOption[];
  /** 是否只读 */
  readonly?: boolean;
  /** 列宽度（CSS） */
  width?: string;
}

/** 配置块定义 */
export interface ConfigBlock {
  /** Lua 文件相对路径 */
  file: string;
  /** Lua 变量路径 */
  key: string;
  /** 控件类型 */
  type: ConfigType;
  /** 显示标签 */
  label?: string;
  /** 默认值 */
  default?: any;
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 范围 [min, max] */
  range?: [number, number];
  /** 步进值 */
  step?: number;
  /** 选项列表 */
  options?: SelectOption[];
  /** 单位 */
  unit?: string;
  /** 是否只读 */
  readonly?: boolean;
  /** table 类型的列定义 */
  columns?: TableColumn[];
}

/** 解析后的配置块（带位置信息） */
export interface ParsedConfigBlock extends ConfigBlock {
  /** 在 Markdown 中的起始行号 */
  startLine: number;
  /** 在 Markdown 中的结束行号 */
  endLine: number;
  /** 原始文本 */
  rawText: string;
  /** 当前从 Lua 读取的值 */
  currentValue?: any;
  /** 解析后的绝对文件路径 */
  absoluteFilePath?: string;
}

/** 配置块解析结果 */
export interface ConfigBlockParseResult {
  /** 是否解析成功 */
  success: boolean;
  /** 解析出的配置块 */
  block?: ConfigBlock;
  /** 错误信息 */
  error?: string;
}
