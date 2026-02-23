import { describe, it, expect } from 'vitest';
import { JsonParser, parseJsonPath } from '../../src/core/parser/jsonParser';

describe('JsonParser', () => {
  const sampleJson = `{
  "GameConfig": {
    "Player": {
      "MaxHealth": 100,
      "Name": "Hero",
      "Enabled": true
    },
    "Items": [
      { "id": 1, "name": "Sword" },
      { "id": 2, "name": "Bow" }
    ]
  }
}`;

  it('finds nested number values', () => {
    const parser = new JsonParser(sampleJson);
    const result = parser.findNodeByPath('GameConfig.Player.MaxHealth');
    expect(result.success).toBe(true);
    expect(result.node?.type).toBe('number');
    expect(result.node?.value).toBe(100);
  });

  it('finds array item fields', () => {
    const parser = new JsonParser(sampleJson);
    const result = parser.findNodeByPath('GameConfig.Items[1].name');
    expect(result.success).toBe(true);
    expect(result.node?.type).toBe('string');
    expect(result.node?.value).toBe('Bow');
  });

  it('returns line/column metadata', () => {
    const parser = new JsonParser(sampleJson);
    const result = parser.findNodeByPath('GameConfig.Player.Name');
    expect(result.success).toBe(true);
    expect(result.node?.loc.start.line).toBeGreaterThan(0);
    expect(result.node?.range[1]).toBeGreaterThan(result.node?.range[0] || 0);
  });

  it('returns not-found on invalid path', () => {
    const parser = new JsonParser(sampleJson);
    const result = parser.findNodeByPath('GameConfig.Unknown.Value');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Path not found');
  });

  it('extracts table rows from array nodes', () => {
    const parser = new JsonParser(sampleJson);
    const result = parser.findNodeByPath('GameConfig.Items');
    expect(result.success).toBe(true);
    const rows = parser.extractTableArray(result.astNode);
    expect(rows).not.toBeNull();
    expect(rows?.length).toBe(2);
    expect(rows?.[0].data.id).toBe(1);
    expect(rows?.[1].data.name).toBe('Bow');
  });

  it('returns null for non-array table extraction', () => {
    const parser = new JsonParser(sampleJson);
    const result = parser.findNodeByPath('GameConfig.Player');
    expect(result.success).toBe(true);
    const rows = parser.extractTableArray(result.astNode);
    expect(rows).toBeNull();
  });
});

describe('parseJsonPath', () => {
  it('parses dot and bracket notations', () => {
    expect(parseJsonPath('A.B[2].C')).toEqual(['A', 'B', 2, 'C']);
    expect(parseJsonPath('A["special-key"]')).toEqual(['A', 'special-key']);
  });
});
