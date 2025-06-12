import * as fs from "fs/promises";
import * as path from "path";
import {
  ICodegenConfig,
  DEFAULT_CONFIG,
} from "../interfaces/agents/codegen-config.interface";

export async function readCodegenConfig(root: string): Promise<ICodegenConfig> {
  const cfgPath = path.join(root, "codegen.json");
  let cfgRaw: Partial<ICodegenConfig> = {};
  try {
    const raw = await fs.readFile(cfgPath, "utf8");
    cfgRaw = JSON.parse(raw);
  } catch {
    /* нет файла или он не валиден – используем дефолт */
  }

  return {
    configFolder: cfgRaw.configFolder?.trim() || DEFAULT_CONFIG.configFolder,
    outputPath: cfgRaw.outputPath?.trim() || DEFAULT_CONFIG.outputPath,
    outputExt:
      (cfgRaw.outputExt as ICodegenConfig["outputExt"]) ||
      DEFAULT_CONFIG.outputExt,
    pathOrder: Array.isArray(cfgRaw.pathOrder)
      ? cfgRaw.pathOrder
      : DEFAULT_CONFIG.pathOrder,
    /* --------- новое поле --------- */
    ignoreSync: Array.isArray(cfgRaw.ignoreSync)
      ? cfgRaw.ignoreSync
      : DEFAULT_CONFIG.ignoreSync,
  };
}
