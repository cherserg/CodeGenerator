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
  } catch (error: any) {
    console.error(
      `❌ Failed to read or parse codegen.json. Falling back to default config.`,
      {
        path: cfgPath,
        error: error.message,
      }
    );
  }
  const outputPath = cfgRaw.outputPath?.trim() || DEFAULT_CONFIG.outputPath;

  return {
    configFolder: cfgRaw.configFolder?.trim() || DEFAULT_CONFIG.configFolder,
    outputPath: outputPath,
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
    commentExt: Array.isArray(cfgRaw.commentExt)
      ? cfgRaw.commentExt
      : DEFAULT_CONFIG.commentExt,
    commentRemovalPatterns: Array.isArray(cfgRaw.commentRemovalPatterns)
      ? cfgRaw.commentRemovalPatterns
      : DEFAULT_CONFIG.commentRemovalPatterns,
    syncSkipFoldersContaining: Array.isArray(cfgRaw.syncSkipFoldersContaining) // <-- ДОБАВЛЕНО
      ? cfgRaw.syncSkipFoldersContaining
      : DEFAULT_CONFIG.syncSkipFoldersContaining,
  };
}
