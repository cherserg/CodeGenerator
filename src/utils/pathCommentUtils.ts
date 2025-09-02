// src/utils/pathCommentUtils.ts

import * as vscode from "vscode";
import * as path from "path";

/**
 * Формирует строку комментария с относительным путём для записи в файл.
 * Всегда возвращает строку вида "// src/path/to/file.ts".
 */
export function getPathCommentLine(
  fileFsPath: string,
  workspaceRoot: string
): string {
  const rel = path.relative(workspaceRoot, fileFsPath).replace(/\\/g, "/");
  // ИЗМЕНЕНО: Убираем префикс "Path: ", чтобы сделать проверку более точной
  return `// ${rel}`;
}

/**
 * Убирает из начала текста все строки-комментарии, соответствующие
 * старым вставкам пути, чтобы перед новым комментарием не остались дубликаты.
 *
 * Убирает наибольшие два первых комментария, если они:
 * • начинаются с "// Path:"
 * • или с "// src/"
 * • или с "// Этот файл"
 */
export function stripOldPathComments(content: string): string {
  const lines = content.split("\n");
  let i = 0;
  while (
    i < 2 &&
    lines[i] != null &&
    (lines[i].trim().startsWith("// Path:") ||
      lines[i].trim().startsWith("// src/") ||
      lines[i].trim().startsWith("// Этот файл"))
  ) {
    i++;
  }
  return lines.slice(i).join("\n");
}

/**
 * Готовит массив правок для VS Code, чтобы обеспечить наличие
 * корректного комментария с путём в начале файла при сохранении.
 */
export function prepareSaveCommentsEdits(
  doc: vscode.TextDocument,
  workspaceRoot: string
): vscode.TextEdit[] {
  const correctPathLine = getPathCommentLine(doc.uri.fsPath, workspaceRoot);
  const firstLine = doc.lineAt(0);

  // Если первая строка уже содержит правильный комментарий, ничего не делаем
  if (firstLine.text.trim() === correctPathLine) {
    return [];
  }

  // Проверяем, является ли первая строка "старым" комментарием пути
  const isOldComment =
    firstLine.text.trim().startsWith("// Path:") ||
    firstLine.text.trim().startsWith("// src/") ||
    firstLine.text.trim().startsWith("// Этот файл");

  if (isOldComment) {
    // Если это старый комментарий, заменяем его на правильный
    return [vscode.TextEdit.replace(firstLine.range, correctPathLine)];
  } else {
    // Если первая строка - это код, вставляем новый комментарий и пустую строку перед ним
    return [
      vscode.TextEdit.insert(
        new vscode.Position(0, 0),
        `${correctPathLine}\n\n`
      ),
    ];
  }
}
