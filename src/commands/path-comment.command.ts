// src/commands/path-comment.command.ts

import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import { prepareSaveCommentsEdits } from "../functions/path-comment.functions";
import { readCodegenConfig } from "../functions/read-config.functions";

async function findNearestProjectRoot(
  startPath: string,
  workspaceRoot: string,
): Promise<string | null> {
  let currentDir = path.dirname(startPath);

  while (currentDir.startsWith(workspaceRoot)) {
    const configPath = path.join(currentDir, "codegen.json");
    try {
      await fs.access(configPath);
      return currentDir;
    } catch (error) {
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
  }
  return null;
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

      const projectRoot = await findNearestProjectRoot(
        fileFsPath,
        workspaceRoot,
      );

      if (!projectRoot) {
        return [];
      }

      const config = await readCodegenConfig(projectRoot);
      const allowedExts = (config.comment.extentions || []).map((ext) =>
        ext.startsWith(".") ? ext : `.${ext}`,
      );
      const removalPatterns = config.comment.removalPatterns || [];

      const fileExt = path.extname(fileFsPath);
      if (!allowedExts.includes(fileExt)) {
        return [];
      }

      return prepareSaveCommentsEdits(document, workspaceRoot, removalPatterns);
    })();

    e.waitUntil(editsPromise);
  });

  context.subscriptions.push(disposable);
}
