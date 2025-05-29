// src/commands/_common.ts

import * as vscode from "vscode";

export function registerCommand(
  context: vscode.ExtensionContext,
  command: string,
  run: () => Promise<void>,
  onError: (err: any) => void
) {
  const d = vscode.commands.registerCommand(command, async () => {
    try {
      await run();
    } catch (err) {
      onError(err);
    }
  });
  context.subscriptions.push(d);
}
