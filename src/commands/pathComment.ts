// src/commands/pathComment.ts

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import { prepareSaveCommentsEdits } from "../utils/pathCommentUtils";

let cachedExts: string[] | null = null;

async function getCommentExts(root: string): Promise<string[]> {
  if (cachedExts !== null) {
    console.log("PATH_COMMENT: Using cached extensions:", cachedExts);
    return cachedExts;
  }

  let extensions: string[] = [".ts"]; // Значение по умолчанию
  try {
    const raw = await fs.readFile(path.join(root, "codegen.json"), "utf8");
    const cfg = JSON.parse(raw);
    console.log(
      "PATH_COMMENT: Read 'commentExt' from codegen.json:",
      cfg.commentExt
    );

    if (typeof cfg.commentExt === "string" && cfg.commentExt.trim()) {
      extensions = [cfg.commentExt.trim()];
    } else if (Array.isArray(cfg.commentExt)) {
      extensions = cfg.commentExt.filter(
        (ext: any) => typeof ext === "string" && ext.trim()
      );
    }
  } catch (e: any) {
    console.error(
      "PATH_COMMENT: Failed to read or parse codegen.json, using default. Error:",
      e.message
    );
  }

  cachedExts = extensions.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`));
  console.log("PATH_COMMENT: Final extensions to be used:", cachedExts);
  return cachedExts;
}

export function registerPathCommentCommand(context: vscode.ExtensionContext) {
  const disposable = vscode.workspace.onWillSaveTextDocument((e) => {
    const editsPromise = (async () => {
      console.log("--- PATH_COMMENT: Save event triggered ---");
      const { document } = e;
      const roots = vscode.workspace.workspaceFolders;
      if (!roots || roots.length === 0) {
        console.log("PATH_COMMENT: No workspace folder found. Exiting.");
        return [];
      }

      const root = roots[0].uri.fsPath;
      const fileExt = path.extname(document.uri.fsPath);
      console.log(`PATH_COMMENT: Checking file with extension: ${fileExt}`);

      const allowedExts = await getCommentExts(root);

      const isAllowed = allowedExts.includes(fileExt);
      console.log(`PATH_COMMENT: Is this extension allowed? ${isAllowed}`);

      if (!isAllowed) {
        console.log("PATH_COMMENT: Extension not in allowed list. Exiting.");
        return [];
      }

      console.log(
        "PATH_COMMENT: Extension IS in allowed list. Preparing edits..."
      );
      return prepareSaveCommentsEdits(document, root);
    })();

    e.waitUntil(editsPromise);
  });

  context.subscriptions.push(disposable);
}
