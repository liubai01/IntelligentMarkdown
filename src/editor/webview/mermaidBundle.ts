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

/** Parsed probe data per node */
interface ProbeTarget {
  file: string;
  line: number;
  target: string;
  fileName: string;
}

/**
 * Render all mermaid diagrams on the page.
 * After rendering, registers probe click callbacks and adds hover feedback
 * for diagrams that contain `data-probe-clicks` data.
 */
async function renderAll(): Promise<void> {
  initMermaid();

  const elements = document.querySelectorAll('.mermaid-diagram');

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement;
    const code = el.getAttribute('data-mermaid-code');
    if (!code) { continue; }

    // Register probe click callback BEFORE rendering
    // (Mermaid binds click handlers during render via bindFunctions)
    const probeMap = registerProbeCallback(el, i);

    try {
      const id = `mermaid-svg-${i}-${Date.now()}`;
      const { svg, bindFunctions } = await mermaid.render(id, code);
      el.innerHTML = svg;
      el.classList.add('mermaid-rendered');
      el.classList.remove('mermaid-error');

      // CRITICAL: call bindFunctions to wire up click event handlers
      if (bindFunctions) {
        bindFunctions(el);
      }

      // Add hover tooltips and visual feedback to probe-clickable nodes
      if (probeMap) {
        addProbeHoverFeedback(el, probeMap);
      }
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
 * Returns the parsed probe map for later use (hover feedback), or null.
 */
function registerProbeCallback(
  el: HTMLElement,
  diagramIndex: number
): Record<string, ProbeTarget> | null {
  const probeDataRaw = el.getAttribute('data-probe-clicks');
  if (!probeDataRaw) { return null; }

  try {
    const probeMap: Record<string, ProbeTarget> = JSON.parse(probeDataRaw);

    // Register the callback globally so Mermaid can call it
    (window as any)[`mermaidProbe_${diagramIndex}`] = function (nodeId: string) {
      const target = probeMap[nodeId];
      if (target && typeof (window as any).gotoProbe === 'function') {
        (window as any).gotoProbe(target.file, target.line);
      }
    };

    return probeMap;
  } catch (err) {
    console.error('Failed to parse probe click data:', err);
    return null;
  }
}

/**
 * Add hover feedback (tooltip + visual styling) to SVG nodes that have probe targets.
 * Finds rendered nodes by their Mermaid-generated IDs and attaches:
 *   - A <title> element for native browser tooltip
 *   - A CSS class for hover glow/outline effect
 *   - A small probe indicator badge
 */
function addProbeHoverFeedback(
  container: HTMLElement,
  probeMap: Record<string, ProbeTarget>
): void {
  const svg = container.querySelector('svg');
  if (!svg) { return; }

  // Inject hover styles into SVG (scoped to this diagram)
  injectProbeStyles(svg);

  for (const [nodeId, target] of Object.entries(probeMap)) {
    // Mermaid generates nodes with various id patterns.
    // Common patterns: flowchart-<nodeId>-<N>, or just the nodeId in g.node elements.
    const nodeEl = findMermaidNode(svg, nodeId);
    if (!nodeEl) { continue; }

    // Add probe-clickable class for hover styling
    nodeEl.classList.add('probe-clickable-node');

    // Add a native tooltip via <title> element
    const tooltipText = `📍 ${target.target}\n${target.fileName}:${target.line}\nClick to jump to source`;
    const existingTitle = nodeEl.querySelector(':scope > title');
    if (existingTitle) {
      existingTitle.textContent = tooltipText;
    } else {
      const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      titleEl.textContent = tooltipText;
      nodeEl.prepend(titleEl);
    }

    // Add a small probe badge indicator to the node
    addProbeBadge(svg, nodeEl, target);
  }
}

/**
 * Find a Mermaid-rendered SVG node by its logical nodeId.
 * Mermaid uses various naming conventions depending on diagram type.
 */
function findMermaidNode(svg: SVGSVGElement, nodeId: string): SVGGElement | null {
  // Strategy 1: Look for g.node elements with matching id attribute containing nodeId
  const allNodes = svg.querySelectorAll('g.node');
  for (let i = 0; i < allNodes.length; i++) {
    const node = allNodes[i];
    const id = node.getAttribute('id') || '';
    // Mermaid flowchart pattern: "flowchart-<nodeId>-<number>"
    if (id === nodeId || id.includes(`-${nodeId}-`) || id.startsWith(`flowchart-${nodeId}-`)) {
      return node as SVGGElement;
    }
  }

  // Strategy 2: Look for data-id attribute (some Mermaid versions)
  const byDataId = svg.querySelector(`g.node[data-id="${nodeId}"]`);
  if (byDataId) { return byDataId as SVGGElement; }

  // Strategy 3: Look for elements with id containing the nodeId
  const byPartialId = svg.querySelector(`[id*="${nodeId}"]`);
  if (byPartialId) {
    // Walk up to find the containing g.node
    let el: Element | null = byPartialId;
    while (el && !(el.tagName === 'g' && el.classList.contains('node'))) {
      el = el.parentElement;
    }
    if (el) { return el as SVGGElement; }
  }

  return null;
}

/**
 * Inject CSS styles for probe-clickable nodes into the SVG.
 */
function injectProbeStyles(svg: SVGSVGElement): void {
  // Avoid duplicate injection
  if (svg.querySelector('style.probe-styles')) { return; }

  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.classList.add('probe-styles');
  style.textContent = `
    .probe-clickable-node {
      cursor: pointer !important;
    }
    .probe-clickable-node > rect,
    .probe-clickable-node > circle,
    .probe-clickable-node > polygon,
    .probe-clickable-node > path,
    .probe-clickable-node > .label-container {
      transition: filter 0.2s ease, stroke 0.2s ease, stroke-width 0.2s ease;
    }
    .probe-clickable-node:hover > rect,
    .probe-clickable-node:hover > circle,
    .probe-clickable-node:hover > polygon,
    .probe-clickable-node:hover > path,
    .probe-clickable-node:hover > .label-container {
      filter: brightness(1.15) drop-shadow(0 0 6px rgba(56, 132, 255, 0.6));
      stroke: #3884ff !important;
      stroke-width: 2px !important;
    }
    .probe-badge {
      pointer-events: none;
      opacity: 0.8;
      transition: opacity 0.2s ease;
    }
    .probe-clickable-node:hover .probe-badge {
      opacity: 1;
    }
  `;
  svg.prepend(style);
}

/**
 * Add a small 📍 badge indicator to the top-right corner of a node.
 */
function addProbeBadge(svg: SVGSVGElement, nodeEl: SVGGElement, _target: ProbeTarget): void {
  try {
    const bbox = nodeEl.getBBox();
    if (bbox.width === 0 && bbox.height === 0) { return; }

    const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    badge.classList.add('probe-badge');
    badge.setAttribute('x', String(bbox.x + bbox.width - 4));
    badge.setAttribute('y', String(bbox.y + 4));
    badge.setAttribute('font-size', '10');
    badge.setAttribute('text-anchor', 'end');
    badge.setAttribute('dominant-baseline', 'hanging');
    badge.textContent = '📍';

    nodeEl.appendChild(badge);
  } catch (_e) {
    // getBBox can throw if element is not rendered — silently ignore
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
