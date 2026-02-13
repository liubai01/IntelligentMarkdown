/**
 * Lua 解析器单元测试
 */

import { describe, it, expect } from 'vitest';
import { LuaParser } from '../../src/core/parser/luaParser';

describe('LuaParser', () => {
  const sampleLuaCode = `
-- 测试配置
PlayerConfig = {
    BaseStats = {
        HP = 1000,
        MP = 500,
        Attack = 100
    },
    Skills = {
        DefaultSkillId = 1001
    },
    Settings = {
        ShowTutorial = true,
        Language = "zh-CN"
    }
}

local LocalConfig = {
    Value = 42
}
`;

  describe('findNodeByPath', () => {
    it('应该能找到一级变量', () => {
      const parser = new LuaParser(sampleLuaCode);
      const result = parser.findNodeByPath('PlayerConfig');
      
      expect(result.success).toBe(true);
      expect(result.node).toBeDefined();
      expect(result.node?.type).toBe('table');
    });

    it('应该能找到嵌套的数值', () => {
      const parser = new LuaParser(sampleLuaCode);
      const result = parser.findNodeByPath('PlayerConfig.BaseStats.HP');
      
      expect(result.success).toBe(true);
      expect(result.node?.type).toBe('number');
      expect(result.node?.value).toBe(1000);
    });

    it('应该能找到字符串值', () => {
      const parser = new LuaParser(sampleLuaCode);
      const result = parser.findNodeByPath('PlayerConfig.Settings.Language');
      
      expect(result.success).toBe(true);
      expect(result.node?.type).toBe('string');
      expect(result.node?.value).toBe('zh-CN');
    });

    it('应该能找到布尔值', () => {
      const parser = new LuaParser(sampleLuaCode);
      const result = parser.findNodeByPath('PlayerConfig.Settings.ShowTutorial');
      
      expect(result.success).toBe(true);
      expect(result.node?.type).toBe('boolean');
      expect(result.node?.value).toBe(true);
    });

    it('应该能找到局部变量', () => {
      const parser = new LuaParser(sampleLuaCode);
      const result = parser.findNodeByPath('LocalConfig.Value');
      
      expect(result.success).toBe(true);
      expect(result.node?.type).toBe('number');
      expect(result.node?.value).toBe(42);
    });

    it('找不到变量时应返回错误', () => {
      const parser = new LuaParser(sampleLuaCode);
      const result = parser.findNodeByPath('NonExistent.Value');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('找不到');
    });

    it('应该返回正确的 range', () => {
      const parser = new LuaParser(sampleLuaCode);
      const result = parser.findNodeByPath('PlayerConfig.BaseStats.HP');
      
      expect(result.success).toBe(true);
      expect(result.node?.range).toBeDefined();
      expect(result.node?.range.length).toBe(2);
      expect(result.node?.range[0]).toBeLessThan(result.node?.range[1]!);
    });
  });

  describe('getAllRootVariables', () => {
    it('应该返回所有顶级变量', () => {
      const parser = new LuaParser(sampleLuaCode);
      const variables = parser.getAllRootVariables();
      
      expect(variables).toContain('PlayerConfig');
      expect(variables).toContain('LocalConfig');
    });
  });
});

describe('LuaParser - 数组支持', () => {
  const arrayLuaCode = `
Config = {
    Items = {
        { Id = 1, Name = "Item1" },
        { Id = 2, Name = "Item2" }
    },
    Numbers = { 10, 20, 30 }
}
`;

  it('应该能解析 Table 中的数组', () => {
    const parser = new LuaParser(arrayLuaCode);
    const result = parser.findNodeByPath('Config.Numbers');
    
    expect(result.success).toBe(true);
    expect(result.node?.type).toBe('table');
  });
});
