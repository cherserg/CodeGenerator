// src/services/sync-index.service.ts

import * as fs from "fs/promises";
import { Dirent } from "fs";
import * as path from "path";
import prettier from "prettier";
import { showWarning, showInfo } from "../utils/vscode.utils";

/**
 * Сервис синхронизации index-файлов во всех подпапках baseDir.
 * Учитывает исключения из codegen.json → ignoreSync.
 */
export class SyncIndexService {
  /** Абсолютные пути, которые нужно пропускать целиком */
  private readonly absIgnores: string[];
  /** Относительные glob-маски для игнорирования */
  private readonly masks: string[];

  /**
   * @param baseDir        Абсолютный путь к корню сгенерированных файлов
   * @param syncExt        Расширение для index-файлов (например, ".ts")
   * @param ignorePatterns Массив путей или glob-масок из codegen.json
   */
  constructor(
    private baseDir: string,
    private syncExt: string = ".ts",
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

  public async run(): Promise<boolean> {
    const all = await this.collectAllSubfolders(this.baseDir);
    return this.syncFolders(all);
  }

  public async runOnFolders(folders: string[]): Promise<boolean> {
    const filtered = folders.filter((abs) => !this.isIgnored(abs));
    return this.syncFolders(filtered);
  }

  public isIgnored(absPath: string): boolean {
    const absNorm = absPath.replace(/\\/g, "/").replace(/\/+$/, "");

    for (const ig of this.absIgnores) {
      if (absNorm === ig || absNorm.startsWith(ig + "/")) {
        return true;
      }
    }

    const rel = path
      .relative(this.baseDir, absNorm)
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");

    if (!rel) {
      return false;
    }

    for (const mask of this.masks) {
      const body = this.globBody(mask);
      if (new RegExp(`^${body}$`).test(rel)) return true;
      if (new RegExp(`${body}$`).test(absNorm)) return true;
      if (new RegExp(`(^|/)${body}(/|$)`).test(absNorm)) return true;
    }

    return false;
  }

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
        const { folders: sub, files } = await this.collectModules(dir);
        const raw = this.generateContent(sub, files);
        const indexFileName = `index${this.syncExt}`;
        const idx = path.join(dir, indexFileName);
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
        ? "Синхронизация index-файлов завершена."
        : "index-файлы уже актуальны. Изменений не обнаружено."
    );
    return true;
  }

  private globBody(mask: string): string {
    return mask
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "§§DOUBLE§§")
      .replace(/\*/g, "[^/]*")
      .replace(/§§DOUBLE§§/g, ".*");
  }

  /**
   * ИЗМЕНЕНО: Теперь ищет файлы с расширением this.syncExt, а не только .ts/.tsx
   */
  private async collectModules(
    dir: string
  ): Promise<{ folders: string[]; files: string[] }> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const folders = dirents
      .filter((d) => d.isDirectory() && !this.isIgnored(path.join(dir, d.name)))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    const indexFileNameWithExt = `index${this.syncExt}`;

    const files = dirents
      .filter((d) => {
        const lowerName = d.name.toLowerCase();
        if (!d.isFile()) return false;

        // Ищем файлы с нужным расширением
        const isExportable = lowerName.endsWith(this.syncExt.toLowerCase());
        // Игнорируем сам index-файл
        const isIndexFile = lowerName === indexFileNameWithExt.toLowerCase();

        return isExportable && !isIndexFile;
      })
      .map((d) => d.name.slice(0, -this.syncExt.length)) // Обрезаем расширение
      .sort((a, b) => a.localeCompare(b));

    return { folders, files };
  }

  /**
   * ИЗМЕНЕНО: Генерирует разный синтаксис экспорта для Dart и для TS/JS.
   */
  private generateContent(folders: string[], files: string[]): string {
    if (folders.length === 0 && files.length === 0) {
      return ``; // Возвращаем пустую строку для Dart, а не 'export * from "."'.
    }

    // Для Dart используется другой синтаксис
    if (this.syncExt === ".dart") {
      const folderExports = folders.map((f) => `export '${f}/index.dart';`);
      const fileExports = files.map((f) => `export '${f}${this.syncExt}';`);
      return [...folderExports, ...fileExports, ""].join("\n");
    }

    // Стандартное поведение для TS/JS
    const folderExports = folders.map((f) => `export * from './${f}';`);
    const fileExports = files.map((f) => `export * from './${f}';`);
    return [...folderExports, ...fileExports, ""].join("\n");
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

    const extension = path.extname(filePath).toLowerCase();

    // ИЗМЕНЕНО: Неправильный тип prettier.ParserName заменен на string
    let parser: string | undefined;

    switch (extension) {
      case ".ts":
      case ".tsx":
        parser = "typescript";
        break;
      case ".js":
      case ".jsx":
        parser = "babel";
        break;
      case ".json":
        parser = "json";
        break;
      case ".dart":
        parser = "dart"; // Требует плагина @prettier/plugin-dart
        break;
      default:
        // Для неизвестных расширений форматирование не применяется
        return content;
    }

    try {
      return await prettier.format(content, {
        ...(cfg || {}),
        parser,
        filepath: filePath,
      });
    } catch (e) {
      // Если форматирование не удалось (например, нет плагина),
      // просто возвращаем исходный контент.
      return content;
    }
  }
}
