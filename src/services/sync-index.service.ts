// src/services/sync-index.service.ts

import * as fs from "fs/promises";
import { Dirent } from "fs";
import * as path from "path";
import prettier from "prettier";
import { showWarning, showInfo } from "../utils/vscode.utils";

/**
 * Сервис синхронизации index.ts во всех подпапках заданного корня.
 * Возвращает `true`, если хотя бы один файл был успешно перезаписан.
 */
export class SyncIndexService {
  /** Запускает обход и синхронизацию */
  public async run(rootDir: string): Promise<boolean> {
    const allFolders = await this.getAllSubfolders(rootDir);
    if (!allFolders.length) {
      showWarning(`В папке "${rootDir}" не найдено ни одной директории.`);
      return false;
    }

    let anySuccess = false;

    for (const dir of allFolders) {
      try {
        const { folders, tsFiles } = await this.collectModules(dir);
        const newContent = this.generateContent(folders, tsFiles);

        const indexPath = path.join(dir, "index.ts");
        await this.backupIfExists(indexPath);
        await this.writeFormatted(indexPath, newContent);

        anySuccess = true;
      } catch (err: any) {
        showWarning(`Не удалось обработать папку "${dir}": ${err.message}`);
      }
    }

    if (anySuccess) {
      showInfo("Синхронизация index.ts завершена.");
    }

    return anySuccess;
  }

  /* ------------------------------------------------------------------ */
  /* --------------------------  helpers  ----------------------------- */
  /* ------------------------------------------------------------------ */

  /** Рекурсивно собирает все подпапки (включая сам root) */
  private async getAllSubfolders(dir: string): Promise<string[]> {
    let results: string[] = [dir];
    let entries: Dirent[];

    try {
      entries = (await fs.readdir(dir, { withFileTypes: true })) as Dirent[];
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const full = path.join(dir, entry.name);
        results = results.concat(await this.getAllSubfolders(full));
      }
    }

    return results;
  }

  /** Возвращает списки подпапок и .ts-файлов (кроме index.ts) */
  private async collectModules(dir: string): Promise<{
    folders: string[];
    tsFiles: string[];
  }> {
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
      .map((d) => d.name.slice(0, -3)) // убираем .ts
      .sort((a, b) => a.localeCompare(b));

    return { folders, tsFiles };
  }

  /** Формирует итоговый текст index.ts */
  private generateContent(folders: string[], tsFiles: string[]): string {
    const lines: string[] = [
      "// Этот файл сгенерирован автоматически. Не редактируйте вручную.",
      "",
      ...folders.map((f) => `export * from './${f}';`),
      ...tsFiles.map((f) => `export * from './${f}';`),
      "",
    ];
    return lines.join("\n");
  }

  /** Делаем бэкап, если index.ts уже существует */
  private async backupIfExists(indexPath: string): Promise<void> {
    try {
      await fs.access(indexPath);
    } catch {
      return; // файла нет — бэкап не нужен
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

    const bakPath = `${indexPath}.bak.${ts}`;
    await fs.copyFile(indexPath, bakPath);
  }

  /** Форматируем через Prettier и записываем файл */
  private async writeFormatted(
    indexPath: string,
    content: string
  ): Promise<void> {
    let prettierConfig: prettier.Options | null = null;
    try {
      prettierConfig = await prettier.resolveConfig(indexPath);
    } catch {
      /* ignore */
    }

    let formatted: string;
    try {
      formatted = await prettier.format(content, {
        ...prettierConfig,
        parser: "typescript",
        filepath: indexPath,
      });
    } catch {
      formatted = content;
    }

    await fs.writeFile(indexPath, formatted, "utf8");
  }
}
