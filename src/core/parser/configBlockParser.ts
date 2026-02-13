/**
 * Markdown 配置块解析器
 * 解析 markdown 中的 lua-config 代码块
 */

import * as yaml from 'yaml';
import { ConfigBlock, ParsedConfigBlock, ConfigBlockParseResult, ConfigType } from '../../types';

/** lua-config 代码块的正则表达式 */
const CONFIG_BLOCK_REGEX = /```lua-config\s*\n([\s\S]*?)```/g;

export class ConfigBlockParser {
  /**
   * 从 Markdown 文本中提取所有配置块
   */
  parseMarkdown(markdownText: string): ParsedConfigBlock[] {
    const blocks: ParsedConfigBlock[] = [];

    let match;
    CONFIG_BLOCK_REGEX.lastIndex = 0;

    while ((match = CONFIG_BLOCK_REGEX.exec(markdownText)) !== null) {
      const rawContent = match[1];
      const startIndex = match.index;
      const endIndex = match.index + match[0].length;

      // 计算行号
      const startLine = this.getLineNumber(markdownText, startIndex);
      const endLine = this.getLineNumber(markdownText, endIndex);

      // 解析配置内容
      const parseResult = this.parseConfigContent(rawContent);

      if (parseResult.success && parseResult.block) {
        blocks.push({
          ...parseResult.block,
          startLine,
          endLine,
          rawText: match[0]
        });
      }
    }

    return blocks;
  }

  /**
   * 解析单个配置块内容
   * 支持 YAML 格式
   */
  parseConfigContent(content: string): ConfigBlockParseResult {
    try {
      // 尝试用 YAML 解析
      const parsed = yaml.parse(content);

      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: '配置内容无效' };
      }

      // 验证必需字段
      if (!parsed.file) {
        return { success: false, error: '缺少必需字段: file' };
      }
      if (!parsed.key) {
        return { success: false, error: '缺少必需字段: key' };
      }
      if (!parsed.type) {
        return { success: false, error: '缺少必需字段: type' };
      }

      // 验证类型
      const validTypes: ConfigType[] = ['number', 'slider', 'string', 'boolean', 'select', 'color', 'array'];
      if (!validTypes.includes(parsed.type)) {
        return { success: false, error: `无效的类型: ${parsed.type}` };
      }

      // 构建配置块
      const block: ConfigBlock = {
        file: parsed.file,
        key: parsed.key,
        type: parsed.type,
        label: parsed.label,
        default: parsed.default,
        min: parsed.min,
        max: parsed.max,
        step: parsed.step,
        unit: parsed.unit,
        readonly: parsed.readonly,
        options: parsed.options
      };

      // 处理 range 字段
      if (parsed.range && Array.isArray(parsed.range) && parsed.range.length === 2) {
        block.min = parsed.range[0];
        block.max = parsed.range[1];
        block.range = parsed.range as [number, number];
      }

      return { success: true, block };
    } catch (error) {
      return {
        success: false,
        error: `解析错误: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 根据字符索引计算行号
   */
  private getLineNumber(text: string, index: number): number {
    const substring = text.substring(0, index);
    return (substring.match(/\n/g) || []).length + 1;
  }

  /**
   * 验证配置块
   */
  validateConfigBlock(block: ConfigBlock): string[] {
    const errors: string[] = [];

    // 验证 file 路径
    if (!block.file || typeof block.file !== 'string') {
      errors.push('file 必须是有效的文件路径');
    }

    // 验证 key 路径
    if (!block.key || typeof block.key !== 'string') {
      errors.push('key 必须是有效的变量路径');
    } else if (!/^[a-zA-Z_][\w.[\]"']*$/.test(block.key)) {
      errors.push('key 格式无效');
    }

    // 根据类型验证特定字段
    switch (block.type) {
      case 'number':
      case 'slider':
        if (block.min !== undefined && block.max !== undefined && block.min > block.max) {
          errors.push('min 不能大于 max');
        }
        break;
      case 'select':
        if (!block.options || !Array.isArray(block.options) || block.options.length === 0) {
          errors.push('select 类型需要 options 数组');
        }
        break;
    }

    return errors;
  }
}
