// src/utils/vscode.utils.ts

import * as vscode from "vscode";

export function getWorkspaceRoot(): string {
  const ws = vscode.workspace.workspaceFolders;
  if (!ws) throw new Error("Откройте рабочую папку");
  return ws[0].uri.fsPath;
}

export function showInfo(message: string): void {
  vscode.window.showInformationMessage(message);
}

export function showError(message: string): void {
  vscode.window.showErrorMessage(message);
}

export function showWarning(message: string): void {
  vscode.window.showWarningMessage(message);
}
