// src/interfaces/agents/codegen-config.interface.ts

export interface ICodegenConfig {
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
  syncIndexPath?: string;
}

export const DEFAULT_CONFIG: ICodegenConfig = {
  configFolder: "codegen",
  outputPath: "src/generated",
  syncIndexPath: "src/generated",
  outputExt: ".ts",
  pathOrder: ["entity", "script"],
  nameOrder: ["entity", "script", "template"], // <--- здесь
  ignoreSync: [],
  syncIndexExt: ".ts",
};

export const NO_ENTITY_LABEL = "__NO_ENTITY__";
