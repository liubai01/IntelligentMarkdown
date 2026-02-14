/**
 * Path resolver
 * Handles relative and absolute path conversion
 */

import * as path from 'path';

export class PathResolver {
  /**
   * Resolve relative path to absolute path
   * @param basePath Base path (usually the Markdown file directory)
   * @param relativePath Relative path
   */
  resolve(basePath: string, relativePath: string): string {
    // If already absolute, return directly
    if (path.isAbsolute(relativePath)) {
      return this.normalizePath(relativePath);
    }

    // Resolve relative path
    const resolved = path.resolve(basePath, relativePath);
    return this.normalizePath(resolved);
  }

  /**
   * Calculate relative path from fromPath to toPath
   */
  relative(fromPath: string, toPath: string): string {
    return path.relative(fromPath, toPath);
  }

  /**
   * Normalize path (unify separators)
   */
  normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Get directory path
   */
  dirname(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * Get file name
   */
  basename(filePath: string): string {
    return path.basename(filePath);
  }

  /**
   * Get file extension
   */
  extname(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * Check if file is a Lua file
   */
  isLuaFile(filePath: string): boolean {
    return this.extname(filePath).toLowerCase() === '.lua';
  }

  /**
   * Check if file is a Markdown file
   */
  isMarkdownFile(filePath: string): boolean {
    const ext = this.extname(filePath).toLowerCase();
    return ext === '.md' || ext === '.markdown';
  }
}
