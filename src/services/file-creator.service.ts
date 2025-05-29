// src/services/file-creator.service.ts
import * as fs from "fs/promises";
import * as path from "path";
import prettier from "prettier";

export class FileCreatorService {
  /**
   * Сохраняет строку content в файл outDir/fileName.
   * Если файл существует и его содержимое (после форматирования) отличается от нового,
   * сначала сохраняет копию старого в .bak.<timestamp>, затем записывает отформатированный.
   */
  public async save(
    outDir: string,
    fileName: string,
    content: string
  ): Promise<void> {
    // 1. Убедиться, что директория существует
    await fs.mkdir(outDir, { recursive: true });
    const fullPath = path.join(outDir, fileName);

    // 2. Найти конфиг Prettier (если есть)
    let prettierConfig: prettier.Options | null = null;
    try {
      prettierConfig = await prettier.resolveConfig(fullPath);
    } catch {
      // игнорируем ошибки поиска конфига
    }

    // 3. Определить парсер по расширению
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

    // 4. Отформатировать контент через Prettier
    let formatted: string;
    try {
      formatted = await prettier.format(content, {
        ...prettierConfig,
        parser,
        filepath: fullPath,
      });
    } catch {
      // если форматирование не удалось, используем оригинал
      formatted = content;
    }

    // 5. Проверить, нужно ли делать бэкап: сравнить уже существующий файл с новым отформатированным
    let shouldBackup = false;
    try {
      const existing = await fs.readFile(fullPath, "utf-8");
      if (existing !== formatted) {
        shouldBackup = true;
      } else {
        console.log(`No changes in ${fullPath}, backup skipped`);
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        // какая-то другая ошибка доступа — пробрасываем
        throw err;
      }
      // ENOENT — файла нет, бэкап не нужен
    }

    // 6. Если нужно, сделать резервную копию с меткой времени
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

    // 7. Записать (или перезаписать) файл уже отформатированным содержимым
    await fs.writeFile(fullPath, formatted, "utf-8");
    console.log(`File written to ${fullPath}`);
  }
}
