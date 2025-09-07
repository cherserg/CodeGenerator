// src/functions/read-config.functions.ts

import * as fs from "fs/promises";
import * as path from "path";
import { ICodegenConfig } from "../interfaces";
import { DEFAULT_CONFIG } from "../configs";

export async function readCodegenConfig(root: string): Promise<ICodegenConfig> {
  const cfgPath = path.join(root, "codegen.json");
  let cfgRaw: Partial<ICodegenConfig> = {};

  try {
    const raw = await fs.readFile(cfgPath, "utf8");
    cfgRaw = JSON.parse(raw);
    console.log(
      `✅ Config loaded successfully from ${cfgPath}. Found syncIndexExt:`,
      cfgRaw.syncIndexExt
    );
  } catch (error: any) {
    console.error(
      `❌ Failed to read or parse codegen.json. Falling back to default config.`,
      {
        path: cfgPath,
        error: error.message,
      }
    );
  } // Сначала определяем outputPath, так как он может быть fallback'ом

  const outputPath = cfgRaw.outputPath?.trim() || DEFAULT_CONFIG.outputPath;

  return {
    configFolder: cfgRaw.configFolder?.trim() || DEFAULT_CONFIG.configFolder,
    outputPath: outputPath, // ✅ ИЗМЕНЕНИЕ: Добавляем чтение нового поля с fallback'ом на outputPath
    syncIndexPath: cfgRaw.syncIndexPath?.trim() || outputPath,
    outputExt:
      (cfgRaw.outputExt as ICodegenConfig["outputExt"]) ||
      DEFAULT_CONFIG.outputExt,
    pathOrder: Array.isArray(cfgRaw.pathOrder)
      ? cfgRaw.pathOrder
      : DEFAULT_CONFIG.pathOrder,
    nameOrder: Array.isArray(cfgRaw.nameOrder)
      ? cfgRaw.nameOrder
      : DEFAULT_CONFIG.nameOrder,
    ignoreSync: Array.isArray(cfgRaw.ignoreSync)
      ? cfgRaw.ignoreSync
      : DEFAULT_CONFIG.ignoreSync,
    syncIndexExt: cfgRaw.syncIndexExt?.trim() || DEFAULT_CONFIG.syncIndexExt,
    barrelName: cfgRaw.barrelName?.trim() || DEFAULT_CONFIG.barrelName,
  };
}
