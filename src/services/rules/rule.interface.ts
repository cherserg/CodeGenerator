// src/services/rules/rule.interface.ts

import { Dirent } from "fs";
import { ICodegenConfig } from "../../interfaces/agents/codegen-config.interface";

export interface ISyncRule {
  /**
   * Фильтрует список файлов в директории и возвращает имена модулей для экспорта.
   */
  collectFiles(dirents: Dirent[], barrelName: string): string[];

  /**
   * Генерирует содержимое barrel-файла на основе списка модулей и настроек.
   */
  generateContent(
    folders: string[],
    files: string[],
    syncExt: string,
    config: ICodegenConfig,
  ): string;
}
