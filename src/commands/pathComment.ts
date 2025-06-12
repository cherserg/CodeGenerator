import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { prepareSaveCommentsEdits } from "../utils/pathCommentUtils";

/**
 * При каждом сохранении .ts-файлов добавляет / обновляет строку
 *   // Path: относительный/путь/к/файлу
 * в самом начале документа.
 *
 * Расширение берётся из codegen.json → commentExt
 * (по-умолчанию “.ts”, допускается запись без точки).
 */
let cachedExt: string | null = null;
async function getCommentExt(root: string): Promise<string> {
  if (cachedExt !== null) return cachedExt;

  let ext = ".ts";
  try {
    const raw = await fs.readFile(path.join(root, "codegen.json"), "utf8");
    const cfg = JSON.parse(raw);
    if (typeof cfg.commentExt === "string" && cfg.commentExt.trim()) {
      ext = cfg.commentExt.trim();
    }
  } catch {
    /* файл не найден / невалиден — используем дефолт */
  }

  cachedExt = ext.startsWith(".") ? ext : `.${ext}`;
  return cachedExt;
}

export function registerPathCommentCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onWillSaveTextDocument((e) => {
    const editsPromise = (async () => {
      const { document } = e;
      const roots = vscode.workspace.workspaceFolders;
      if (!roots || roots.length === 0) return [];

      const root = roots[0].uri.fsPath;
      if (path.extname(document.uri.fsPath) !== (await getCommentExt(root)))
        return [];

      return prepareSaveCommentsEdits(document, root);
    })();

    e.waitUntil(editsPromise);
  });

  context.subscriptions.push(disposable);
}
