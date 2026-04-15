// src/commands/sync-barrel-files.command.ts

import { Dirent } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { pickProject } from "../functions/pick.functions";
import { findProjectsInWorkspace } from "../functions/project-discovery.functions";
import { readCodegenConfig } from "../functions/read-config.functions";
import {
  getWorkspaceRoot,
  showError,
  showWarning,
} from "../functions/vscode.functions";
import { SyncIndexService } from "../services/sync-index.service";
import { registerCommand } from "./_common";

export function registerSyncBarrelFilesCommand(context: any) {
  registerCommand(
    context,
    "codegenerator.syncIndex",
    async () => {
      const workspaceRoot = getWorkspaceRoot();

      const projects = await findProjectsInWorkspace(workspaceRoot);
      if (projects.length === 0) {
        showWarning("Не найдено ни одного проекта с файлом codegen.json.");
        return;
      }

      const selectedProject = await pickProject(
        projects,
        "Выберите проект для синхронизации index-файлов",
      );

      if (!selectedProject) {
        showWarning("Проект не выбран.");
        return;
      }

      const projectRoot = selectedProject.path;
      const cfg = await readCodegenConfig(projectRoot);

      if (!cfg.syncIndexPath) {
        showError('Параметр "syncIndexPath" не указан в codegen.json.');
        return;
      }

      // baseDir — это точка отсчета для показа списка в QuickPick
      const baseDir = path.resolve(projectRoot, cfg.syncIndexPath);

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

      // Рекурсивный сбор всех папок
      async function collectAllSubfolders(
        dir: string,
        prefix = "",
      ): Promise<string[]> {
        let res: string[] = [];
        let entries: Dirent[];
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return res;
        }
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            res.push(rel);
            res = res.concat(
              await collectAllSubfolders(path.join(dir, entry.name), rel),
            );
          }
        }
        return res;
      }

      let allFoldersRel: string[];
      try {
        allFoldersRel = await collectAllSubfolders(baseDir);
        if (!allFoldersRel.length) {
          showWarning(`В папке "${baseDir}" нет вложенных подпапок.`);
          return;
        }
      } catch (err: any) {
        showError(`Не удалось собрать список подпапок: ${err.message}`);
        return;
      }

      const ignoreList: string[] = Array.isArray(cfg.ignoreSync)
        ? cfg.ignoreSync
        : [];
      const absIgnorePatterns = ignoreList.map((p) =>
        path.resolve(projectRoot, p),
      );

      // Создаем временный сервис только для фильтрации списка в QuickPick
      const filterSvc = new SyncIndexService(
        baseDir,
        cfg.syncIndexExt,
        absIgnorePatterns,
        cfg.barrelName,
        cfg.syncSkipFoldersContaining,
      );

      // Оставляем только те папки, которые не в игноре
      const visibleFoldersRel = allFoldersRel.filter(
        (rel) => !filterSvc.isIgnored(path.join(baseDir, rel)),
      );

      const items: vscode.QuickPickItem[] = visibleFoldersRel
        .map((rel) => {
          const depth = rel.split("/").length - 1;
          const indent = "  ".repeat(depth);
          return {
            label: `${indent}└ ${path.basename(rel)}`,
            description: rel, // храним относительный путь здесь
          };
        })
        .sort((a, b) => a.description!.localeCompare(b.description!));

      const picked = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: "Выберите подпапки для синхронизации",
      });

      if (!picked || picked.length === 0) {
        showWarning("Ни одна папка не была выбрана.");
        return;
      }

      // --- ЛОГИКА ВЫБОРА ИСПРАВЛЕНА ЗДЕСЬ ---

      // Нам нужно синхронизировать выбранные папки И все их вложенные папки
      const chosenRels = new Set(picked.map((i) => i.description!));
      const finalFoldersToSyncAbs = allFoldersRel
        .filter((rel) => {
          return Array.from(chosenRels).some(
            (selected) => rel === selected || rel.startsWith(`${selected}/`),
          );
        })
        .map((rel) => path.join(baseDir, rel));

      // Запускаем основной процесс
      try {
        const ok = await filterSvc.runOnFolders(finalFoldersToSyncAbs);
        if (!ok) {
          showError("Синхронизация завершилась с ошибкой.");
        }
      } catch (err: any) {
        showError(`Ошибка синхронизации: ${err.message}`);
      }
    },
    (err) => showError(`Ошибка: ${err.message}`),
  );
}
