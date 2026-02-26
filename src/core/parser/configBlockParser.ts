/**
 * Markdown config block parser
 * Parses lua-config code blocks from markdown
 */

import * as yaml from 'yaml';
import { ConfigBlock, ParsedConfigBlock, ConfigBlockParseResult, ConfigType } from '../../types';

/** Regex for lua-config code blocks */
const CONFIG_BLOCK_REGEX = /```lua-config\s*\n([\s\S]*?)```/g;

export class ConfigBlockParser {
  /**
   * Extract all config blocks from Markdown text
   */
  parseMarkdown(markdownText: string): ParsedConfigBlock[] {
    const blocks: ParsedConfigBlock[] = [];

    let match;
    CONFIG_BLOCK_REGEX.lastIndex = 0;

    while ((match = CONFIG_BLOCK_REGEX.exec(markdownText)) !== null) {
      const rawContent = match[1];
      const startIndex = match.index;
      const endIndex = match.index + match[0].length;

      // Calculate line numbers
      const startLine = this.getLineNumber(markdownText, startIndex);
      const endLine = this.getLineNumber(markdownText, endIndex);

      // Parse config content
      const parseResult = this.parseConfigContent(rawContent);

      if (parseResult.success && parseResult.block) {
        blocks.push({
          ...parseResult.block,
          startIndex,
          endIndex,
          startLine,
          endLine,
          rawText: match[0]
        });
      }
    }

    return blocks;
  }

  /**
   * Parse a single config block content
   * Supports YAML format
   */
  parseConfigContent(content: string): ConfigBlockParseResult {
    try {
      // Try YAML parsing
      const parsed = yaml.parse(content);

      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Invalid config content' };
      }

      const storage = parsed.storage === 'markdown' ? 'markdown' : 'source';

      // Validate required fields
      if (storage !== 'markdown' && !parsed.file) {
        return { success: false, error: 'Missing required field: file' };
      }
      if (!parsed.key) {
        return { success: false, error: 'Missing required field: key' };
      }
      if (!parsed.type) {
        return { success: false, error: 'Missing required field: type' };
      }

      // Validate type
      const validTypes: ConfigType[] = ['number', 'slider', 'string', 'boolean', 'select', 'color', 'array', 'table', 'code'];
      if (!validTypes.includes(parsed.type)) {
        return { success: false, error: `Invalid type: ${parsed.type}` };
      }

      // Build config block
      const block: ConfigBlock = {
        storage,
        file: parsed.file,
        key: parsed.key,
        markdownKey: parsed['markdown-key'] || parsed.markdownKey,
        value: parsed.value,
        type: parsed.type,
        label: parsed.label,
        default: parsed.default,
        min: parsed.min,
        max: parsed.max,
        step: parsed.step,
        unit: parsed.unit,
        readonly: parsed.readonly,
        options: parsed.options,
        columns: parsed.columns,
        maxRows: parsed['max-rows'] ?? parsed.maxRows,
        tailRows: parsed['tail-rows'] ?? parsed.tailRows
      };

      // Handle range field
      if (parsed.range && Array.isArray(parsed.range) && parsed.range.length === 2) {
        block.min = parsed.range[0];
        block.max = parsed.range[1];
        block.range = parsed.range as [number, number];
      }

      return { success: true, block };
    } catch (error) {
      return {
        success: false,
        error: `Parse error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Calculate line number from character index
   */
  private getLineNumber(text: string, index: number): number {
    const substring = text.substring(0, index);
    return (substring.match(/\n/g) || []).length + 1;
  }

  /**
   * Validate config block
   */
  validateConfigBlock(block: ConfigBlock): string[] {
    const errors: string[] = [];

    // Validate file path
    if (block.storage !== 'markdown' && (!block.file || typeof block.file !== 'string')) {
      errors.push('file must be a valid file path');
    }

    // Validate key path
    if (!block.key || typeof block.key !== 'string') {
      errors.push('key must be a valid variable path');
    } else if (!/^[a-zA-Z_][\w.[\]"']*$/.test(block.key)) {
      errors.push('Invalid key format');
    }

    // Validate type-specific fields
    switch (block.type) {
      case 'number':
      case 'slider':
        if (block.min !== undefined && block.max !== undefined && block.min > block.max) {
          errors.push('min cannot be greater than max');
        }
        break;
      case 'select':
        if (!block.options || !Array.isArray(block.options) || block.options.length === 0) {
          errors.push('select type requires options array');
        }
        break;
      case 'table':
        if (!block.columns || !Array.isArray(block.columns) || block.columns.length === 0) {
          errors.push('table type requires columns array');
        }
        if (block.maxRows !== undefined) {
          if (!Number.isInteger(block.maxRows) || block.maxRows <= 0) {
            errors.push('maxRows must be a positive integer');
          }
        }
        if (block.tailRows !== undefined) {
          if (!Number.isInteger(block.tailRows) || block.tailRows <= 0) {
            errors.push('tailRows must be a positive integer');
          }
        }
        break;
    }

    return errors;
  }
}
