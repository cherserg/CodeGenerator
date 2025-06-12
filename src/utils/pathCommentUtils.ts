import * as vscode from "vscode";
import * as path from "path";

/**
 * Обеспечивает наличие строки
 *   // Path: относительный/путь/к/файлу
 * в самом верху документа.
 *
 * • Если строка уже актуальна — правки не требуются.
 * • Любые старые комментарии вида “// Path:” или
 *   “// Этот файл создан автоматически…” в первых двух строках удаляются.
 */
export function prepareSaveCommentsEdits(
  doc: vscode.TextDocument,
  workspaceRoot: string
): vscode.TextEdit[] {
  const edits: vscode.TextEdit[] = [];

  const rel = path.relative(workspaceRoot, doc.uri.fsPath).replace(/\\/g, "/");
  const pathLine = `// Path: ${rel}`;

  const first = doc.lineAt(0);
  const second = doc.lineCount > 1 ? doc.lineAt(1) : null;

  /* строка уже актуальна — ничего делать не надо */
  if (first.text.trim() === pathLine) return edits;

  /* удаляем устаревшие комментарии в первых двух строках */
  [first, second].forEach((l) => {
    if (
      l &&
      (l.text.trim().startsWith("// Path:") ||
        l.text.trim().startsWith("// Этот файл"))
    ) {
      edits.push(vscode.TextEdit.delete(l.rangeIncludingLineBreak));
    }
  });

  /* вставляем актуальную строку + пустую строку после неё */
  edits.push(
    vscode.TextEdit.insert(new vscode.Position(0, 0), `${pathLine}\n\n`)
  );

  return edits;
}
