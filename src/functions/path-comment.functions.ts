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

  // Список префиксов, которые мы считаем "техническими комментариями" пути
  const pathPrefixes = ["// src/", "// packages/", "// Path:"];

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();

    // Пропускаем пустые строки
    if (trimmedLine === "") {
      continue;
    }

    // Проверяем: это строка из конфига patterns ИЛИ это технический комментарий пути?
    const isRemovablePattern = patterns.some((p) => trimmedLine.startsWith(p));
    const isPathComment = pathPrefixes.some((p) => trimmedLine.startsWith(p));

    if (isRemovablePattern || isPathComment) {
      // Это всё еще часть заголовка, продолжаем цикл
      continue;
    } else {
      // Нашли первую строку настоящего кода
      firstCodeLineIndex = i;
      foundCode = true;
      break;
    }
  }

  // Если весь файл состоит из комментариев или пуст
  if (!foundCode) {
    firstCodeLineIndex = doc.lineCount;
  }

  // Определяем диапазон заголовка (от начала до первой строки кода)
  const headerRange = new vscode.Range(0, 0, firstCodeLineIndex, 0);
  const existingHeaderText = doc.getText(headerRange);

  // Сравниваем контент (без учета пробелов и пустых строк), чтобы не дергать файл зря
  const normalizedExisting = existingHeaderText.replace(/\s/g, "");
  const normalizedCorrect = correctPathLine.replace(/\s/g, "");

  if (normalizedExisting === normalizedCorrect) {
    return [];
  }

  // Заменяем ВЕСЬ найденный блок заголовка на одну актуальную строку пути
  const newHeaderText = `${correctPathLine}\n\n`;
  return [vscode.TextEdit.replace(headerRange, newHeaderText)];
}
