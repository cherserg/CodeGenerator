// src/services/rules/rule.interface.ts

import { Dirent } from "fs";

export interface ISyncRule {
  /**
   * Фильтрует список файлов в директории и возвращает имена модулей для экспорта.
   * @param dirents Список файлов и папок в директории.
   * @param indexFileName Имя индексного файла, который нужно проигнорировать (например, 'index.ts').
   * @returns Массив имен файлов без расширения.
   */
  collectFiles(dirents: Dirent[], indexFileName: string): string[];

  /**
   * Генерирует содержимое barrel-файла на основе списка модулей.
   * @param folders Список подпапок для экспорта.
   * @param files Список файлов для экспорта (без расширения).
   * @param syncExt Текущее расширение файла (например, '.dart').
   * @returns Строка с содержимым для записи в index-файл.
   */
  generateContent(folders: string[], files: string[], syncExt: string): string;
}
