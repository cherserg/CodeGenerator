// src/commands/syncIndex.ts

import * as fs from "fs/promises";
import { Dirent } from "fs";
import * as path from "path";
import * as vscode from "vscode";
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

      // Рекурсивно собираем все вложенные подпапки внутри baseDir
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
          if (entry.isDirectory()) {
            const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
            results.push(relPath);
            const fullPath = path.join(dir, entry.name);
            const deeper = await collectAllSubfolders(fullPath, relPath);
            results = results.concat(deeper);
          }
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

      // Формируем иерархические элементы для QuickPick
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

      // Просим пользователя выбрать одну или несколько подпапок
      const picked = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: "Выберите вложенные подпапки для синхронизации index.ts",
      });

      if (!picked || picked.length === 0) {
        showWarning("Ни одна папка не была выбрана.");
        return;
      }

      // Собираем множество выбранных относительных путей
      const chosenSet = new Set(picked.map((item) => item.description!));

      // Если выбрана папка верхнего уровня, добавляем в синхронизацию все её потомки
      const toSync: string[] = [];
      for (const rel of allFolders) {
        for (const chosen of chosenSet) {
          if (rel === chosen || rel.startsWith(`${chosen}/`)) {
            toSync.push(rel);
          }
        }
      }

      // Удаляем дубликаты и сортируем
      const unique = Array.from(new Set(toSync)).sort((a, b) =>
        a.localeCompare(b)
      );

      // Формируем абсолютные пути к выбранным папкам и их потомкам
      const selectedDirs = unique.map((rel) => path.join(baseDir, rel));

      // Вызываем сервис синхронизации для всех полученных директорий
      try {
        const svc = new SyncIndexService();
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
