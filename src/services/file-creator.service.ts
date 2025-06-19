// Path: src/services/file-creator.service.ts

import * as fs from "fs/promises";
import * as path from "path";
import prettier from "prettier";
import {
  getPathCommentLine,
  stripOldPathComments,
} from "../utils/pathCommentUtils";

export class FileCreatorService {
  /**
   * Сохраняет `content` в `outDir/fileName`.
   * Если передан `workspaceRoot`, то
   * — удаляет существующие “// Path:” в начале,
   * — добавляет строку `// Path: относительный/путь/к/файлу`
   * ещё ДО форматирования и записи.
   *
   * При отличии содержимого создаётся резервная копия (.bak.YYYYMMDDTHHMMSS).
   */
  public async save(
    outDir: string,
    fileName: string,
    content: string,
    workspaceRoot?: string
  ): Promise<void> {
    // 1. гарантируем существование каталога
    await fs.mkdir(outDir, { recursive: true });
    const fullPath = path.join(outDir, fileName);

    // 2. подготавливаем тело с единственным комментарием Path
    let body = content;
    if (workspaceRoot) {
      // убираем старые Path-комментарии
      body = stripOldPathComments(body);
      // добавляем актуальный
      const pathLine = getPathCommentLine(fullPath, workspaceRoot);
      body = `${pathLine}\n\n${body}`;
    }

    // 3. находим конфиг Prettier
    let prettierCfg: prettier.Options | null = null;
    try {
      prettierCfg = await prettier.resolveConfig(fullPath);
    } catch {
      // игнорируем
    }

    // 4. выбираем парсер по расширению
    const ext = path.extname(fileName).toLowerCase();
    const parser: prettier.BuiltInParserName =
      ext === ".ts" || ext === ".tsx"
        ? "typescript"
        : ext === ".js" || ext === ".jsx"
          ? "babel"
          : ext === ".json"
            ? "json"
            : ext === ".css" || ext === ".scss"
              ? "css"
              : ext === ".md"
                ? "markdown"
                : "babel";

    // 5. форматируем
    let formatted: string;
    try {
      formatted = await prettier.format(body, {
        ...prettierCfg,
        parser,
        filepath: fullPath,
      });
    } catch {
      formatted = body;
    }

    // 6. бэкап при изменении
    let needBackup = false;
    try {
      const old = await fs.readFile(fullPath, "utf-8");
      needBackup = old !== formatted;
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }

    if (needBackup) {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const stamp =
        now.getFullYear() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        "T" +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds());
      await fs.copyFile(fullPath, `${fullPath}.bak.${stamp}`);
    }

    // 7. финальная запись
    await fs.writeFile(fullPath, formatted, "utf-8");
  }
}
