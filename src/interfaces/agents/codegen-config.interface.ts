// src/interfaces/agents/codegen-config.interface.ts
import { TExtension } from "../entities/gen-request.interface";

export interface ICodegenConfig {
  configFolder: string;
  outputPath: string;
  outputExt: TExtension;
  /** Порядок сегментов пути */
  pathOrder?: Array<"entity" | "script">;
  /**
   * Пути (или glob-маски относительно outputPath) папок,
   * которые не синхронизировать (вместе с их поддиректориями).
   */
  ignoreSync?: string[];
}

export const DEFAULT_CONFIG: ICodegenConfig = {
  configFolder: "codegen",
  outputPath: "src/generated",
  outputExt: ".ts",
  pathOrder: ["entity", "script"],
  ignoreSync: [],
};

export const NO_ENTITY_LABEL = "__NO_ENTITY__";
