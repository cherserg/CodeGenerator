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

      // Проверяем, что baseDir существует
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

      // Собираем все подпапки (относительные пути)
      async function collectAllSubfolders(
        dir: string,
        prefix = ""
      ): Promise<string[]> {
        let res: string[] = [];
        let entries: Dirent[];
        try {
          entries = (await fs.readdir(dir, {
            withFileTypes: true,
          })) as Dirent[];
        } catch {
          return res;
        }
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            res.push(rel);
            res = res.concat(
              await collectAllSubfolders(path.join(dir, entry.name), rel)
            );
          }
        }
        return res;
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

      // преобразуем ignoreSync из codegen.json в абсолютные пути
      const ignoreList: string[] = Array.isArray(cfg.ignoreSync)
        ? cfg.ignoreSync
        : [];
      const absIgnorePatterns = ignoreList.map((p) => path.resolve(root, p));

      // предварительный сервис для фильтрации выбора
      const svcPreview = new SyncIndexService(baseDir, absIgnorePatterns);
      const visibleFolders = allFolders.filter(
        (rel) => !svcPreview.isIgnored(path.join(baseDir, rel))
      );

      const items: vscode.QuickPickItem[] = visibleFolders
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

      // Расширяем выбор: если выбран уровень выше – включаем и вложенные
      const chosenSet = new Set(picked.map((i) => i.description!));
      const toSyncRel = allFolders.filter((rel) =>
        Array.from(chosenSet).some(
          (sel) => rel === sel || rel.startsWith(`${sel}/`)
        )
      );

      // абсолютные пути для финальной синхронизации
      const toSyncAbs = toSyncRel.map((rel) => path.join(baseDir, rel));
      const svc = new SyncIndexService(baseDir, absIgnorePatterns);
      try {
        const ok = await svc.runOnFolders(toSyncAbs);
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
