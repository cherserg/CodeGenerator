// src/services/sync-index.service.ts

import * as fs from "fs/promises";
import * as path from "path";
import {
  getWorkspaceRoot,
  showInfo,
  showWarning,
} from "../functions/vscode.functions";
import { FileCreatorService } from "./file-creator.service";
import * as rules from "./rules";
import { ISyncRule } from "./rules/rule.interface";

export class SyncIndexService {
  private readonly absIgnores: string[];
  private readonly masks: string[];
  private readonly rules: ISyncRule;
  private readonly fileService = new FileCreatorService();

  constructor(
    private baseDir: string,
    private syncExt: string = ".ts",
    ignorePatterns: string[] = [],
    private barrelName: string = "index",
    private syncSkipFoldersContaining: string[] = [],
  ) {
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

    const workspaceRoot = getWorkspaceRoot();
    let anyChanged = false;

    for (const dir of folders) {
      if (this.isIgnored(dir)) continue;

      const folderName = path.basename(dir);
      const shouldSkip = this.syncSkipFoldersContaining.some((marker) =>
        folderName.includes(marker),
      );

      if (shouldSkip) continue;

      try {
        const { folders: sub, files } = await this.collectModules(dir);
        // Генерируем только содержимое экспортов
        const rawBody = this.rules.generateContent(sub, files, this.syncExt);
        const indexFileName = `${this.barrelName}${this.syncExt}`;

        // Делегируем запись и проверку изменений сервису
        // Он сам добавит заголовок и проверит, нужно ли перезаписывать файл
        await this.fileService.save(dir, indexFileName, rawBody, workspaceRoot);

        anyChanged = true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showWarning(`Не удалось обработать папку "${dir}": ${message}`);
      }
    }

    showInfo("Процесс синхронизации завершен.");
    return true;
  }

  private async collectModules(
    dir: string,
  ): Promise<{ folders: string[]; files: string[] }> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });

    const folders = dirents
      .filter((d) => d.isDirectory() && !this.isIgnored(path.join(dir, d.name)))
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    const files = this.rules.collectFiles(dirents, this.barrelName);

    return { folders, files };
  }

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

  private globBody(mask: string): string {
    return mask
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "§§DOUBLE§§")
      .replace(/\*/g, "[^/]*")
      .replace(/§§DOUBLE§§/g, ".*");
  }
}
