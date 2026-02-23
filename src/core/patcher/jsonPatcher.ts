/**
 * JSON patcher using jsonc-parser edits.
 */

import { applyEdits, modify } from 'jsonc-parser';
import { parseJsonPath } from '../parser/jsonParser';

export class JsonPatcher {
  private readonly sourceCode: string;

  constructor(sourceCode: string) {
    this.sourceCode = sourceCode;
  }

  updateValue(path: string, newValue: any): string {
    const jsonPath = parseJsonPath(path);
    if (jsonPath.length === 0) {
      throw new Error(`Invalid JSON path: ${path}`);
    }

    const edits = modify(this.sourceCode, jsonPath as (string | number)[], newValue, {
      formattingOptions: {
        insertSpaces: true,
        tabSize: 2,
        eol: '\n'
      }
    });

    return applyEdits(this.sourceCode, edits);
  }
}
