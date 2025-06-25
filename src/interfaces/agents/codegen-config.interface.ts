// src/interfaces/agents/codegen-config.interface.ts
import { TExtension } from "../entities/gen-request.interface";

export interface ICodegenConfig {
  configFolder: string;
  outputPath: string;
  outputExt: TExtension;
  /** Порядок сегментов пути (оставляем для совместимости) */
  pathOrder?: Array<"entity" | "script">;
  /** Новое: порядок частей имени файла */
  nameOrder?: Array<"entity" | "script" | "template">;
  /** Каталоги, которые нужно пропускать при синхронизации index.ts */
  ignoreSync?: string[];
}

export const DEFAULT_CONFIG: ICodegenConfig = {
  configFolder: "codegen",
  outputPath: "src/generated",
  outputExt: ".ts",
  pathOrder: ["entity", "script"],
  nameOrder: ["entity", "script", "template"], // <--- здесь
  ignoreSync: [],
};

export const NO_ENTITY_LABEL = "__NO_ENTITY__";
