// Path: src/utils/pathCommentUtils.ts

import * as vscode from "vscode";
import * as path from "path";

/**
 * Формирует строку комментария с относительным путём для записи в файл.
 * Всегда возвращает строку вида "// Path: относительный/путь/к/файлу".
 */
export function getPathCommentLine(
  fileFsPath: string,
  workspaceRoot: string
): string {
  const rel = path.relative(workspaceRoot, fileFsPath).replace(/\\/g, "/");
  return `// ${rel}`;
}

/**
 * Убирает из начала текста все строки-комментарии, соответствующие
 * старым вставкам пути, чтобы перед новым комментарием не остались дубликаты.
 *
 * Убирает наибольшие два первых комментария, если они:
 *  • начинаются с "// Path:"
 *  • или с "// src/"
 *  • или с "// Этот файл"
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
 * Обеспечивает наличие строки
 *   // Path: относительный/путь/к/файлу
 * в самом верху открытого документа VS Code.
 *
 * • Если строка уже актуальна — правки не требуются.
 * • Старые комментарии вида "// Path:", "// src/…" или "// Этот файл…"
 *   в первых двух строках удаляются.
 */
export function prepareSaveCommentsEdits(
  doc: vscode.TextDocument,
  workspaceRoot: string
): vscode.TextEdit[] {
  const edits: vscode.TextEdit[] = [];

  const pathLine = getPathCommentLine(doc.uri.fsPath, workspaceRoot);

  const first = doc.lineAt(0);
  const second = doc.lineCount > 1 ? doc.lineAt(1) : null;

  // Если уже стоит актуальная строка — ничего не делаем
  if (first.text.trim() === pathLine) {
    return edits;
  }

  // Удаляем старые комментарии в первых двух строках
  [first, second].forEach((line) => {
    if (
      line &&
      (line.text.trim().startsWith("// Path:") ||
        line.text.trim().startsWith("// src/") ||
        line.text.trim().startsWith("// Этот файл"))
    ) {
      edits.push(vscode.TextEdit.delete(line.rangeIncludingLineBreak));
    }
  });

  // Вставляем актуальную строку + пустую строку после неё
  edits.push(
    vscode.TextEdit.insert(new vscode.Position(0, 0), `${pathLine}\n\n`)
  );

  return edits;
}
