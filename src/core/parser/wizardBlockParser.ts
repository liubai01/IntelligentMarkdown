/**
 * Wizard block parser
 * Parses lua-wizard code blocks from Markdown
 */

import * as yaml from 'yaml';
import { WizardBlock, ParsedWizardBlock, WizardBlockParseResult, WizardStep } from '../../types';

/** Regex for lua-wizard code blocks */
const WIZARD_BLOCK_REGEX = /```lua-wizard\s*\n([\s\S]*?)```/g;

export class WizardBlockParser {
  /**
   * Extract all wizard blocks from Markdown text
   */
  parseMarkdown(markdownText: string): ParsedWizardBlock[] {
    const blocks: ParsedWizardBlock[] = [];

    let match;
    WIZARD_BLOCK_REGEX.lastIndex = 0;

    while ((match = WIZARD_BLOCK_REGEX.exec(markdownText)) !== null) {
      const rawContent = match[1];
      const startIndex = match.index;
      const endIndex = match.index + match[0].length;

      const startLine = this.getLineNumber(markdownText, startIndex);
      const endLine = this.getLineNumber(markdownText, endIndex);

      const parseResult = this.parseWizardContent(rawContent);

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
   * Parse a single wizard block content (YAML format)
   */
  parseWizardContent(content: string): WizardBlockParseResult {
    try {
      const parsed = yaml.parse(content);

      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Invalid wizard content' };
      }

      // Validate required fields
      if (!parsed.file) {
        return { success: false, error: 'Missing required field: file' };
      }
      if (!parsed.target) {
        return { success: false, error: 'Missing required field: target' };
      }
      if (!parsed.template) {
        return { success: false, error: 'Missing required field: template' };
      }
      if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
        return { success: false, error: 'Missing or empty required field: steps' };
      }

      // Validate and normalise steps
      const steps: WizardStep[] = [];
      for (const rawStep of parsed.steps) {
        if (!rawStep.field || !rawStep.label || !rawStep.type) {
          return { success: false, error: `Step missing required fields (field, label, type)` };
        }
        const validTypes = ['number', 'string', 'boolean', 'select'];
        if (!validTypes.includes(rawStep.type)) {
          return { success: false, error: `Invalid step type: ${rawStep.type}` };
        }
        steps.push({
          field: rawStep.field,
          label: rawStep.label,
          type: rawStep.type,
          default: rawStep.default,
          description: rawStep.description,
          min: rawStep.min,
          max: rawStep.max,
          step: rawStep.step,
          options: rawStep.options,
          required: rawStep.required !== false // default true
        });
      }

      const block: WizardBlock = {
        file: parsed.file,
        target: parsed.target,
        action: parsed.action || 'append',
        label: parsed.label,
        icon: parsed.icon,
        template: parsed.template,
        steps
      };

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
    return substring.split('\n').length;
  }
}
