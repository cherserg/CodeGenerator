// src/functions/path-comment.functions.ts

import * as vscode from "vscode";
import * as path from "path";

/**
 * Формирует строку комментария с относительным путём для записи в файл.
 * Всегда возвращает строку вида "// path/to/file.ts".
 */
export function getPathCommentLine(
  fileFsPath: string,
  workspaceRoot: string
): string {
  const rel = path.relative(workspaceRoot, fileFsPath).replace(/\\/g, "/");
  return `// ${rel}`;
}

/**
 * Готовит массив правок для VS Code, чтобы обеспечить наличие
 * корректного комментария с путём в начале файла при сохранении.
 */
export function prepareSaveCommentsEdits(
  doc: vscode.TextDocument,
  workspaceRoot: string,
  patterns: string[]
): vscode.TextEdit[] {
  const correctPathLine = getPathCommentLine(doc.uri.fsPath, workspaceRoot);

  const lines = doc.getText().split("\n");
  let firstCodeLineIndex = 0;
  let foundCode = false;

  // Находим первую строку, которая НЕ является удаляемым комментарием или пустой строкой.
  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    if (trimmedLine === "") {
      continue;
    }
    const isRemovableComment = patterns.some((p) => trimmedLine.startsWith(p));
    if (!isRemovableComment) {
      firstCodeLineIndex = i;
      foundCode = true;
      break;
    }
  }

  // Обрабатываем случай, когда файл пуст или содержит только комментарии.
  if (!foundCode) {
    firstCodeLineIndex = doc.lineCount;
  }

  const headerRange = new vscode.Range(0, 0, firstCodeLineIndex, 0);
  const existingHeaderText = doc.getText(headerRange);

  // Нормализуем, убирая все пробельные символы, чтобы сравнить только контент.
  const normalizedExisting = existingHeaderText.replace(/\s/g, "");
  const normalizedCorrect = correctPathLine.replace(/\s/g, "");

  // Если единственный не-пробельный контент в заголовке - это правильный путь, ничего не делаем.
  if (normalizedExisting === normalizedCorrect) {
    return [];
  }

  // В противном случае, заменяем весь блок заголовка.
  const newHeaderText = `${correctPathLine}\n\n`;
  return [vscode.TextEdit.replace(headerRange, newHeaderText)];
}
