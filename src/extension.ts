// src/extension.ts

import * as vscode from "vscode";
import * as commands from "./commands";

export function activate(context: vscode.ExtensionContext) {
  registerCommands(context);
}

export function deactivate() {}

function registerCommands(context: vscode.ExtensionContext) {
  commands.registerGenerateDocsCommand(context);
  commands.registerRestoreDocsCommand(context);
  commands.registerGenerateFromPresetCommand(context);
  commands.registerSyncIndexCommand(context);
  commands.registerPathCommentCommand(context);
}
