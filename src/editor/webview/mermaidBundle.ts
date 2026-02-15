/**
 * Mermaid bundle for webview diagram rendering
 * This file is bundled separately and loaded in the VS Code webview.
 */

import mermaid from 'mermaid';

/**
 * Initialize mermaid with theme detection
 */
function initMermaid(): void {
  const dark = document.body.classList.contains('vscode-dark') ||
    document.body.classList.contains('vscode-high-contrast');

  mermaid.initialize({
    startOnLoad: false,
    theme: dark ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
    },
    sequence: {
      useMaxWidth: true,
    },
    gantt: {
      useMaxWidth: true,
    },
  });
}

/**
 * Render all mermaid diagrams on the page
 */
async function renderAll(): Promise<void> {
  initMermaid();

  const elements = document.querySelectorAll('.mermaid-diagram');

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement;
    const code = el.getAttribute('data-mermaid-code');
    if (!code) { continue; }

    try {
      const id = `mermaid-svg-${i}-${Date.now()}`;
      const { svg } = await mermaid.render(id, code);
      el.innerHTML = svg;
      el.classList.add('mermaid-rendered');
      el.classList.remove('mermaid-error');
    } catch (err: any) {
      el.innerHTML = `<div class="mermaid-error-msg">⚠️ Mermaid render error: ${escapeHtml(err?.message || String(err))}</div>`;
      el.classList.add('mermaid-error');
      el.classList.remove('mermaid-rendered');
      console.error('Mermaid render error:', err);
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Expose globally
(window as any).MermaidRenderer = {
  renderAll,
  initMermaid,
};
