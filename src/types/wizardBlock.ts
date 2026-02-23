/**
 * Wizard block type definitions
 * Defines multi-step wizard for generating and inserting code from templates,
 * or executing system commands.
 */

/** Wizard step field type */
export type WizardFieldType = 'number' | 'string' | 'boolean' | 'select';

/** Wizard action type */
export type WizardActionType = 'append' | 'run' | 'prompt';

/** Wizard step option (for select type) */
export interface WizardOption {
  label: string;
  value: string | number;
}

/** Dynamic variable definition (resolved at render time) */
export interface WizardVariable {
  /** Variable type */
  type: 'json';
  /** File path (relative to markdown) */
  file: string;
  /** JSON path to value (dot-separated, e.g. "version" or "config.name") */
  path: string;
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
  /** Target file (relative to markdown). For 'append': Lua file. For 'run': reference file. */
  file: string;
  /** Target path in file (for 'append' action: Lua table path) */
  target?: string;
  /** Action type: 'append' inserts code into Lua, 'run' executes shell commands, 'prompt' generates prompt text */
  action: WizardActionType;
  /** Display label */
  label?: string;
  /** Icon emoji */
  icon?: string;
  /** Code template with {{variable}} placeholders (for 'append' action) */
  template?: string;
  /** Shell commands template with {{variable}} placeholders (for 'run' action) */
  commands?: string;
  /** Prompt template with {{variable}} placeholders (for 'prompt' action) */
  prompt?: string;
  /** Working directory for shell commands (relative to workspace root, default '.') */
  cwd?: string;
  /** Dynamic variables resolved from files */
  variables?: Record<string, WizardVariable>;
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
