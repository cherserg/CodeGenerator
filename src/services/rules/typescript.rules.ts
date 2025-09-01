// src/services/rules/typescript.rules.ts

import { Dirent } from "fs";
import { ISyncRule } from "./rule.interface";

class TypeScriptRules implements ISyncRule {
  collectFiles(dirents: Dirent[], indexFileName: string): string[] {
    // Для TS всегда игнорируем оба варианта, чтобы избежать проблем при смене расширения
    const indexTs = "index.ts";
    const indexTsx = "index.tsx";

    return dirents
      .filter((d) => {
        const lowerName = d.name.toLowerCase();
        return (
          d.isFile() &&
          (lowerName.endsWith(".ts") || lowerName.endsWith(".tsx")) &&
          lowerName !== indexTs &&
          lowerName !== indexTsx
        );
      })
      .map((d) => {
        if (d.name.endsWith(".tsx")) {
          return d.name.slice(0, -4);
        }
        return d.name.slice(0, -3);
      })
      .sort((a, b) => a.localeCompare(b));
  }

  generateContent(folders: string[], files: string[], syncExt: string): string {
    if (folders.length === 0 && files.length === 0) {
      // Для TS/JS можно оставить 'export * from "."', но это не обязательно.
      return "";
    }
    const folderExports = folders.map((f) => `export * from './${f}';`);
    const fileExports = files.map((f) => `export * from './${f}';`);
    return [...folderExports, ...fileExports, ""].join("\n");
  }
}

export const tsRules = new TypeScriptRules();
