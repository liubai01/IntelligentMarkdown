import * as path from 'path';

export function normalizeIndentation(code: string): { normalized: string; baseIndent: string } {
  const lines = code.split('\n');
  if (lines.length <= 1) { return { normalized: code, baseIndent: '' }; }

  let minIndent = Infinity;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') { continue; }
    const match = line.match(/^(\s+)/);
    const indent = match ? match[1].length : 0;
    minIndent = Math.min(minIndent, indent);
  }

  if (minIndent === 0 || minIndent === Infinity) { return { normalized: code, baseIndent: '' }; }

  const refLine = lines.find((l, i) => i > 0 && l.trim() !== '');
  const baseIndent = refLine ? refLine.substring(0, minIndent) : ' '.repeat(minIndent);
  const normalizedLines = lines.map((line, i) => {
    if (i === 0) { return line; }
    if (line.trim() === '') { return ''; }
    return line.substring(minIndent);
  });

  return { normalized: normalizedLines.join('\n'), baseIndent };
}

export function denormalizeIndentation(code: string, baseIndent: string): string {
  if (!baseIndent) { return code; }
  const lines = code.split('\n');
  return lines.map((line, i) => {
    if (i === 0) { return line; }
    if (line.trim() === '') { return line; }
    return baseIndent + line;
  }).join('\n');
}

export function getLanguageFromFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    '.lua': 'lua', '.js': 'javascript', '.ts': 'typescript',
    '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
    '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.h': 'c',
    '.cs': 'csharp', '.sh': 'bash', '.sql': 'sql', '.json': 'json',
    '.xml': 'xml', '.html': 'html', '.css': 'css', '.yaml': 'yaml',
    '.yml': 'yaml', '.toml': 'ini', '.md': 'markdown',
  };
  return langMap[ext] || 'plaintext';
}

export function processInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function slugify(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function simpleMarkdownToHtml(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inBlockquote = false;
  let blockquoteLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === ''
      && (result.length > 0 && (result[result.length - 1].includes('__CONFIG_BLOCK_PLACEHOLDER_')
      || result[result.length - 1].includes('__MERMAID_BLOCK_PLACEHOLDER_')))) {
      continue;
    }
    if (line.trim() === ''
      && i + 1 < lines.length
      && (lines[i + 1].includes('__CONFIG_BLOCK_PLACEHOLDER_') || lines[i + 1].includes('__MERMAID_BLOCK_PLACEHOLDER_'))) {
      continue;
    }

    if (line.startsWith('> ')) {
      if (!inBlockquote) {
        inBlockquote = true;
        blockquoteLines = [];
      }
      blockquoteLines.push(line.slice(2));
      continue;
    } else if (inBlockquote) {
      result.push(`<blockquote>${blockquoteLines.join('<br>')}</blockquote>`);
      inBlockquote = false;
      blockquoteLines = [];
    }

    if (line.startsWith('### ')) {
      const heading = line.slice(4);
      result.push(`<h3 id="${slugify(heading)}">${processInlineMarkdown(heading)}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      const heading = line.slice(3);
      result.push(`<h2 id="${slugify(heading)}">${processInlineMarkdown(heading)}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      const heading = line.slice(2);
      result.push(`<h1 id="${slugify(heading)}">${processInlineMarkdown(heading)}</h1>`);
      continue;
    }

    if (line.includes('__CONFIG_BLOCK_PLACEHOLDER_') || line.includes('__MERMAID_BLOCK_PLACEHOLDER_')) {
      result.push(line);
      continue;
    }

    if (line.trim() === '') {
      const lastLine = result[result.length - 1] || '';
      if (lastLine
        && !lastLine.endsWith('</h1>')
        && !lastLine.endsWith('</h2>')
        && !lastLine.endsWith('</h3>')
        && !lastLine.endsWith('</blockquote>')
        && !lastLine.includes('__CONFIG_BLOCK_PLACEHOLDER_')
        && !lastLine.includes('__MERMAID_BLOCK_PLACEHOLDER_')) {
        result.push('<br>');
      }
      continue;
    }

    result.push(`<p>${processInlineMarkdown(line)}</p>`);
  }

  if (inBlockquote && blockquoteLines.length > 0) {
    result.push(`<blockquote>${blockquoteLines.join('<br>')}</blockquote>`);
  }

  return result.join('\n');
}

export function formatValue(value: any): string {
  try {
    if (value === null || value === undefined) {
      return 'nil';
    }
    if (typeof value === 'object') {
      const serialized = JSON.stringify(value);
      return serialized ?? '[object]';
    }
    return String(value);
  } catch {
    return '[unserializable]';
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
