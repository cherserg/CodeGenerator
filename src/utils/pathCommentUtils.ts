// src/utils/pathCommentUtils.ts

import * as vscode from "vscode";
import * as path from "path";

/**
 * Вставляет или обновляет в начале документа:
 * 1) "// Этот файл создан автоматически. Не редактируйте вручную."
 * 2) "// Path: относительный/путь"
 */
export function prepareSaveCommentsEdits(
  doc: vscode.TextDocument,
  workspaceRoot: string
): vscode.TextEdit[] {
  const edits: vscode.TextEdit[] = [];

  // относительный путь файла с прямыми слешами
  const relPath = path
    .relative(workspaceRoot, doc.uri.fsPath)
    .replace(/\\/g, "/");
  const headerLine =
    "// Этот файл создан автоматически. Не редактируйте вручную.";
  const pathLine = `// Path: ${relPath}`;

  // Получаем первые две строки (если есть)
  const firstLine = doc.lineAt(0);
  const secondLine = doc.lineCount > 1 ? doc.lineAt(1) : null;

  // Проверяем, есть ли уже наши комментарии
  const hasHeader = firstLine.text.trim() === headerLine;
  const hasPath = hasHeader
    ? secondLine?.text.trim() === pathLine
    : firstLine.text.trim() === pathLine;

  if (hasHeader && hasPath) {
    // Обновляем обе строки, если что-то поменялось
    edits.push(vscode.TextEdit.replace(firstLine.range, headerLine));
    if (secondLine) {
      edits.push(vscode.TextEdit.replace(secondLine.range, pathLine));
    }
  } else {
    // Удаляем любые старые наши комментарии в первых двух строках
    const rangesToRemove: vscode.Range[] = [];
    [firstLine, secondLine].forEach((line) => {
      if (
        line &&
        (line.text.startsWith("// Этот файл") ||
          line.text.startsWith("// Path:"))
      ) {
        rangesToRemove.push(line.rangeIncludingLineBreak);
      }
    });
    rangesToRemove.forEach((r) => edits.push(vscode.TextEdit.delete(r)));

    // Вставляем новые две строки сверху
    edits.push(
      vscode.TextEdit.insert(
        new vscode.Position(0, 0),
        headerLine + "\n" + pathLine + "\n\n"
      )
    );
  }

  return edits;
}
