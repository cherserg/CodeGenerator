// src/functions/path-comment.functions.ts

import * as path from "path";
import * as vscode from "vscode";

/**
 * Формирует строку комментария с относительным путём.
 */
export function getPathCommentLine(
  fileFsPath: string,
  workspaceRoot: string,
): string {
  const rel = path.relative(workspaceRoot, fileFsPath).replace(/\\/g, "/");
  return `// ${rel}`;
}

/**
 * Готовит правки для замены заголовка файла.
 */
export function prepareSaveCommentsEdits(
  doc: vscode.TextDocument,
  workspaceRoot: string,
  patterns: string[],
): vscode.TextEdit[] {
  const correctPathLine = getPathCommentLine(doc.uri.fsPath, workspaceRoot);
  const lines = doc.getText().split("\n");

  let firstCodeLineIndex = 0;
  let foundCode = false;

  // Базовые префиксы для обратной совместимости
  const pathPrefixes = ["// src/", "// packages/", "// Path:"];

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();

    // 1. Пропускаем пустые строки
    if (trimmedLine === "") {
      continue;
    }

    // 2. Проверяем, является ли строка известным паттерном удаления
    const isRemovablePattern = patterns.some((p) => trimmedLine.startsWith(p));

    // 3. Проверяем, является ли строка техническим комментарием пути
    const isPathComment = pathPrefixes.some((p) => trimmedLine.startsWith(p));

    // 4. НОВОЕ: Проверяем, не является ли строка ТЕКУЩИМ комментарием пути (даже если префикса нет в списке)
    // Это предотвратит дублирование, если путь начинается, например, с "// scripts/"
    const isCurrentPath = trimmedLine === correctPathLine;

    if (isRemovablePattern || isPathComment || isCurrentPath) {
      // Это всё еще часть заголовка, продолжаем поиск
      continue;
    } else {
      // Нашли первую строку настоящего кода
      firstCodeLineIndex = i;
      foundCode = true;
      break;
    }
  }

  if (!foundCode) {
    firstCodeLineIndex = doc.lineCount;
  }

  const headerRange = new vscode.Range(0, 0, firstCodeLineIndex, 0);
  const existingHeaderText = doc.getText(headerRange);

  // Нормализуем для сравнения
  const normalizedExisting = existingHeaderText.replace(/\s/g, "");
  const normalizedCorrect = correctPathLine.replace(/\s/g, "");

  if (normalizedExisting === normalizedCorrect) {
    return [];
  }

  const newHeaderText = `${correctPathLine}\n\n`;
  return [vscode.TextEdit.replace(headerRange, newHeaderText)];
}
