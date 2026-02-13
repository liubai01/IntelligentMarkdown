/**
 * Lua 修补器单元测试
 */

import { describe, it, expect } from 'vitest';
import { LuaPatcher } from '../../src/core/patcher/luaPatcher';
import { LuaParser } from '../../src/core/parser/luaParser';

describe('LuaPatcher', () => {
  describe('updateValue', () => {
    it('应该能替换数字值', () => {
      const code = `Config = { HP = 100 }`;
      const parser = new LuaParser(code);
      const result = parser.findNodeByPath('Config.HP');
      
      expect(result.success).toBe(true);
      
      const patcher = new LuaPatcher(code);
      const newCode = patcher.updateValue(result.node!, 200);
      
      expect(newCode).toBe(`Config = { HP = 200 }`);
    });

    it('应该能替换字符串值', () => {
      const code = `Config = { Name = "old" }`;
      const parser = new LuaParser(code);
      const result = parser.findNodeByPath('Config.Name');
      
      expect(result.success).toBe(true);
      
      const patcher = new LuaPatcher(code);
      const newCode = patcher.updateValue(result.node!, 'new');
      
      expect(newCode).toBe(`Config = { Name = "new" }`);
    });

    it('应该能替换布尔值', () => {
      const code = `Config = { Enabled = true }`;
      const parser = new LuaParser(code);
      const result = parser.findNodeByPath('Config.Enabled');
      
      expect(result.success).toBe(true);
      
      const patcher = new LuaPatcher(code);
      const newCode = patcher.updateValue(result.node!, false);
      
      expect(newCode).toBe(`Config = { Enabled = false }`);
    });

    it('应该保留注释', () => {
      const code = `-- 配置文件
Config = {
    HP = 100,  -- 生命值
    MP = 50    -- 魔法值
}`;
      const parser = new LuaParser(code);
      const result = parser.findNodeByPath('Config.HP');
      
      expect(result.success).toBe(true);
      
      const patcher = new LuaPatcher(code);
      const newCode = patcher.updateValue(result.node!, 200);
      
      expect(newCode).toContain('-- 配置文件');
      expect(newCode).toContain('-- 生命值');
      expect(newCode).toContain('-- 魔法值');
      expect(newCode).toContain('HP = 200');
    });

    it('应该保留格式和缩进', () => {
      const code = `Config = {
    Stats = {
        HP = 1000,
        MP = 500
    }
}`;
      const parser = new LuaParser(code);
      const result = parser.findNodeByPath('Config.Stats.HP');
      
      expect(result.success).toBe(true);
      
      const patcher = new LuaPatcher(code);
      const newCode = patcher.updateValue(result.node!, 2000);
      
      // 检查缩进保持不变
      expect(newCode).toContain('        HP = 2000');
    });
  });

  describe('formatLuaValue', () => {
    it('应该正确格式化数字', () => {
      const patcher = new LuaPatcher('');
      
      expect(patcher.formatLuaValue(100, 'number')).toBe('100');
      expect(patcher.formatLuaValue(3.14, 'number')).toBe('3.14');
      expect(patcher.formatLuaValue(-50, 'number')).toBe('-50');
    });

    it('应该正确格式化字符串', () => {
      const patcher = new LuaPatcher('');
      
      expect(patcher.formatLuaValue('hello', 'string')).toBe('"hello"');
      expect(patcher.formatLuaValue('with "quotes"', 'string')).toBe('"with \\"quotes\\""');
      expect(patcher.formatLuaValue('with\nnewline', 'string')).toBe('"with\\nnewline"');
    });

    it('应该正确格式化布尔值', () => {
      const patcher = new LuaPatcher('');
      
      expect(patcher.formatLuaValue(true, 'boolean')).toBe('true');
      expect(patcher.formatLuaValue(false, 'boolean')).toBe('false');
    });

    it('应该正确格式化 nil', () => {
      const patcher = new LuaPatcher('');
      
      expect(patcher.formatLuaValue(null, 'nil')).toBe('nil');
      expect(patcher.formatLuaValue(undefined, 'nil')).toBe('nil');
    });

    it('应该正确格式化简单数组', () => {
      const patcher = new LuaPatcher('');
      
      const result = patcher.formatLuaValue([1, 2, 3], 'table');
      expect(result).toBe('{ 1, 2, 3 }');
    });

    it('应该正确格式化简单对象', () => {
      const patcher = new LuaPatcher('');
      
      const result = patcher.formatLuaValue({ a: 1, b: 2 }, 'table');
      expect(result).toContain('a = 1');
      expect(result).toContain('b = 2');
    });
  });
});
