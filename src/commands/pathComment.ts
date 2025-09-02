// src/commands/pathComment.ts

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { prepareSaveCommentsEdits } from "../utils/pathCommentUtils";

async function getCommentExts(root: string): Promise<string[]> {
  // Убираем кэширование, чтобы всегда читать актуальную конфигурацию
  let extensions: string[] = [".ts", ".tsx"]; // Значение по умолчанию
  try {
    const raw = await fs.readFile(path.join(root, "codegen.json"), "utf8");
    const cfg = JSON.parse(raw);

    if (Array.isArray(cfg.commentExt)) {
      const filteredExts = cfg.commentExt.filter(
        (ext: any) => typeof ext === "string" && ext.trim()
      );
      if (filteredExts.length > 0) {
        extensions = filteredExts;
      }
    }
  } catch (e: any) {
    console.error(
      "PATH_COMMENT: Failed to read or parse codegen.json, using default. Error:",
      e.message
    );
  }

  // Убеждаемся, что все расширения начинаются с точки
  return extensions.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`));
}

export function registerPathCommentCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onWillSaveTextDocument((e) => {
    const editsPromise = (async () => {
      const { document } = e;
      const roots = vscode.workspace.workspaceFolders;
      if (!roots || roots.length === 0) {
        return [];
      }

      const root = roots[0].uri.fsPath;
      const fileExt = path.extname(document.uri.fsPath);
      const allowedExts = await getCommentExts(root);

      if (!allowedExts.includes(fileExt)) {
        return [];
      }

      return prepareSaveCommentsEdits(document, root);
    })();

    e.waitUntil(editsPromise);
  });

  context.subscriptions.push(disposable);
}
