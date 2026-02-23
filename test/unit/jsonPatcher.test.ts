import { describe, it, expect } from 'vitest';
import { JsonPatcher } from '../../src/core/patcher/jsonPatcher';
import { JsonParser } from '../../src/core/parser/jsonParser';

describe('JsonPatcher', () => {
  it('updates numeric value by path', () => {
    const code = `{
  "Config": {
    "HP": 100
  }
}`;
    const patcher = new JsonPatcher(code);
    const newCode = patcher.updateValue('Config.HP', 250);
    const parser = new JsonParser(newCode);
    const result = parser.findNodeByPath('Config.HP');
    expect(result.success).toBe(true);
    expect(result.node?.value).toBe(250);
  });

  it('updates array element fields', () => {
    const code = `{
  "Items": [
    { "id": 1, "name": "Sword" },
    { "id": 2, "name": "Bow" }
  ]
}`;
    const patcher = new JsonPatcher(code);
    const newCode = patcher.updateValue('Items[1].name', 'Axe');
    const parser = new JsonParser(newCode);
    const result = parser.findNodeByPath('Items[1].name');
    expect(result.success).toBe(true);
    expect(result.node?.value).toBe('Axe');
  });
});
