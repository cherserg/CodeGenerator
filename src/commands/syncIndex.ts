// src/commands/syncIndex.ts

import * as path from "path";
import { registerCommand } from "./_common";
import { getWorkspaceRoot, showError } from "../utils/vscode.utils";
import { readCodegenConfig } from "../utils/read-config.util";
import { SyncIndexService } from "../services/sync-index.service";

export function registerSyncIndexCommand(context: any) {
  registerCommand(
    context,
    "codegenerator.syncIndex",
    async () => {
      const root = getWorkspaceRoot();
      const cfg = await readCodegenConfig(root);
      const targetDir = path.join(root, cfg.outputPath);

      try {
        const svc = new SyncIndexService();
        const ok = await svc.run(targetDir);
        if (!ok) {
          showError("Не удалось синхронизировать index.ts ни в одной папке.");
        }
      } catch (err: any) {
        showError(`Ошибка синхронизации: ${err.message}`);
      }
    },
    (err) => showError(`Ошибка синхронизации: ${err.message}`)
  );
}
