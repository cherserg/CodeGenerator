// src/services/sync-index.service.ts

import * as fs from "fs/promises";
import { Dirent } from "fs";
import * as path from "path";
import prettier from "prettier";
import { showWarning, showInfo } from "../utils/vscode.utils";

/**
 * Сервис синхронизации index.ts во всех подпапках baseDir.
 * Учитывает исключения из codegen.json → ignoreSync.
 */
export class SyncIndexService {
  /** Абсолютные пути, которые нужно пропускать целиком */
  private readonly absIgnores: string[];
  /** Относительные glob-маски для игнорирования */
  private readonly masks: string[];

  /**
   * @param baseDir        Абсолютный путь к корню сгенерированных файлов
   * @param ignorePatterns Массив путей или glob-масок из codegen.json
   */
  constructor(
    private baseDir: string,
    ignorePatterns: string[] = []
  ) {
    // Нормализуем baseDir
    this.baseDir = this.baseDir.replace(/\\/g, "/").replace(/\/+$/, "");

    // Разделяем абсолютные пути и относительные маски
    this.absIgnores = ignorePatterns
      .filter((p) => path.isAbsolute(p))
      .map((p) => p.replace(/\\/g, "/").replace(/\/+$/, ""));

    this.masks = ignorePatterns
      .filter((p) => !path.isAbsolute(p))
      .map((p) => p.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""));
  }

  /* ────────────── ПУБЛИЧНЫЕ МЕТОДЫ ────────────── */

  /** Полная синхронизация всего дерева baseDir. */
  public async run(): Promise<boolean> {
    const all = await this.collectAllSubfolders(this.baseDir);
    return this.syncFolders(all);
  }

  /**
   * Синхронизация только указанных директорий (абсолютные пути).
   */
  public async runOnFolders(folders: string[]): Promise<boolean> {
    const filtered = folders.filter((abs) => !this.isIgnored(abs));
    return this.syncFolders(filtered);
  }

  /** Проверка, подпадает ли путь под ignoreSync. */
  public isIgnored(absPath: string): boolean {
    const absNorm = absPath.replace(/\\/g, "/").replace(/\/+$/, "");

    // 1) Абсолютные исключения
    for (const ig of this.absIgnores) {
      if (absNorm === ig || absNorm.startsWith(ig + "/")) {
        return true;
      }
    }

    // 2) Относительный путь внутри baseDir
    const rel = path
      .relative(this.baseDir, absNorm)
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");

    if (!rel) {
      // это сам baseDir
      return false;
    }

    // 3) Glob-маски по относительному пути
    for (const mask of this.masks) {
      const body = this.globBody(mask);
      if (new RegExp(`^${body}$`).test(rel)) return true; // точное
      if (new RegExp(`${body}$`).test(absNorm)) return true; // суффикс
      if (new RegExp(`(^|/)${body}(/|$)`).test(absNorm)) return true; // внутри
    }

    return false;
  }

  /* ────────────── ВНУТРЕННЯЯ ЛОГИКА ────────────── */

  private async collectAllSubfolders(dir: string): Promise<string[]> {
    const result: string[] = [];
    if (this.isIgnored(dir)) return result;
    result.push(dir);

    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return result;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sub = path.join(dir, entry.name);
        result.push(...(await this.collectAllSubfolders(sub)));
      }
    }

    return result;
  }

  private async syncFolders(folders: string[]): Promise<boolean> {
    if (!folders.length) {
      showWarning("Нет директорий для синхронизации.");
      return false;
    }

    let anyChanged = false;

    for (const dir of folders) {
      if (this.isIgnored(dir)) continue;

      try {
        const { folders: sub, tsFiles } = await this.collectModules(dir);
        const raw = this.generateContent(sub, tsFiles);
        const idx = path.join(dir, "index.ts");
        const fmt = await this.formatWithPrettier(idx, raw);

        let existing: string | null = null;
        try {
          existing = await fs.readFile(idx, "utf8");
        } catch {
          // файла нет — создаём
        }

        if (existing !== null) {
          const oldBody = this.stripHeader(existing);
          const newBody = this.stripHeader(fmt);
          if (oldBody === newBody) continue;
        }

        await this.backupIfExists(idx);
        await fs.writeFile(idx, fmt, "utf8");
        anyChanged = true;
      } catch (err: any) {
        showWarning(`Не удалось обработать папку "${dir}": ${err.message}`);
      }
    }

    showInfo(
      anyChanged
        ? "Синхронизация index.ts завершена."
        : "index.ts уже актуальны. Изменений не обнаружено."
    );
    return true;
  }

  /* ────────────── УТИЛИТЫ ────────────── */

  private globBody(mask: string): string {
    return mask
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "§§DOUBLE§§")
      .replace(/\*/g, "[^/]*")
      .replace(/§§DOUBLE§§/g, ".*");
  }

  private async collectModules(
    dir: string
  ): Promise<{ folders: string[]; tsFiles: string[] }> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const folders = dirents
      .filter((d) => d.isDirectory() && !this.isIgnored(path.join(dir, d.name)))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    const tsFiles = dirents
      .filter(
        (d) =>
          d.isFile() &&
          (d.name.endsWith(".ts") || d.name.endsWith(".tsx")) &&
          d.name.toLowerCase() !== "index.ts" &&
          d.name.toLowerCase() !== "index.tsx"
      )
      .map((d) => {
        if (d.name.endsWith(".tsx")) {
          return d.name.slice(0, -4);
        } else {
          // .ts
          return d.name.slice(0, -3);
        }
      })
      .sort((a, b) => a.localeCompare(b));

    return { folders, tsFiles };
  }

  private generateContent(folders: string[], tsFiles: string[]): string {
    if (folders.length === 0 && tsFiles.length === 0) {
      return `export * from '.';\n`;
    }
    return [
      ...folders.map((f) => `export * from './${f}';`),
      ...tsFiles.map((f) => `export * from './${f}';`),
      "",
    ].join("\n");
  }

  private stripHeader(content: string): string {
    const lines = content.split("\n");
    let i = 0;
    while (i < lines.length && lines[i].trim().startsWith("//")) i++;
    return lines.slice(i).join("\n").trim();
  }

  private async backupIfExists(indexPath: string): Promise<void> {
    try {
      await fs.access(indexPath);
    } catch {
      return;
    }
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const ts =
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      "T" +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds());
    await fs.copyFile(indexPath, `${indexPath}.bak.${ts}`);
  }

  private async formatWithPrettier(
    filePath: string,
    content: string
  ): Promise<string> {
    let cfg = null;
    try {
      cfg = await prettier.resolveConfig(filePath);
    } catch {}
    try {
      return await prettier.format(content, {
        ...(cfg || {}),
        parser: "typescript",
        filepath: filePath,
      });
    } catch {
      return content;
    }
  }
}
