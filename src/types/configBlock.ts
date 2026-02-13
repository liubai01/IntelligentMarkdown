/**
 * 配置块类型定义
 */

/** 支持的控件类型 */
export type ConfigType = 'number' | 'slider' | 'string' | 'boolean' | 'select' | 'color' | 'array';

/** 选项项 */
export interface SelectOption {
  value: string | number;
  label: string;
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
