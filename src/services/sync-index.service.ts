// src/services/sync-index.service.ts

import * as fs from "fs/promises";
import { Dirent } from "fs";
import * as path from "path";
import prettier from "prettier";
import { showWarning, showInfo } from "../utils/vscode.utils";
import { ISyncRule } from "./rules/rule.interface";
import * as rules from "./rules";

export class SyncIndexService {
  private readonly absIgnores: string[];
  private readonly masks: string[];
  private readonly rules: ISyncRule;

  constructor(
    private baseDir: string,
    private syncExt: string = ".ts",
    ignorePatterns: string[] = []
  ) {
    // Выбираем подходящий набор правил или используем TS-правила по умолчанию
    this.rules = rules.ruleRegistry[syncExt.toLowerCase()] || rules.tsRules;

    this.baseDir = this.baseDir.replace(/\\/g, "/").replace(/\/+$/, "");

    this.absIgnores = ignorePatterns
      .filter((p) => path.isAbsolute(p))
      .map((p) => p.replace(/\\/g, "/").replace(/\/+$/, ""));

    this.masks = ignorePatterns
      .filter((p) => !path.isAbsolute(p))
      .map((p) => p.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""));
  }

  public async runOnFolders(folders: string[]): Promise<boolean> {
    const filtered = folders.filter((abs) => !this.isIgnored(abs));
    return this.syncFolders(filtered);
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
        // Делегируем генерацию контента правилам
        const raw = this.rules.generateContent(sub, files, this.syncExt);

        const indexFileName = `index${this.syncExt}`;
        const idx = path.join(dir, indexFileName);

        // Не создаем пустые файлы
        if (!raw.trim()) {
          // Если файл существует, но должен быть пустым, удаляем его
          try {
            await fs.unlink(idx);
            anyChanged = true;
          } catch (e) {
            /* Файла и так не было, все ок */
          }
          continue;
        }

        const fmt = await this.formatWithPrettier(idx, raw);

        let existing: string | null = null;
        try {
          existing = await fs.readFile(idx, "utf8");
        } catch {}

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

  private async collectModules(
    dir: string
  ): Promise<{ folders: string[]; files: string[] }> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });

    const folders = dirents
      .filter((d) => d.isDirectory() && !this.isIgnored(path.join(dir, d.name)))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    const indexFileName = `index${this.syncExt}`;

    // Делегируем сбор файлов правилам
    const files = this.rules.collectFiles(dirents, indexFileName);

    return { folders, files };
  }

  // --- Вспомогательные методы без изменений ---

  public isIgnored(absPath: string): boolean {
    const absNorm = absPath.replace(/\\/g, "/").replace(/\/+$/, "");
    for (const ig of this.absIgnores) {
      if (absNorm === ig || absNorm.startsWith(ig + "/")) return true;
    }
    const rel = path
      .relative(this.baseDir, absNorm)
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");
    if (!rel) return false;
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

  private globBody(mask: string): string {
    return mask
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "§§DOUBLE§§")
      .replace(/\*/g, "[^/]*")
      .replace(/§§DOUBLE§§/g, ".*");
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
        parser = "dart";
        break;
      default:
        return content;
    }
    try {
      return await prettier.format(content, {
        ...(cfg || {}),
        parser,
        filepath: filePath,
      });
    } catch (e) {
      return content;
    }
  }
}
