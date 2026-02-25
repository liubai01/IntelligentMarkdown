/**
 * Markdown 链接渲染与路径解析单元测试
 *
 * 验证 preview webview 中的链接能被正确渲染，
 * 以及 handleOpenLink 的路径解析逻辑。
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';

const fixturesDir = path.resolve(__dirname, '../fixtures/markdown');

describe('Markdown link rendering', () => {
  const md = new MarkdownIt({ html: true, linkify: true });

  it('should preserve relative .md links in rendered HTML', () => {
    const html = md.render('[Link Target](./link_target.md)');
    expect(html).toContain('href="./link_target.md"');
    expect(html).toContain('>Link Target</a>');
  });

  it('should preserve external https links', () => {
    const html = md.render('[VS Code](https://code.visualstudio.com/)');
    expect(html).toContain('href="https://code.visualstudio.com/"');
  });

  it('should preserve anchor links', () => {
    const html = md.render('[Jump](#some-section)');
    expect(html).toContain('href="#some-section"');
  });

  it('should auto-linkify bare URLs when linkify is enabled', () => {
    const html = md.render('Visit https://example.com/auto for details.');
    expect(html).toContain('href="https://example.com/auto"');
  });

  it('should render the full links fixture without errors', () => {
    const fixturePath = path.join(fixturesDir, 'links.config.md');
    const content = fs.readFileSync(fixturePath, 'utf-8');
    const html = md.render(content);

    // Relative links
    expect(html).toContain('href="./link_target.md"');
    expect(html).toContain('href="../lua-config/player.config.md"');

    // External links
    expect(html).toContain('href="https://code.visualstudio.com/"');
    expect(html).toContain('href="https://github.com/liubai01/IntelligentMarkdown"');

    // Anchor links
    expect(html).toContain('href="#5-mixed-content"');
    expect(html).toContain('href="#2-external-links"');
  });
});

describe('Link path resolution logic', () => {
  /**
   * Mirrors the resolution logic in handleOpenLink:
   *   path.resolve(mdDir, href)
   */
  function resolveLink(mdFilePath: string, href: string): string {
    const mdDir = path.dirname(mdFilePath);
    return path.resolve(mdDir, href);
  }

  const mdFile = path.join(fixturesDir, 'links.config.md');

  it('should resolve same-directory relative link', () => {
    const resolved = resolveLink(mdFile, './link_target.md');
    expect(resolved).toBe(path.join(fixturesDir, 'link_target.md'));
  });

  it('should resolve parent-directory relative link', () => {
    const resolved = resolveLink(mdFile, '../lua-config/player.config.md');
    expect(resolved).toBe(
      path.resolve(fixturesDir, '..', 'lua-config', 'player.config.md')
    );
  });

  it('resolved target file should actually exist on disk', () => {
    const resolved = resolveLink(mdFile, './link_target.md');
    expect(fs.existsSync(resolved)).toBe(true);
  });

  it('should resolve cross-directory fixture link', () => {
    const resolved = resolveLink(mdFile, '../lua-config/player.config.md');
    expect(fs.existsSync(resolved)).toBe(true);
  });
});

describe('Link type classification', () => {
  function classifyLink(href: string): 'external' | 'anchor' | 'file' {
    if (/^https?:\/\//i.test(href)) { return 'external'; }
    if (href.startsWith('#')) { return 'anchor'; }
    return 'file';
  }

  it('should classify http links as external', () => {
    expect(classifyLink('https://example.com')).toBe('external');
    expect(classifyLink('http://example.com')).toBe('external');
  });

  it('should classify anchor links', () => {
    expect(classifyLink('#section-1')).toBe('anchor');
  });

  it('should classify relative paths as file links', () => {
    expect(classifyLink('./other.md')).toBe('file');
    expect(classifyLink('../dir/file.md')).toBe('file');
    expect(classifyLink('subfolder/readme.md')).toBe('file');
  });
});
