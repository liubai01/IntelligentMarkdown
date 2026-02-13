/**
 * 路径解析器
 * 处理相对路径和绝对路径的转换
 */

import * as path from 'path';

export class PathResolver {
  /**
   * 将相对路径解析为绝对路径
   * @param basePath 基准路径（通常是 Markdown 文件所在目录）
   * @param relativePath 相对路径
   */
  resolve(basePath: string, relativePath: string): string {
    // 如果已经是绝对路径，直接返回
    if (path.isAbsolute(relativePath)) {
      return this.normalizePath(relativePath);
    }

    // 解析相对路径
    const resolved = path.resolve(basePath, relativePath);
    return this.normalizePath(resolved);
  }

  /**
   * 计算从 fromPath 到 toPath 的相对路径
   */
  relative(fromPath: string, toPath: string): string {
    return path.relative(fromPath, toPath);
  }

  /**
   * 标准化路径（统一分隔符）
   */
  normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * 获取目录路径
   */
  dirname(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * 获取文件名
   */
  basename(filePath: string): string {
    return path.basename(filePath);
  }

  /**
   * 获取文件扩展名
   */
  extname(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * 判断是否是 Lua 文件
   */
  isLuaFile(filePath: string): boolean {
    return this.extname(filePath).toLowerCase() === '.lua';
  }

  /**
   * 判断是否是 Markdown 文件
   */
  isMarkdownFile(filePath: string): boolean {
    const ext = this.extname(filePath).toLowerCase();
    return ext === '.md' || ext === '.markdown';
  }
}
