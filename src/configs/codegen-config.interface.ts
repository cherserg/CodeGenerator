// src/configs/codegen-config.interface.ts

import { ICodegenConfig } from "../interfaces";

export const DEFAULT_CONFIG: ICodegenConfig = {
  configFolder: "codegen",
  outputPath: "src/generated",
  syncIndexPath: "src/generated",
  outputExt: ".ts",
  pathOrder: ["entity", "script"],
  nameOrder: ["entity", "script", "template"], // <--- здесь
  ignoreSync: [],
  syncIndexExt: ".ts",
  barrelName: "index",
  commentRemovalPatterns: [
    "// Path:",
    "// src/",
    "// packages/",
    "// Этот файл",
  ],
  syncSkipFoldersContaining: [],
};
