/**
 * Probe Scanner
 * Scans source files for @probe markers and resolves probe:// links
 *
 * Lua probe comment format:
 *   -- @probe:marker_name
 *
 * Markdown link format:
 *   [Display Text](probe://./relative/path.lua#marker_name)
 */

import * as fs from 'fs';
import * as path from 'path';

/** A single probe marker found in a source file */
export interface ProbeMarker {
  /** Probe name (the part after @probe:) */
  name: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (0-based) */
  column: number;
}

/** Resolved probe link target */
export interface ProbeTarget {
  /** Absolute file path */
  filePath: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (0-based) */
  column: number;
}

/** Probe link parsed from Markdown */
export interface ProbeLinkInfo {
  /** Full match string */
  fullMatch: string;
  /** Display text */
  displayText: string;
  /** Relative file path */
  filePath: string;
  /** Probe marker name */
  probeName: string;
  /** Start index of the link URL part (inside parentheses) */
  urlStart: number;
  /** End index of the link URL part */
  urlEnd: number;
  /** Start index of the full match */
  matchStart: number;
  /** End index of the full match */
  matchEnd: number;
}

/** Regex to match -- @probe:name in Lua files (also supports ---@probe name) */
const PROBE_MARKER_REGEX = /--\s*@probe[:\s]\s*(\S+)/g;

/** Regex to match [text](probe://path#name) in Markdown */
const PROBE_LINK_REGEX = /\[([^\]]*)\]\((probe:\/\/([^#\s)]+)#([^)\s]+))\)/g;

export class ProbeScanner {
  /** Cache: filePath -> { markers, mtime } */
  private cache: Map<string, { markers: ProbeMarker[]; mtime: number }> = new Map();

  /**
   * Scan a source file for @probe markers
   * @param filePath Absolute path to the file
   * @returns Array of probe markers found
   */
  scanFile(filePath: string): ProbeMarker[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    // Check cache
    const stats = fs.statSync(filePath);
    const cached = this.cache.get(filePath);
    if (cached && cached.mtime === stats.mtimeMs) {
      return cached.markers;
    }

    // Read and scan
    const content = fs.readFileSync(filePath, 'utf-8');
    const markers = this.scanContent(content);

    // Update cache
    this.cache.set(filePath, { markers, mtime: stats.mtimeMs });

    return markers;
  }

  /**
   * Scan text content for @probe markers
   */
  scanContent(content: string): ProbeMarker[] {
    const markers: ProbeMarker[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      PROBE_MARKER_REGEX.lastIndex = 0;

      let match;
      while ((match = PROBE_MARKER_REGEX.exec(line)) !== null) {
        markers.push({
          name: match[1],
          line: i + 1,     // 1-based
          column: match.index,
        });
      }
    }

    return markers;
  }

  /**
   * Find all probe:// links in Markdown text
   */
  findProbeLinks(markdownText: string): ProbeLinkInfo[] {
    const links: ProbeLinkInfo[] = [];
    PROBE_LINK_REGEX.lastIndex = 0;

    let match;
    while ((match = PROBE_LINK_REGEX.exec(markdownText)) !== null) {
      const fullMatch = match[0];
      const displayText = match[1];
      const fullUrl = match[2];   // probe://path#name
      const filePath = match[3];
      const probeName = match[4];

      // Calculate URL position within the full match
      const urlStartInMatch = fullMatch.indexOf('(') + 1;
      const urlEndInMatch = fullMatch.lastIndexOf(')');

      links.push({
        fullMatch,
        displayText,
        filePath,
        probeName,
        urlStart: match.index + urlStartInMatch,
        urlEnd: match.index + urlEndInMatch,
        matchStart: match.index,
        matchEnd: match.index + fullMatch.length,
      });
    }

    return links;
  }

  /**
   * Resolve a probe link to a file + line target
   * @param filePath Relative file path from probe URL
   * @param probeName Probe marker name
   * @param baseDir Base directory (usually the Markdown file's directory)
   * @returns Resolved target or null if not found
   */
  resolveProbe(filePath: string, probeName: string, baseDir: string): ProbeTarget | null {
    // Resolve to absolute path
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(baseDir, filePath);

    // Scan the file for probe markers
    const markers = this.scanFile(absolutePath);

    // Find the matching marker
    const marker = markers.find(m => m.name === probeName);
    if (!marker) {
      return null;
    }

    return {
      filePath: absolutePath,
      line: marker.line,
      column: marker.column,
    };
  }

  /**
   * Clear cache
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      this.cache.delete(filePath);
    } else {
      this.cache.clear();
    }
  }
}
