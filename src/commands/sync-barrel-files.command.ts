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

interface IFolderPickItem extends vscode.QuickPickItem {
  absPath: string;
  baseDir: string;
}

export function registerSyncBarrelFilesCommand(
  context: vscode.ExtensionContext,
) {
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

      const quickPickItems: IFolderPickItem[] = [];
      const servicesMap = new Map<string, SyncIndexService>();

      const ignoreList: string[] = Array.isArray(cfg.barrel.ignore.path)
        ? cfg.barrel.ignore.path
        : [];
      const absIgnorePatterns = ignoreList.map((p) =>
        path.resolve(projectRoot, p),
      );

      for (const rawPath of cfg.barrel.path) {
        const baseDir = path.resolve(projectRoot, rawPath);
        try {
          const stat = await fs.stat(baseDir);
          if (!stat.isDirectory()) {
            continue;
          }
        } catch {
          continue;
        }

        const filterSvc = new SyncIndexService(
          baseDir,
          cfg,
          cfg.barrel.extention,
          absIgnorePatterns,
          cfg.barrel.name,
          cfg.barrel.ignore.foldersName,
        );
        servicesMap.set(baseDir, filterSvc);

        const allFoldersRel = await collectAllSubfolders(baseDir);
        const visibleFoldersRel = allFoldersRel.filter(
          (rel) => !filterSvc.isIgnored(path.join(baseDir, rel)),
        );

        for (const rel of visibleFoldersRel) {
          const depth = rel.split("/").length - 1;
          const indent = "  ".repeat(depth);
          quickPickItems.push({
            label: `${indent}└ ${path.basename(rel)}`,
            description: rel,
            absPath: path.join(baseDir, rel),
            baseDir: baseDir,
          });
        }
      }

      if (quickPickItems.length === 0) {
        showWarning("Ни одной папки для синхронизации не найдено.");
        return;
      }

      quickPickItems.sort((a, b) => {
        const descA = a.description;
        const descB = b.description;
        if (descA && descB) {
          return descA.localeCompare(descB);
        }
        return 0;
      });

      const picked = await vscode.window.showQuickPick(quickPickItems, {
        canPickMany: true,
        placeHolder: "Выберите подпапки для синхронизации",
      });

      if (!picked || picked.length === 0) {
        showWarning("Ни одна папка не была выбрана.");
        return;
      }

      const selectedAbsPaths = new Set(picked.map((item) => item.absPath));
      const targetsPerBaseDir = new Map<string, string[]>();

      for (const baseDir of servicesMap.keys()) {
        const allFoldersRel = await collectAllSubfolders(baseDir);
        const matchedAbsPaths = allFoldersRel
          .map((rel) => path.join(baseDir, rel))
          .filter((abs) => {
            return Array.from(selectedAbsPaths).some(
              (selected) =>
                abs === selected ||
                abs.startsWith(selected + "/") ||
                abs.startsWith(selected + path.sep),
            );
          });

        if (matchedAbsPaths.length > 0) {
          targetsPerBaseDir.set(baseDir, matchedAbsPaths);
        }
      }

      let hasError = false;
      for (const [baseDir, absPaths] of targetsPerBaseDir.entries()) {
        const filterSvc = servicesMap.get(baseDir);
        if (filterSvc) {
          try {
            const ok = await filterSvc.runOnFolders(absPaths);
            if (!ok) {
              hasError = true;
            }
          } catch {
            hasError = true;
          }
        }
      }

      if (hasError) {
        showError("Синхронизация завершилась с ошибкой.");
      }
    },
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Ошибка: ${message}`);
    },
  );
}
