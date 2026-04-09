// src/services/file-creator.service.ts

import * as fs from "fs/promises";
import * as path from "path";
import prettier from "prettier";
import { getPathCommentLine } from "../functions/path-comment.functions";

export class FileCreatorService {
  /**
   * Сохраняет `content` в `outDir/fileName`.
   * Создаёт резервную копию при отличии содержимого.
   * Выполняет запись только если контент реально изменился.
   */
  public async save(
    outDir: string,
    fileName: string,
    content: string,
    workspaceRoot: string,
  ): Promise<void> {
    await fs.mkdir(outDir, { recursive: true });
    const fullPath = path.join(outDir, fileName);

    // 1. Генерируем заголовок и соединяем с контентом
    const pathComment = getPathCommentLine(fullPath, workspaceRoot);
    const rawFullBody = `${pathComment}\n\n${content}`;

    // 2. Находим конфиг и форматируем ВЕСЬ файл целиком
    let prettierCfg: prettier.Options | null = null;
    try {
      prettierCfg = await prettier.resolveConfig(fullPath);
    } catch {
      // игнорируем
    }

    const ext = path.extname(fileName).toLowerCase();
    const parser: prettier.BuiltInParserName =
      ext === ".ts" || ext === ".tsx"
        ? "typescript"
        : ext === ".js" || ext === ".jsx"
          ? "babel"
          : ext === ".json"
            ? "json"
            : ext === ".dart"
              ? "babel" // для Dart можно оставить как есть или использовать спец. плагины
              : "babel";

    let formatted: string;
    try {
      formatted = await prettier.format(rawFullBody, {
        ...prettierCfg,
        parser,
        filepath: fullPath,
      });
    } catch {
      formatted = rawFullBody;
    }

    // 3. Проверка на изменения (нормализуем окончания строк)
    let isDifferent = true;
    try {
      const existing = await fs.readFile(fullPath, "utf-8");

      const normalize = (s: string) => s.replace(/\r\n/g, "\n").trim();
      if (normalize(existing) === normalize(formatted)) {
        isDifferent = false;
      }
    } catch (e: unknown) {
      const error = e as { code?: string };
      if (error.code !== "ENOENT") throw e;
    }

    // 4. Записываем только если есть отличия
    if (isDifferent) {
      // Бэкап существующего файла
      try {
        await fs.access(fullPath);
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
      } catch {
        // файла нет, бэкап не нужен
      }

      await fs.writeFile(fullPath, formatted, "utf-8");
    }
  }
}
