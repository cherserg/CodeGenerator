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
    // Убираем предварительную фильтрацию здесь, так как она сработает внутри syncFolders
    return this.syncFolders(folders);
  }

  private async syncFolders(folders: string[]): Promise<boolean> {
    if (!folders.length) {
      showWarning("Нет директорий для синхронизации.");
      return false;
    }

    const workspaceRoot = getWorkspaceRoot();
    let anyChanged = false;

    for (const dir of folders) {
      // Приводим путь к единому формату для проверки
      const normalizedDir = dir.replace(/\\/g, "/").replace(/\/+$/, "");

      if (this.isIgnored(normalizedDir)) continue;

      const folderName = path.basename(normalizedDir);
      const shouldSkip = this.syncSkipFoldersContaining.some((marker) =>
        folderName.includes(marker),
      );

      if (shouldSkip) continue;

      try {
        const { folders: sub, files } =
          await this.collectModules(normalizedDir);
        const rawBody = this.rules.generateContent(sub, files, this.syncExt);
        const indexFileName = `${this.barrelName}${this.syncExt}`;

        await this.fileService.save(
          normalizedDir,
          indexFileName,
          rawBody,
          workspaceRoot,
        );
        anyChanged = true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showWarning(
          `Не удалось обработать папку "${normalizedDir}": ${message}`,
        );
      }
    }

    if (anyChanged) {
      showInfo("Процесс синхронизации завершен.");
    }
    return true;
  }

  private async collectModules(
    dir: string,
  ): Promise<{ folders: string[]; files: string[] }> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });

    const folders = dirents
      .filter((d) => {
        if (!d.isDirectory()) return false;
        const fullPath = path.join(dir, d.name).replace(/\\/g, "/");
        return !this.isIgnored(fullPath);
      })
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));

    const files = this.rules.collectFiles(dirents, this.barrelName);

    return { folders, files };
  }

  public isIgnored(absPath: string): boolean {
    const absNorm = absPath.replace(/\\/g, "/").replace(/\/+$/, "");

    // 1. Проверка по абсолютным путям
    for (const ig of this.absIgnores) {
      if (absNorm === ig || absNorm.startsWith(ig + "/")) return true;
    }

    // 2. Проверка по маскам относительно baseDir
    const rel = path
      .relative(this.baseDir, absNorm)
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");

    // Если путь выше baseDir, не игнорируем его по относительным маскам
    if (rel.startsWith("..")) return false;

    for (const mask of this.masks) {
      const body = this.globBody(mask);
      const regex = new RegExp(`(^|/)${body}(/|$)`);
      if (regex.test(rel) || regex.test(absNorm)) return true;
    }

    return false;
  }

  private globBody(mask: string): string {
    return mask
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*");
  }
}
