// src/services/sync-index.service.ts

import * as fs from "fs/promises";
import { Dirent } from "fs";
import * as path from "path";
import prettier from "prettier";
import { showWarning, showInfo } from "../utils/vscode.utils";

/**
 * Сервис синхронизации index.ts во всех подпапках заданного корня.
 * Создаёт резервную копию и перезаписывает файл **только** если
 * «тело» (контент без шапки-комментария) действительно изменилось.
 */
export class SyncIndexService {
  /* ------------------------------------------------------------------ */
  /* -------------------------  public API  --------------------------- */
  /* ------------------------------------------------------------------ */

  /** Обходит всё дерево от rootDir рекурсивно. */
  public async run(rootDir: string): Promise<boolean> {
    const allFolders = await this.getAllSubfolders(rootDir);
    if (!allFolders.length) {
      showWarning(`В папке "${rootDir}" не найдено ни одной директории.`);
      return false;
    }

    return this.syncFolders(allFolders);
  }

  /**
   * Синхронизирует index.ts только в указанных директориях
   * (без рекурсивного обхода их потомков).
   */
  public async runOnFolders(foldersToSync: string[]): Promise<boolean> {
    if (!foldersToSync.length) {
      showWarning("Не выбраны папки для синхронизации.");
      return false;
    }

    return this.syncFolders(foldersToSync);
  }

  /* ------------------------------------------------------------------ */
  /* ------------------------  core routine  -------------------------- */
  /* ------------------------------------------------------------------ */

  /** Основная логика синхронизации для набора папок. */
  private async syncFolders(folders: string[]): Promise<boolean> {
    let anyChanged = false;

    for (const dir of folders) {
      try {
        const { folders: sub, tsFiles } = await this.collectModules(dir);
        const rawNewContent = this.generateContent(sub, tsFiles);
        const indexPath = path.join(dir, "index.ts");

        // Приводим новое содержимое в тот же формат, что и существующее
        const formattedNew = await this.formatWithPrettier(
          indexPath,
          rawNewContent
        );

        // Пытаемся прочитать существующий index.ts
        let existingRaw: string | null = null;
        try {
          existingRaw = await fs.readFile(indexPath, "utf8");
        } catch {
          /* файла нет — значит точно нужно создавать */
        }

        if (existingRaw !== null) {
          const oldBody = this.stripHeader(existingRaw);
          const newBody = this.stripHeader(formattedNew);

          // Если «тела» совпадают, пропускаем запись и бэкап
          if (oldBody === newBody) {
            continue;
          }
        }

        // Контент изменился — бэкапим и записываем
        await this.backupIfExists(indexPath);
        await fs.writeFile(indexPath, formattedNew, "utf8");

        anyChanged = true;
      } catch (err: any) {
        showWarning(`Не удалось обработать папку "${dir}": ${err.message}`);
      }
    }

    if (anyChanged) {
      showInfo("Синхронизация index.ts завершена.");
    } else {
      showInfo("index.ts уже актуальны. Изменений не обнаружено.");
    }

    // Возвращаем true даже если изменений нет: операция завершилась успешно
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* --------------------------  helpers  ----------------------------- */
  /* ------------------------------------------------------------------ */

  /** Рекурсивно собирает все подпапки (включая сам root). */
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

  /** Возвращает списки подпапок и .ts-файлов (кроме index.ts). */
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

  /** Формирует итоговый текст index.ts (с шапкой-комментарием). */
  private generateContent(folders: string[], tsFiles: string[]): string {
    if (folders.length === 0 && tsFiles.length === 0) {
      return (
        "// Этот файл сгенерирован автоматически. Не редактируйте вручную.\n" +
        "\n" +
        "export * from '.';\n"
      );
    }

    const lines: string[] = [
      "// Этот файл сгенерирован автоматически. Не редактируйте вручную.",
      "",
      ...folders.map((f) => `export * from './${f}';`),
      ...tsFiles.map((f) => `export * from './${f}';`),
      "",
    ];
    return lines.join("\n");
  }

  /**
   * Удаляет верхние подряд идущие строки-комментарии (`// ...`)
   * и возвращает «чистое» тело файла.
   */
  private stripHeader(content: string): string {
    const lines = content.split("\n");
    let i = 0;
    while (i < lines.length && lines[i].trim().startsWith("//")) {
      i++;
    }
    return lines.slice(i).join("\n").trim();
  }

  /** Делает бэкап index.ts, если он существует. */
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

  /** Форматирует текст через Prettier с учётом локального конфига. */
  private async formatWithPrettier(
    filePath: string,
    content: string
  ): Promise<string> {
    let prettierConfig: prettier.Options | null = null;
    try {
      prettierConfig = await prettier.resolveConfig(filePath);
    } catch {
      /* ignore */
    }

    try {
      return await prettier.format(content, {
        ...prettierConfig,
        parser: "typescript",
        filepath: filePath,
      });
    } catch {
      return content; // если Prettier упал — возвращаем как есть
    }
  }
}
