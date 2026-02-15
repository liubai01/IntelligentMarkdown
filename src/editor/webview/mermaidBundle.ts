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
 * Render all mermaid diagrams on the page.
 * After rendering, registers probe click callbacks for diagrams
 * that contain `data-probe-clicks` data.
 */
async function renderAll(): Promise<void> {
  initMermaid();

  const elements = document.querySelectorAll('.mermaid-diagram');

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement;
    const code = el.getAttribute('data-mermaid-code');
    if (!code) { continue; }

    // Register probe click callback BEFORE rendering
    // (Mermaid binds click handlers during render)
    registerProbeCallback(el, i);

    try {
      const id = `mermaid-svg-${i}-${Date.now()}`;
      const { svg } = await mermaid.render(id, code);
      el.innerHTML = svg;
      el.classList.add('mermaid-rendered');
      el.classList.remove('mermaid-error');

      // Style clickable nodes with a pointer cursor
      styleClickableNodes(el);
    } catch (err: any) {
      el.innerHTML = `<div class="mermaid-error-msg">⚠️ Mermaid render error: ${escapeHtml(err?.message || String(err))}</div>`;
      el.classList.add('mermaid-error');
      el.classList.remove('mermaid-rendered');
      console.error('Mermaid render error:', err);
    }
  }
}

/**
 * Register a global probe click callback for a mermaid diagram.
 * Mermaid calls `window.mermaidProbe_<index>(nodeId)` when a node is clicked.
 */
function registerProbeCallback(el: HTMLElement, diagramIndex: number): void {
  const probeDataRaw = el.getAttribute('data-probe-clicks');
  if (!probeDataRaw) { return; }

  try {
    const probeMap: Record<string, { file: string; line: number }> = JSON.parse(probeDataRaw);

    // Register the callback globally so Mermaid can call it
    (window as any)[`mermaidProbe_${diagramIndex}`] = function (nodeId: string) {
      const target = probeMap[nodeId];
      if (target && typeof (window as any).gotoProbe === 'function') {
        (window as any).gotoProbe(target.file, target.line);
      }
    };
  } catch (err) {
    console.error('Failed to parse probe click data:', err);
  }
}

/**
 * Add pointer cursor styling to clickable SVG nodes in a rendered diagram.
 */
function styleClickableNodes(el: HTMLElement): void {
  // Mermaid adds `cursor: pointer` and click handlers to nodes.
  // Additionally mark them with a class for extra styling.
  const clickableNodes = el.querySelectorAll('.clickable');
  clickableNodes.forEach(node => {
    (node as HTMLElement).style.cursor = 'pointer';
  });
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
