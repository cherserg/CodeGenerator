import * as fs from "fs/promises";
import * as path from "path";
import { DEFAULT_CONFIG } from "../configs";
import { ICodegenConfig } from "../interfaces";

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
      },
    );
  }

  const outputPath = cfgRaw.outputPath?.trim() || DEFAULT_CONFIG.outputPath;

  // Логика обработки расширений для комментариев:
  // Если в конфиге строка — превращаем в массив, если массив — оставляем, если нет — берем дефолт.
  const rawCommentExt = cfgRaw.commentExt || DEFAULT_CONFIG.commentExt;
  const normalizedCommentExt = Array.isArray(rawCommentExt)
    ? rawCommentExt
    : [rawCommentExt];

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
    commentExt: normalizedCommentExt as string[],
    commentRemovalPatterns: Array.isArray(cfgRaw.commentRemovalPatterns)
      ? cfgRaw.commentRemovalPatterns
      : DEFAULT_CONFIG.commentRemovalPatterns,
    syncSkipFoldersContaining: Array.isArray(cfgRaw.syncSkipFoldersContaining)
      ? cfgRaw.syncSkipFoldersContaining
      : DEFAULT_CONFIG.syncSkipFoldersContaining,
  };
}
