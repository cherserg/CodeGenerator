// src/interfaces/agents/codegen-config.interface.ts

export type ICodegenConfig = {
  configFolder: string;
  outputPath: string;
  outputExt: string /** Порядок сегментов пути (оставляем для совместимости) */;
  pathOrder?: Array<
    "entity" | "script"
  > /** Новое: порядок частей имени файла */;
  nameOrder?: Array<
    "entity" | "script" | "template"
  > /** Каталоги, которые нужно пропускать при синхронизации index.ts */;
  ignoreSync?: string[] /** Расширение для barrel-файлов (например, ".ts" или ".tsx"). */;
  syncIndexExt?: string;
  syncIndexPath?: string /** Имя для barrel-файла (без расширения). По умолчанию "index". */;
  barrelName?: string;
  commentExt?: string[];
  commentRemovalPatterns?: string[];
  /**
   * Игнорировать создание/обновление barrel-файла в папках,
   * имена которых содержат один из этих маркеров (например, [".module", ".manual"]).
   */
  syncSkipFoldersContaining?: string[];
};
