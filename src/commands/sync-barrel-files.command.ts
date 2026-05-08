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

export function registerSyncBarrelFilesCommand(context: unknown) {
  registerCommand(
    context as vscode.ExtensionContext,
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

      if (!cfg.barrel.path) {
        showError('Параметр "path" не указан в блоке "barrel" конфига.');
        return;
      }

      const baseDir = path.resolve(projectRoot, cfg.barrel.path);

      try {
        const stat = await fs.stat(baseDir);
        if (!stat.isDirectory()) {
          showError(`Путь "${baseDir}" не является директорией.`);
          return;
        }
      } catch (e: unknown) {
        const errMessage = e instanceof Error ? e.message : String(e);
        showError(`Папка "${baseDir}" не найдена: ${errMessage}`);
        return;
      }

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
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Не удалось собрать список подпапок: ${message}`);
        return;
      }

      const ignoreList: string[] = Array.isArray(cfg.barrel.ignore.path)
        ? cfg.barrel.ignore.path
        : [];
      const absIgnorePatterns = ignoreList.map((p) =>
        path.resolve(projectRoot, p),
      );

      const filterSvc = new SyncIndexService(
        baseDir,
        cfg,
        cfg.barrel.extention,
        absIgnorePatterns,
        cfg.barrel.name,
        cfg.barrel.ignore.foldersName,
      );

      const visibleFoldersRel = allFoldersRel.filter(
        (rel) => !filterSvc.isIgnored(path.join(baseDir, rel)),
      );

      const items: vscode.QuickPickItem[] = visibleFoldersRel
        .map((rel) => {
          const depth = rel.split("/").length - 1;
          const indent = "  ".repeat(depth);
          return {
            label: `${indent}└ ${path.basename(rel)}`,
            description: rel,
          };
        })
        .sort((a, b) => {
          const descA = a.description;
          const descB = b.description;
          if (descA && descB) {
            return descA.localeCompare(descB);
          }
          return 0;
        });

      const picked = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: "Выберите подпапки для синхронизации",
      });

      if (!picked || picked.length === 0) {
        showWarning("Ни одна папка не была выбрана.");
        return;
      }

      const chosenRels = new Set(
        picked
          .map((i) => i.description)
          .filter((desc): desc is string => Boolean(desc)),
      );

      const finalFoldersToSyncAbs = allFoldersRel
        .filter((rel) => {
          return Array.from(chosenRels).some(
            (selected) => rel === selected || rel.startsWith(`${selected}/`),
          );
        })
        .map((rel) => path.join(baseDir, rel));

      try {
        const ok = await filterSvc.runOnFolders(finalFoldersToSyncAbs);
        if (!ok) {
          showError("Синхронизация завершилась с ошибкой.");
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Ошибка синхронизации: ${message}`);
      }
    },
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Ошибка: ${message}`);
    },
  );
}
