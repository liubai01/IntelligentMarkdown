/**
 * 配置块解析器单元测试
 */

import { describe, it, expect } from 'vitest';
import { ConfigBlockParser } from '../../src/core/parser/configBlockParser';

describe('ConfigBlockParser', () => {
  const parser = new ConfigBlockParser();

  describe('parseMarkdown', () => {
    it('应该能解析简单的配置块', () => {
      const markdown = `
# 测试

\`\`\`lua-config
file: ./config.lua
key: Config.Value
type: number
\`\`\`
`;
      const blocks = parser.parseMarkdown(markdown);
      
      expect(blocks.length).toBe(1);
      expect(blocks[0].file).toBe('./config.lua');
      expect(blocks[0].key).toBe('Config.Value');
      expect(blocks[0].type).toBe('number');
    });

    it('应该能解析多个配置块', () => {
      const markdown = `
# 配置

\`\`\`lua-config
file: ./config.lua
key: Config.HP
type: number
\`\`\`

\`\`\`lua-config
file: ./config.lua
key: Config.Name
type: string
\`\`\`
`;
      const blocks = parser.parseMarkdown(markdown);
      
      expect(blocks.length).toBe(2);
      expect(blocks[0].key).toBe('Config.HP');
      expect(blocks[1].key).toBe('Config.Name');
    });

    it('应该解析完整的配置属性', () => {
      const markdown = `
\`\`\`lua-config
file: ./player.lua
key: Player.Stats.HP
type: slider
label: 生命值
min: 0
max: 1000
step: 10
unit: 点
\`\`\`
`;
      const blocks = parser.parseMarkdown(markdown);
      
      expect(blocks.length).toBe(1);
      const block = blocks[0];
      expect(block.label).toBe('生命值');
      expect(block.min).toBe(0);
      expect(block.max).toBe(1000);
      expect(block.step).toBe(10);
      expect(block.unit).toBe('点');
    });

    it('应该解析 range 属性', () => {
      const markdown = `
\`\`\`lua-config
file: ./config.lua
key: Config.Speed
type: slider
range: [100, 500]
\`\`\`
`;
      const blocks = parser.parseMarkdown(markdown);
      
      expect(blocks.length).toBe(1);
      expect(blocks[0].min).toBe(100);
      expect(blocks[0].max).toBe(500);
    });

    it('应该解析 select 的 options', () => {
      const markdown = `
\`\`\`lua-config
file: ./config.lua
key: Config.Language
type: select
options:
  - { value: "en", label: "English" }
  - { value: "zh", label: "中文" }
\`\`\`
`;
      const blocks = parser.parseMarkdown(markdown);
      
      expect(blocks.length).toBe(1);
      expect(blocks[0].options).toBeDefined();
      expect(blocks[0].options?.length).toBe(2);
      expect(blocks[0].options?.[0].value).toBe('en');
      expect(blocks[0].options?.[1].label).toBe('中文');
    });

    it('应该记录正确的行号', () => {
      const markdown = `第一行
第二行
\`\`\`lua-config
file: ./config.lua
key: Config.Value
type: number
\`\`\`
`;
      const blocks = parser.parseMarkdown(markdown);
      
      expect(blocks.length).toBe(1);
      expect(blocks[0].startLine).toBe(3);
    });

    it('没有配置块时应返回空数组', () => {
      const markdown = `# 普通 Markdown

这是一个普通的文档。

\`\`\`javascript
const x = 1;
\`\`\`
`;
      const blocks = parser.parseMarkdown(markdown);
      
      expect(blocks.length).toBe(0);
    });
  });

  describe('parseConfigContent', () => {
    it('缺少必需字段时应返回错误', () => {
      const result = parser.parseConfigContent('file: ./config.lua');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('key');
    });

    it('无效类型时应返回错误', () => {
      const result = parser.parseConfigContent(`
file: ./config.lua
key: Config.Value
type: invalid_type
`);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('type');
    });
  });

  describe('validateConfigBlock', () => {
    it('应该验证 min > max 的情况', () => {
      const block = {
        file: './config.lua',
        key: 'Config.Value',
        type: 'number' as const,
        min: 100,
        max: 50
      };
      
      const errors = parser.validateConfigBlock(block);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('min'))).toBe(true);
    });

    it('应该验证 select 类型需要 options', () => {
      const block = {
        file: './config.lua',
        key: 'Config.Value',
        type: 'select' as const
      };
      
      const errors = parser.validateConfigBlock(block);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('options'))).toBe(true);
    });
  });
});
