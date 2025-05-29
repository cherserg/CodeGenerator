// src/services/file-creator.service.ts
import * as fs from "fs/promises";
import * as path from "path";
import prettier, { Options as PrettierOptions } from "prettier";

export class FileCreatorService {
  /**
   * Сохраняет строку content в файл outDir/fileName.
   * Если файл существует и его содержимое отличается от нового,
   * сохраняет копию в .bak.<timestamp> перед перезаписью.
   * Перед записью прогоняет контент через Prettier с учётом вашего .prettierrc.
   */
  public async save(
    outDir: string,
    fileName: string,
    content: string
  ): Promise<void> {
    // 1. Убедиться, что директория существует
    await fs.mkdir(outDir, { recursive: true });

    const fullPath = path.join(outDir, fileName);

    // 2. Определяем путь к файлу для Prettier, чтобы он нашёл ваш конфиг
    const filepath = fullPath;

    // 3. Попробуем загрузить локальный конфиг Prettier (если есть)
    let config: PrettierOptions | null = null;
    try {
      config = await prettier.resolveConfig(filepath);
    } catch {
      config = null;
    }

    // 4. Вычислить, какой парсер использовать по расширению
    const ext = path.extname(fileName).toLowerCase();
    let parser: prettier.BuiltInParserName;
    switch (ext) {
      case ".ts":
      case ".tsx":
        parser = "typescript";
        break;
      case ".js":
      case ".jsx":
        parser = "babel";
        break;
      case ".json":
        parser = "json";
        break;
      case ".css":
      case ".scss":
        parser = "css";
        break;
      case ".md":
        parser = "markdown";
        break;
      default:
        parser = "babel";
    }

    // 5. Формируем опции форматирования, включая найденный конфиг и указание файла
    const prettierOptions: PrettierOptions = {
      parser,
      filepath,
      ...(config ?? {}),
    };

    // 6. Отформатировать контент через Prettier
    let formatted: string;
    try {
      formatted = await prettier.format(content, prettierOptions);
    } catch {
      // если форматирование не удалось — используем оригинал
      formatted = content;
    }

    // 7. Если файл существует — прочитать его и сравнить содержимое
    let shouldBackup = false;
    try {
      const existing = await fs.readFile(fullPath, "utf-8");
      if (existing !== formatted) {
        shouldBackup = true;
      } else {
        console.log(`No changes in ${fullPath}, backup skipped`);
      }
    } catch (err: any) {
      if (err.code === "ENOENT") {
        // Файла нет — бэкап не нужен
      } else {
        throw err;
      }
    }

    // 8. Если нужно — сделать резервную копию с timestamp
    if (shouldBackup) {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const ts =
        now.getFullYear().toString() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        "T" +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds());

      const bakFileName = `${fileName}.bak.${ts}`;
      const bakPath = path.join(outDir, bakFileName);
      await fs.copyFile(fullPath, bakPath);
      console.log(`Backup created: ${bakPath}`);
    }

    // 9. Записать (или перезаписать) файл уже отформатированным содержимым
    await fs.writeFile(fullPath, formatted, "utf-8");
    console.log(`File written to ${fullPath}`);
  }
}
