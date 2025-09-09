import * as fs from "fs/promises";
import * as path from "path";
import prettier from "prettier";
import { getPathCommentLine } from "../functions/path-comment.functions";

export class FileCreatorService {
  /**
   * Сохраняет `content` в `outDir/fileName`.
   * Создаёт резервную копию (.bak.YYYYMMDDTHHMMSS) при отличии содержимого.
   * Вставляет комментарий с путём к файлу в начало.
   */
  public async save(
    outDir: string,
    fileName: string,
    content: string,
    workspaceRoot: string
  ): Promise<void> {
    // 1. Гарантируем существование каталога
    await fs.mkdir(outDir, { recursive: true });
    const fullPath = path.join(outDir, fileName);

    // 2. Генерируем комментарий с путем и добавляем его в начало контента.
    const pathComment = getPathCommentLine(fullPath, workspaceRoot);
    const body = `${pathComment}\n\n${content}`;

    // 3. Находим конфиг Prettier
    let prettierCfg: prettier.Options | null = null;
    try {
      prettierCfg = await prettier.resolveConfig(fullPath);
    } catch {
      // игнорируем
    }

    // 4. Выбираем парсер по расширению
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

    // 5. Форматируем
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

    // 6. Бэкап при изменении
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

    // 7. Финальная запись
    await fs.writeFile(fullPath, formatted, "utf-8");
  }
}
