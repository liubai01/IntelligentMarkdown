/**
 * Wizard block type definitions
 * Defines multi-step wizard for generating and inserting code from templates
 */

/** Wizard step field type */
export type WizardFieldType = 'number' | 'string' | 'boolean' | 'select';

/** Wizard step option (for select type) */
export interface WizardOption {
  label: string;
  value: string | number;
}

/** A single wizard step definition */
export interface WizardStep {
  /** Field variable name (used in template as {{field}}) */
  field: string;
  /** Display label */
  label: string;
  /** Input type */
  type: WizardFieldType;
  /** Default value */
  default?: any;
  /** Help description */
  description?: string;
  /** Min value (for number) */
  min?: number;
  /** Max value (for number) */
  max?: number;
  /** Step increment (for number) */
  step?: number;
  /** Options (for select type) */
  options?: WizardOption[];
  /** Whether this field is required */
  required?: boolean;
}

/** Wizard block definition */
export interface WizardBlock {
  /** Target Lua file (relative to markdown) */
  file: string;
  /** Lua table path to insert into (e.g. "ItemsConfig.Weapons") */
  target: string;
  /** Action type */
  action: 'append';
  /** Display label */
  label?: string;
  /** Icon emoji */
  icon?: string;
  /** Code template with {{variable}} placeholders */
  template: string;
  /** Wizard steps */
  steps: WizardStep[];
}

/** Parsed wizard block (with position info) */
export interface ParsedWizardBlock extends WizardBlock {
  /** Start line number in Markdown */
  startLine: number;
  /** End line number in Markdown */
  endLine: number;
  /** Raw text (the full ```lua-wizard ... ``` block) */
  rawText: string;
}

/** Wizard block parse result */
export interface WizardBlockParseResult {
  success: boolean;
  block?: WizardBlock;
  error?: string;
}
