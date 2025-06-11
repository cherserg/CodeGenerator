// src/services/sync-index.service.ts
import * as fs from "fs/promises";
import { Dirent } from "fs";
import * as path from "path";
import prettier from "prettier";
import { showWarning, showInfo } from "../utils/vscode.utils";
import minimatch from "minimatch";

/**
 * Сервис синхронизации index.ts во всех подпапках заданного корня.
 * Позволяет игнорировать папки по glob-маскам.
 */
export class SyncIndexService {
  constructor(private ignorePatterns: string[] = []) {}

  public async run(rootDir: string): Promise<boolean> {
    const allFolders = await this.getAllSubfolders(rootDir);
    if (!allFolders.length) {
      showWarning(`В папке "${rootDir}" не найдено ни одной директории.`);
      return false;
    }
    return this.syncFolders(allFolders);
  }

  public async runOnFolders(foldersToSync: string[]): Promise<boolean> {
    if (!foldersToSync.length) {
      showWarning("Не выбраны папки для синхронизации.");
      return false;
    }
    return this.syncFolders(foldersToSync);
  }

  private async getAllSubfolders(dir: string): Promise<string[]> {
    // Если путь попадает под любую из масок — пропускаем всё поддерево
    if (this.ignorePatterns.some((pat) => minimatch(dir, pat))) {
      return [];
    }
    let results: string[] = [dir];
    let entries: Dirent[];
    try {
      entries = (await fs.readdir(dir, { withFileTypes: true })) as Dirent[];
    } catch {
      return results;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sub = path.join(dir, entry.name);
        results = results.concat(await this.getAllSubfolders(sub));
      }
    }
    return results;
  }

  private async syncFolders(folders: string[]): Promise<boolean> {
    let anyChanged = false;

    for (const dir of folders) {
      try {
        const { folders: sub, tsFiles } = await this.collectModules(dir);
        const rawNewContent = this.generateContent(sub, tsFiles);
        const indexPath = path.join(dir, "index.ts");
        const formattedNew = await this.formatWithPrettier(
          indexPath,
          rawNewContent
        );

        let existingRaw: string | null = null;
        try {
          existingRaw = await fs.readFile(indexPath, "utf8");
        } catch {
          /* нет файла */
        }

        if (existingRaw !== null) {
          const oldBody = this.stripHeader(existingRaw);
          const newBody = this.stripHeader(formattedNew);
          if (oldBody === newBody) continue;
        }

        await this.backupIfExists(indexPath);
        await fs.writeFile(indexPath, formattedNew, "utf8");
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

  private async collectModules(
    dir: string
  ): Promise<{ folders: string[]; tsFiles: string[] }> {
    const dirents = (await fs.readdir(dir, {
      withFileTypes: true,
    })) as Dirent[];
    const folders = dirents
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort((a, b) => a.localeCompare(b));
    const tsFiles = dirents
      .filter(
        (d) =>
          d.isFile() &&
          d.name.endsWith(".ts") &&
          d.name.toLowerCase() !== "index.ts"
      )
      .map((d) => d.name.slice(0, -3))
      .sort((a, b) => a.localeCompare(b));
    return { folders, tsFiles };
  }

  private generateContent(folders: string[], tsFiles: string[]): string {
    if (folders.length === 0 && tsFiles.length === 0) {
      return `export * from '.';\n`;
    }
    const lines = [
      ...folders.map((f) => `export * from './${f}';`),
      ...tsFiles.map((f) => `export * from './${f}';`),
      "",
    ];
    return lines.join("\n");
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
    let prettierConfig = null;
    try {
      prettierConfig = await prettier.resolveConfig(filePath);
    } catch {}
    try {
      return await prettier.format(content, {
        ...(prettierConfig || {}),
        parser: "typescript",
        filepath: filePath,
      });
    } catch {
      return content;
    }
  }
}
