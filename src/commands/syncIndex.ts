// src/commands/syncIndex.ts
import * as fs from "fs/promises";
import { Dirent } from "fs";
import * as path from "path";
import * as vscode from "vscode";
import minimatch from "minimatch";
import { registerCommand } from "./_common";
import {
  getWorkspaceRoot,
  showError,
  showWarning,
} from "../utils/vscode.utils";
import { readCodegenConfig } from "../utils/read-config.util";
import { SyncIndexService } from "../services/sync-index.service";

export function registerSyncIndexCommand(context: any) {
  registerCommand(
    context,
    "codegenerator.syncIndex",
    async () => {
      const root = getWorkspaceRoot();
      const cfg = await readCodegenConfig(root);
      const baseDir = path.join(root, cfg.outputPath);

      // Подготовим абсолютные маски для игнорирования:
      // каждая запись из ignoreSync трактуется относительно корня рабочей папки
      const ignorePatterns = (cfg.ignoreSync || []).map((pat) =>
        path.isAbsolute(pat) ? pat : path.join(root, pat)
      );

      // Проверяем, что базовая директория существует
      try {
        const stat = await fs.stat(baseDir);
        if (!stat.isDirectory()) {
          showError(`Путь "${baseDir}" не является директорией.`);
          return;
        }
      } catch (e: any) {
        showError(`Папка "${baseDir}" не найдена: ${e.message}`);
        return;
      }

      // Рекурсивно собираем все вложенные подпапки внутри baseDir,
      // пропуская те, что попадают под ignorePatterns
      async function collectAllSubfolders(
        dir: string,
        prefix: string = ""
      ): Promise<string[]> {
        let results: string[] = [];
        let entries: Dirent[];
        try {
          entries = (await fs.readdir(dir, {
            withFileTypes: true,
          })) as Dirent[];
        } catch {
          return results;
        }
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;

          const absPath = path.join(dir, entry.name);
          // если абсолютный путь совпадает с любым паттерном — пропускаем
          if (ignorePatterns.some((pat) => minimatch(absPath, pat))) {
            continue;
          }

          const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
          results.push(relPath);

          const deeper = await collectAllSubfolders(absPath, relPath);
          results = results.concat(deeper);
        }
        return results;
      }

      let allFolders: string[];
      try {
        allFolders = await collectAllSubfolders(baseDir);
        if (!allFolders.length) {
          showWarning(
            `В папке "${baseDir}" нет вложенных подпапок для синхронизации.`
          );
          return;
        }
      } catch (err: any) {
        showError(`Не удалось собрать список подпапок: ${err.message}`);
        return;
      }

      // Формируем QuickPick-элементы
      const items: vscode.QuickPickItem[] = allFolders
        .map((rel) => {
          const depth = rel.split("/").length - 1;
          const indent = "  ".repeat(depth);
          return {
            label: `${indent}└ ${path.basename(rel)}`,
            description: rel,
          };
        })
        .sort((a, b) => a.description!.localeCompare(b.description!));

      const picked = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: "Выберите подпапки для синхронизации index.ts",
      });

      if (!picked || picked.length === 0) {
        showWarning("Ни одна папка не была выбрана.");
        return;
      }

      // Собираем выбранные и их потомков
      const chosenSet = new Set(picked.map((i) => i.description!));
      const toSyncRel = allFolders.filter((rel) =>
        [...chosenSet].some((c) => rel === c || rel.startsWith(`${c}/`))
      );
      const unique = Array.from(new Set(toSyncRel)).sort();

      // Преобразуем в абсолютные пути
      const selectedDirs = unique.map((rel) => path.join(baseDir, rel));

      // Запускаем сервис синхронизации с учётом ignorePatterns
      try {
        const svc = new SyncIndexService(ignorePatterns);
        const ok = await svc.runOnFolders(selectedDirs);
        if (!ok) {
          showError("Не удалось синхронизировать index.ts в выбранных папках.");
        }
      } catch (err: any) {
        showError(`Ошибка синхронизации: ${err.message}`);
      }
    },
    (err) => showError(`Ошибка синхронизации: ${err.message}`)
  );
}
