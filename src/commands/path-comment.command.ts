// src/commands/path-comment.command.ts

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { prepareSaveCommentsEdits } from "../functions/path-comment.functions";
import { readCodegenConfig } from "../functions/read-config.functions";

/**
 * Находит ближайший корневой каталог проекта (содержащий codegen.json),
 * двигаясь вверх от указанного пути файла.
 * @param startPath Путь к файлу, от которого начинается поиск.
 * @param workspaceRoot Корень всего рабочего пространства, чтобы не выйти за его пределы.
 * @returns Путь к корню проекта или null, если не найден.
 */
async function findNearestProjectRoot(
  startPath: string,
  workspaceRoot: string
): Promise<string | null> {
  let currentDir = path.dirname(startPath);

  while (currentDir.startsWith(workspaceRoot)) {
    const configPath = path.join(currentDir, "codegen.json");
    try {
      await fs.access(configPath);
      return currentDir; // Нашли codegen.json, это и есть корень проекта
    } catch (error) {
      // Файл не найден, идем на уровень выше
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // Достигли корня файловой системы
        break;
      }
      currentDir = parentDir;
    }
  }
  return null; // Не нашли codegen.json на пути к корню
}

export function registerPathCommentCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onWillSaveTextDocument((e) => {
    const editsPromise = (async () => {
      const { document } = e;
      const roots = vscode.workspace.workspaceFolders;
      if (!roots || roots.length === 0) {
        return [];
      }

      const workspaceRoot = roots[0].uri.fsPath;
      const fileFsPath = document.uri.fsPath;

      // Находим корень проекта, к которому относится этот файл
      const projectRoot = await findNearestProjectRoot(
        fileFsPath,
        workspaceRoot
      );

      if (!projectRoot) {
        // Файл не принадлежит ни одному из проектов с codegen.json
        return [];
      }

      // Читаем конфигурацию проекта
      const config = await readCodegenConfig(projectRoot);
      const allowedExts = (config.commentExt || []).map((ext) =>
        ext.startsWith(".") ? ext : `.${ext}`
      );
      const removalPatterns = config.commentRemovalPatterns || [];

      const fileExt = path.extname(fileFsPath);
      if (!allowedExts.includes(fileExt)) {
        return [];
      }

      // Комментарий всегда должен быть от корня всего монорепозитория (workspaceRoot)
      return prepareSaveCommentsEdits(document, workspaceRoot, removalPatterns);
    })();

    e.waitUntil(editsPromise);
  });

  context.subscriptions.push(disposable);
}
