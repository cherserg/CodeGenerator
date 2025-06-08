// src/commands/pathComment.ts

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { prepareSaveCommentsEdits } from "../utils/pathCommentUtils";

/**
 * При сохранении документа вставляет или обновляет в начале:
 * 1) "// Этот файл создан автоматически. Не редактируйте вручную."
 * 2) "// Path: относительный/путь"
 * Только для файлов с расширением commentExt из codegen.json (по умолчанию ".ts").
 */
export function registerPathCommentCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onWillSaveTextDocument(async (e) => {
    const doc = e.document;
    const roots = vscode.workspace.workspaceFolders;
    if (!roots || roots.length === 0) {
      return;
    }
    const workspaceRoot = roots[0].uri.fsPath;

    // читаем codegen.json и достаём commentExt, по умолчанию ".ts"
    let commentExt = ".ts";
    const cfgPath = path.join(workspaceRoot, "codegen.json");
    try {
      const raw = await fs.readFile(cfgPath, "utf8");
      const cfg = JSON.parse(raw);
      if (typeof cfg.commentExt === "string") {
        commentExt = cfg.commentExt;
      }
    } catch {
      // файл не найден или парсинг не удался — остаётся ".ts"
    }

    // проверяем расширение сохраняемого файла
    if (path.extname(doc.uri.fsPath) !== commentExt) {
      return;
    }

    // готовим и применяем правки
    const edits = prepareSaveCommentsEdits(doc, workspaceRoot);
    e.waitUntil(Promise.resolve(edits));
  });

  context.subscriptions.push(disposable);
}
